import fs from "fs";
import { ADMIN_ID } from "../config.js";

const USERS_FILE = "./data/users.json";
const PAGE_SIZE = 10;

// ===== JSON helper =====
function readUsers() {
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");
  let content = fs.readFileSync(USERS_FILE, "utf-8");
  if (!content.trim()) content = "[]";
  try {
    return JSON.parse(content);
  } catch (err) {
    console.error("❌ JSON parse xato:", err);
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// ===== HTML escape =====
function escapeHTML(text = "") {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ===== Admin panel =====
export function setupAdminPanel(bot) {

  bot.removeTextListener(/\/admin/);

  bot.onText(/\/admin/, async (msg) => {
    if (msg.from.id !== Number(ADMIN_ID)) {
      return bot.sendMessage(msg.chat.id, "❌ Siz admin emassiz");
    }
    return sendAdminPage(bot, msg.chat.id, 1);
  });

  bot.on("callback_query", async (q) => {
    if (q.from.id !== Number(ADMIN_ID)) {
      return bot.answerCallbackQuery(q.id, {
        text: "❌ Siz admin emassiz",
        show_alert: true
      });
    }

    const data = q.data;

    // pagination
    if (data.startsWith("page_")) {
      const page = Number(data.split("_")[1]);
      await sendAdminPage(bot, q.message.chat.id, page, q.message.message_id);
    }

    // export
    if (data === "export_users") {
      if (!fs.existsSync(USERS_FILE)) return;
      await bot.sendDocument(q.message.chat.id, USERS_FILE);
      bot.answerCallbackQuery(q.id, { text: "📤 users.json yuborildi" });
    }

    // clear
    if (data === "clear_users") {
      writeUsers([]);
      bot.answerCallbackQuery(q.id, {
        text: "🧹 users.json tozalandi",
        show_alert: true
      });
      await sendAdminPage(bot, q.message.chat.id, 1, q.message.message_id);
    }
  });
}

// ===== Sahifa yuborish =====
async function sendAdminPage(bot, chatId, page = 1, editMessageId = null) {
  const users = readUsers();

  if (!users.length) {
    return bot.sendMessage(chatId, "📂 Ma’lumot yo‘q");
  }

  const totalPages = Math.ceil(users.length / PAGE_SIZE);
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;

  const start = (page - 1) * PAGE_SIZE;
  const pageUsers = users.slice().reverse().slice(start, start + PAGE_SIZE);

  let text = `🛡 <b>ADMIN PANEL</b>\n`;
  text += `📊 Jami foydalanuvchilar: <b>${users.length}</b>\n`;
  text += `📄 Sahifa: <b>${page}/${totalPages}</b>\n`;
  text += `─────────────────────────────\n\n`;

  pageUsers.forEach((u, i) => {
    text += `<b>${start + i + 1}) 👤 @${escapeHTML(u.username || "no_username")}</b>\n`;
    text += `🆔 ID: <code>${u.userId}</code>\n`;
    text += `📈 Umumiy harakatlar: <b>${u.total_actions || 0}</b>\n`;

    if (Array.isArray(u.actions) && u.actions.length > 0) {
      const lastThree = u.actions.slice(-3).reverse();
      text += `📜 Oxirgi 3 harakat:\n`;
      lastThree.forEach((a, idx) => {
        let feedbackText = a.feedback ? ` | Feedback: <b>${a.feedback}</b>` : "";
        text += `  ${idx + 1}) ${escapeHTML(a.text)} — <i>${a.time}</i>${feedbackText}\n`;
      });
    } else {
      text += `📜 Harakatlar: <i>Yo‘q</i>\n`;
    }

    text += `─────────────────────────────\n`;
  });

  const keyboard = [];

  const navRow = [];
  if (page > 1) navRow.push({ text: "⬅️ Oldingi", callback_data: `page_${page - 1}` });
  if (page < totalPages) navRow.push({ text: "➡️ Keyingi", callback_data: `page_${page + 1}` });

  if (navRow.length) keyboard.push(navRow);

  keyboard.push([
    { text: "📤 Export users.json", callback_data: "export_users" },
    { text: "🧹 Tozalash", callback_data: "clear_users" }
  ]);

  const options = {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: keyboard }
  };

  if (editMessageId) {
    return bot.editMessageText(text, {
      chat_id: chatId,
      message_id: editMessageId,
      ...options
    });
  } else {
    return bot.sendMessage(chatId, text, options);
  }
}