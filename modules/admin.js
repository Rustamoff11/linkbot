import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ADMIN_ID } from "../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ❗ absolute path ishlatamiz (xatolik bo‘lmasligi uchun)
const USERS_FILE = path.join(__dirname, "../users.json");
const PAGE_SIZE = 10;

function readUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, "[]");
  }

  try {
    const content = fs.readFileSync(USERS_FILE, "utf-8");
    return JSON.parse(content || "[]");
  } catch (err) {
    console.error("JSON parse xato:", err);
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function escapeHTML(text = "") {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ================= INIT =================
export function initAdmin(bot) {

  // ===== /ADMIN =====
  bot.onText(/\/admin/, async (msg) => {
    if (msg.from.id !== Number(ADMIN_ID)) {
      return bot.sendMessage(msg.chat.id, "❌ Siz admin emassiz");
    }

    await sendAdminPage(bot, msg.chat.id, 1);
  });

  // ===== CALLBACK HANDLER =====
  bot.on("callback_query", async (q) => {

    const data = q.data;

    // ❗ faqat admin callbacklar
    if (
      !data.startsWith("admin_page_") &&
      data !== "admin_export" &&
      data !== "admin_clear"
    ) return;

    if (q.from.id !== Number(ADMIN_ID)) {
      return bot.answerCallbackQuery(q.id, {
        text: "❌ Siz admin emassiz",
        show_alert: true
      });
    }

    // ===== Pagination =====
    if (data.startsWith("admin_page_")) {
      const page = Number(data.split("_")[2]);

      await sendAdminPage(
        bot,
        q.message.chat.id,
        page,
        q.message.message_id
      );

      return bot.answerCallbackQuery(q.id);
    }

    // ===== Export =====
    if (data === "admin_export") {
      if (fs.existsSync(USERS_FILE)) {
        await bot.sendDocument(q.message.chat.id, USERS_FILE);
      }

      return bot.answerCallbackQuery(q.id, {
        text: "📤 users.json yuborildi"
      });
    }

    // ===== Clear =====
    if (data === "admin_clear") {
      writeUsers([]);

      await sendAdminPage(
        bot,
        q.message.chat.id,
        1,
        q.message.message_id
      );

      return bot.answerCallbackQuery(q.id, {
        text: "🧹 Tozalandi",
        show_alert: true
      });
    }
  });
}

// ================= PAGE =================
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
    text += `📈 Harakatlar: <b>${u.total_actions || 0}</b>\n`;
    text += `─────────────────────────────\n`;
  });

  const keyboard = [];
  const navRow = [];

  if (page > 1)
    navRow.push({ text: "⬅️ Oldingi", callback_data: `admin_page_${page - 1}` });

  if (page < totalPages)
    navRow.push({ text: "➡️ Keyingi", callback_data: `admin_page_${page + 1}` });

  if (navRow.length) keyboard.push(navRow);

  keyboard.push([
    { text: "📤 Export", callback_data: "admin_export" },
    { text: "🧹 Tozalash", callback_data: "admin_clear" }
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
  }

  return bot.sendMessage(chatId, text, options);
}