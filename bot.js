import TelegramBot from 'node-telegram-bot-api';
import fs from "fs";
import { TELEGRAM_TOKEN, ADMIN_GROUP_ID } from './config.js';
import { setupSupport, setupGroupReplyListener } from './modules/support.js';
import { setupLinkScanner } from './linkScanner.js';
import { setupAdminPanel } from './modules/admin.js';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// ACTIVE USERLAR
const supportActiveUsers = new Set();
const linkScannerActiveUsers = new Set();

// ===== /START =====
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
bot.on("callback_query", async (query) => {
  const userId = query.from.id;

  // SUPPORT
  if (query.data === "support") {
    if (!supportActiveUsers.has(userId)) {
      supportActiveUsers.add(userId);

      setupSupport(bot, query.from, () => {
        supportActiveUsers.delete(userId); // murojaatdan keyin o‘chadi
      });

      bot.sendMessage(userId, "✍️ Murojaatingizni yozing:");
    }
  }

  // SCANNER
  if (query.data === "scanner") {
    if (!linkScannerActiveUsers.has(userId)) {
      setupLinkScanner(bot, userId);
      linkScannerActiveUsers.add(userId);
    }
    bot.sendMessage(userId, "🔍 URL yuboring:");
  }

  bot.answerCallbackQuery(query.id);
});

// ===== GLOBAL MESSAGE LISTENER =====
bot.on("message", (msg) => {
  const userId = msg.from.id;

  // buyruqlarni tekshirmaymiz
  if (msg.text && msg.text.startsWith("/")) return;

  // agar support yoki scanner aktiv bo‘lsa → jim
  if (supportActiveUsers.has(userId)) return;
  if (linkScannerActiveUsers.has(userId)) return;

  // oddiy xabar yozsa
  bot.sendMessage(userId, "❗ Iltimos, avval /start buyrug‘ini bosing va tugma tanlang.");
});

// ===== GURUH REPLY =====
setupGroupReplyListener(bot);

// ===== ADMIN =====
bot.onText(/\/admin/, (msg) => setupAdminPanel(bot, msg));

console.log("✅ Bot ishga tushdi...");