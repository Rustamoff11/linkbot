import TelegramBot from 'node-telegram-bot-api';
import fs from "fs";
import { TELEGRAM_TOKEN, ADMIN_GROUP_ID } from './config.js';
import { setupSupport, setupGroupReplyListener } from './modules/support.js';
import { setupLinkScanner } from './linkScanner.js';
import { setupAdminPanel } from './modules/admin.js';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const USERS_FILE = "./modules/users.json";

// ===== JSON helper =====
function readUsers() {
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");
  let content = fs.readFileSync(USERS_FILE, "utf-8");
  if (!content.trim()) content = "[]";
  try { return JSON.parse(content); } 
  catch { return []; }
}

// ===== /START MENYUSI =====
bot.onText(/\/start/, (msg) => {
  const userId = msg.from.id;

  bot.sendMessage(userId, "Quydagi xizmatlardan birini tanlang:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📨 Hodimga murojaat yuborish", callback_data: "support" }],
        [{ text: "🔍 Shubhali havola tekshirish", callback_data: "scanner" }]
      ]
    }
  });
});

// ===== INLINE TUGMALAR =====
let linkScannerActiveUsers = new Set();

bot.on("callback_query", async (query) => {
  const userId = query.from.id;

  // Support tugmasi
  if (query.data === "support") {
    setupSupport(bot, query.from);
  }

  // Scanner tugmasi
  if (query.data === "scanner") {
    if (!linkScannerActiveUsers.has(userId)) {
      setupLinkScanner(bot, userId); // har bir user uchun alohida listener
      linkScannerActiveUsers.add(userId);
    }
    bot.sendMessage(userId, "🔍 Link Scanner ishga tushdi! URL yuboring.");
  }

  bot.answerCallbackQuery(query.id);
});

// ===== GLOBAL MESSAGE LISTENER =====
bot.on("message", (msg) => {
  const userId = msg.from.id;

  // Admin va bot xabarlari uchun tekshiruvdan o'tkazmaymiz
  if (userId === Number(ADMIN_GROUP_ID)) return;

  // Endi hech qanday bloklash tekshiruvi yo'q, foydalanuvchi xabar yuborishi mumkin
});

// ===== GURUH REPLY LISTENER =====
setupGroupReplyListener(bot);

// ===== ADMIN PANEL =====
bot.onText(/\/admin/, (msg) => setupAdminPanel(bot, msg));

console.log("✅ Bot ishga tushdi...");