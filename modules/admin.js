import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ADMIN_ID } from "../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_FILE = path.join(__dirname, "../users.json");
const TICKETS_FILE = path.join(__dirname, "../tickets.json");

const PAGE_SIZE = 10;

// ================= READ =================
function readJSON(file) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, "[]");
  }

  try {
    const content = fs.readFileSync(file, "utf-8");
    return JSON.parse(content || "[]");
  } catch (err) {
    console.error("JSON parse xato:", err);
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function escapeHTML(text = "") {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ================= INIT =================
export function initAdmin(bot) {

  bot.onText(/\/admin/, async (msg) => {
    if (msg.from.id !== Number(ADMIN_ID)) {
      return bot.sendMessage(msg.chat.id, "❌ Siz admin emassiz");
    }

    await sendAdminPage(bot, msg.chat.id, 1);
  });

  bot.on("callback_query", async (q) => {
    const data = q.data;

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

    if (data === "admin_export") {
      await bot.sendDocument(q.message.chat.id, USERS_FILE);
      await bot.sendDocument(q.message.chat.id, TICKETS_FILE);

      return bot.answerCallbackQuery(q.id, {
        text: "📤 users.json va tickets.json yuborildi"
      });
    }

    if (data === "admin_clear") {
      writeJSON(USERS_FILE, []);
      writeJSON(TICKETS_FILE, []);

      await sendAdminPage(
        bot,
        q.message.chat.id,
        1,
        q.message.message_id
      );

      return bot.answerCallbackQuery(q.id, {
        text: "🧹 Barcha ma’lumotlar tozalandi",
        show_alert: true
      });
    }
  });
}

// ================= PAGE =================
async function sendAdminPage(bot, chatId, page = 1, editMessageId = null) {

  const users = readJSON(USERS_FILE);
  const tickets = readJSON(TICKETS_FILE);

  const totalTickets = tickets.length;
  const answered = tickets.filter(t => t.answer).length;
  const pending = totalTickets - answered;

  if (!users.length) {
    return bot.sendMessage(chatId, "📂 Ma’lumot yo‘q");
  }

  const totalPages = Math.ceil(users.length / PAGE_SIZE);

  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;

  const start = (page - 1) * PAGE_SIZE;
  const pageUsers = users.slice().reverse().slice(start, start + PAGE_SIZE);

  let text = `🛡 <b>ADMIN PANEL</b>\n`;
  text += `👥 Jami foydalanuvchilar: <b>${users.length}</b>\n`;
  text += `🎫 Jami murojaatlar: <b>${totalTickets}</b>\n`;
  text += `✅ Javob berilgan: <b>${answered}</b>\n`;
  text += `⏳ Kutilayotgan: <b>${pending}</b>\n`;
  text += `📄 Sahifa: <b>${page}/${totalPages}</b>\n`;
  text += `─────────────────────────────\n\n`;

  pageUsers.forEach((u, i) => {
    const userTickets = tickets.filter(t => t.userId === u.userId);

    text += `<b>${start + i + 1}) 👤 @${escapeHTML(u.username || "no_username")}</b>\n`;
    text += `🆔 ID: <code>${u.userId}</code>\n`;
    text += `📈 Harakatlar: <b>${u.total_actions || 0}</b>\n`;
    text += `🎫 Murojaatlar: <b>${userTickets.length}</b>\n`;
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