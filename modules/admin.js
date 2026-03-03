import fs from "fs";
import { ADMIN_ID } from "../config.js";

const USERS_FILE = "../users.json";
const PAGE_SIZE = 10;

function readUsers() {
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");
  let content = fs.readFileSync(USERS_FILE, "utf-8");
  if (!content.trim()) content = "[]";
  try {
    return JSON.parse(content);
  } catch {
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

export function setupAdminPanel(bot) {

  bot.removeTextListener(/\/admin/);

  bot.onText(/\/admin/, async (msg) => {
    if (msg.from.id !== Number(ADMIN_ID)) {
      return bot.sendMessage(msg.chat.id, "❌ Siz admin emassiz");
    }
    return sendAdminPage(bot, msg.chat.id, 1);
  });

  // 🔐 FAQAT ADMIN CALLBACKLARI
  bot.on("callback_query", async (q) => {

    const data = q.data;

    // ❗ ADMIN callback emas bo‘lsa umuman tegmaymiz
    if (
      !data.startsWith("page_") &&
      data !== "export_users" &&
      data !== "clear_users"
    ) {
      return;
    }

    // ❗ Endi admin tekshiruv
    if (q.from.id !== Number(ADMIN_ID)) {
      return bot.answerCallbackQuery(q.id, {
        text: "❌ Siz admin emassiz",
        show_alert: true
      });
    }

    // ===== Pagination =====
    if (data.startsWith("page_")) {
      const page = Number(data.split("_")[1]);
      await sendAdminPage(
        bot,
        q.message.chat.id,
        page,
        q.message.message_id
      );
      return bot.answerCallbackQuery(q.id);
    }

    // ===== Export =====
    if (data === "export_users") {
      if (fs.existsSync(USERS_FILE)) {
        await bot.sendDocument(q.message.chat.id, USERS_FILE);
      }
      return bot.answerCallbackQuery(q.id, {
        text: "📤 users.json yuborildi"
      });
    }

    // ===== Clear =====
    if (data === "clear_users") {
      writeUsers([]);
      await sendAdminPage(
        bot,
        q.message.chat.id,
        1,
        q.message.message_id
      );
      return bot.answerCallbackQuery(q.id, {
        text: "🧹 users.json tozalandi",
        show_alert: true
      });
    }
  });
}