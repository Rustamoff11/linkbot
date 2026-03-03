import fs from "fs";
import { ADMIN_GROUP_ID } from "../config.js";

const DB_FILE = "../tickets.json";   // ✅ alohida ticket fayl
const USERS_FILE = "../users.json";

// 🧠 Aktiv support userlar
const activeSupportUsers = new Set();

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

// ==================================
// SUPPORT
// ==================================
export function setupSupport(bot, user, onFinish) {
  const userId = user.id;
  if (user.is_bot) return; // ❗ BOTLARNI BLOKLASH

  if (activeSupportUsers.has(userId)) return;
  activeSupportUsers.add(userId);

  bot.sendMessage(userId, "📩 Iltimos, savolingizni yozing:");

  const messageListener = async (msg) => {
    if (msg.from.is_bot) return; // ❗ MUHIM
    if (msg.chat.id !== userId || !msg.text) return;
    if (msg.text === "/start") {
      stopSupport();
      return;
    }

    const tickets = readJSON(DB_FILE);

    const record = {
      id: Date.now(),
      userId: userId,
      username: user.username || user.first_name,
      question: msg.text,
      answer: null,
      operator: null,
      time: now(),
      group_message_id: null
    };

    tickets.push(record);
    writeJSON(DB_FILE, tickets);

    try {
      const sent = await bot.sendMessage(
        Number(ADMIN_GROUP_ID),
        `📩 Yangi murojaat:\n👤 @${record.username}\n🕒 ${record.time}\n\n❓ ${record.question}`,
        { reply_markup: { force_reply: true } }
      );

      record.group_message_id = sent.message_id;
      writeJSON(DB_FILE, tickets);
    } catch (err) {
      console.error("❌ Guruhga yuborishda xato:", err.message);
    }
  };

  bot.on("message", messageListener);

  function stopSupport() {
    activeSupportUsers.delete(userId);
    bot.removeListener("message", messageListener);
    if (onFinish) onFinish();
  }
}

// ==================================
// GROUP REPLY
// ==================================
export function setupGroupReplyListener(bot) {
  bot.on("message", async (msg) => {

    // ❗ BOTLARNI BLOKLASH
    if (msg.from.is_bot) return;

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

    try {
      await bot.sendMessage(
        Number(rec.userId),
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
    } catch (err) {
      console.error("❌ Userga yuborishda xato:", err.message);
    }
  });
}