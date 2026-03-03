import fs from "fs";
import { ADMIN_GROUP_ID } from "../config.js";

const DB_FILE = "./data/user.json";
const USERS_FILE = "../users.json";

// 🧠 Aktiv support userlar
const activeSupportUsers = new Set();

// ===============================
// JSON o‘qish / saqlash
// ===============================
function readJSON(path) {
  if (!fs.existsSync(path)) fs.writeFileSync(path, "[]");
  const content = fs.readFileSync(path, "utf-8").trim();
  try {
    return content ? JSON.parse(content) : [];
  } catch (err) {
    console.error("❌ JSON parse xato:", err);
    return [];
  }
}

function writeJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

function now() {
  return new Date().toLocaleString();
}

// ===============================
// ACTION ANIQLASH
// ===============================
function detectAction(text) {
  if (!text) return "Bo‘sh xabar";
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  if (urlRegex.test(text)) {
    const link = text.match(urlRegex)[0];
    return `Link yubordi: ${link}`;
  }
  return `Suhbat: ${text}`;
}

// ===============================
// USER STAT SAQLASH
// ===============================
function saveUserAction(user, text, feedback = null) {
  const users = readJSON(USERS_FILE);
  const actionText = detectAction(text);

  let existing = users.find(u => u.userId === user.id);

  const actionRecord = {
    text: actionText,
    time: now(),
    feedback: feedback
  };

  if (existing) {
    existing.total_actions += 1;
    if (!Array.isArray(existing.actions)) existing.actions = [];
    existing.actions.push(actionRecord);
    if (existing.actions.length > 3)
      existing.actions = existing.actions.slice(-3);
  } else {
    existing = {
      userId: user.id,
      username: user.username || user.first_name,
      total_actions: 1,
      actions: [actionRecord]
    };
    users.push(existing);
  }

  writeJSON(USERS_FILE, users);
}

// ==================================
// SUPPORT
// ==================================
export function setupSupport(bot, user, onFinish) {
  const userId = user.id;

  // agar allaqachon supportda bo‘lsa qayta ochmaymiz
  if (activeSupportUsers.has(userId)) return;

  activeSupportUsers.add(userId);

  bot.sendMessage(userId, "📩 Iltimos, savolingizni yozing:");

  const messageListener = async (msg) => {
    if (msg.chat.id !== userId || !msg.text) return;

    // agar /start bossa — supportni majburan yopamiz
    if (msg.text === "/start") {
      stopSupport();
      return;
    }

    const tickets = readJSON(DB_FILE);

    const record = {
      id: Date.now(),
      userId: user.id,
      username: user.username || user.first_name,
      question: msg.text,
      answer: null,
      operator: null,
      feedback: null,
      time: now(),
      answer_time: null,
      group_message_id: null
    };

    tickets.push(record);
    writeJSON(DB_FILE, tickets);

    saveUserAction(user, msg.text);

    try {
      const sent = await bot.sendMessage(
        Number(ADMIN_GROUP_ID),
        `📩 Yangi murojaat:\n👤 @${record.username}\n🕒 ${record.time}\n\n❓ ${record.question}`,
        { reply_markup: { force_reply: true } }
      );

      record.group_message_id = sent.message_id;
      writeJSON(DB_FILE, tickets);
    } catch (err) {
      console.error("Guruhga yuborishda xato:", err);
    }
  };

  bot.on("message", messageListener);

  // ===== SUPPORTNI YOPISH =====
  const endListener = async (q) => {
    if (q.data !== "support_end") return;
    if (q.from.id !== userId) return;

    stopSupport();
    await bot.sendMessage(userId, "✅ Suhbat yakunlandi.");
    if (onFinish) onFinish();
  };

  bot.on("callback_query", endListener);

  function stopSupport() {
    activeSupportUsers.delete(userId);
    bot.removeListener("message", messageListener);
    bot.removeListener("callback_query", endListener);
  }
}

// ==================================
// GROUP REPLY
// ==================================
export function setupGroupReplyListener(bot) {
  bot.on("message", async (msg) => {
    if (
      msg.chat.id !== Number(ADMIN_GROUP_ID) ||
      !msg.reply_to_message ||
      !msg.text
    ) return;

    const tickets = readJSON(DB_FILE);
    const rec = tickets.find(r => r.group_message_id === msg.reply_to_message.message_id);
    if (!rec || rec.answer) return;

    rec.answer = msg.text;
    rec.answer_time = now();
    rec.operator = msg.from.username || msg.from.first_name;

    writeJSON(DB_FILE, tickets);

    await bot.sendMessage(
      rec.userId,
      `📨 Hodimning javobi:\n${rec.answer}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "👍 Qoniqarli", callback_data: `good_${rec.id}` },
              { text: "👎 Qoniqarsiz", callback_data: `bad_${rec.id}` }
            ]
          ]
        }
      }
    );
  });

  bot.on("callback_query", (q) => {
    if (!q.data.startsWith("good_") && !q.data.startsWith("bad_")) return;

    const tickets = readJSON(DB_FILE);
    const id = Number(q.data.split("_")[1]);
    const rec = tickets.find(r => r.id === id);
    if (!rec) return;

    if (!rec.feedback) {
      rec.feedback = q.data.startsWith("good_") ? "Yaxshi" : "Yomon";
      writeJSON(DB_FILE, tickets);

      const users = readJSON(USERS_FILE);
      const user = users.find(u => u.userId === rec.userId);

      if (user) {
        if (!Array.isArray(user.actions)) user.actions = [];
        user.actions.push({
          text: `Admin javobi: ${rec.answer}`,
          time: now(),
          feedback: rec.feedback
        });
        if (user.actions.length > 3)
          user.actions = user.actions.slice(-3);

        writeJSON(USERS_FILE, users);
      }
    }

    bot.answerCallbackQuery(q.id, { text: "Rahmat! Baholandi ✅" });
  });
}