import TelegramBot from 'node-telegram-bot-api';
import { TELEGRAM_TOKEN } from './config.js';
import { setupSupport, setupGroupReplyListener } from './modules/support.js';
import { setupLinkScanner } from './linkScanner.js';
import { setupAdminPanel } from './modules/admin.js';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// ===== ACTIVE USERLAR =====
const supportActiveUsers = new Set();
const linkScannerActiveUsers = new Set();


// ===== /START =====
bot.onText(/\/start/, (msg) => {
  const userId = msg.from.id;

  bot.sendMessage(userId, "Quyidagi xizmatlardan birini tanlang:", {
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

  // ===== SUPPORT BOSILGANDA =====
  if (query.data === "support") {

    if (!supportActiveUsers.has(userId)) {

      supportActiveUsers.add(userId);

      // await bot.sendMessage(userId, "✍️ Murojaatingizni yozing:");

      // support modul ishga tushadi
      setupSupport(bot, query.from, () => {
        supportActiveUsers.delete(userId);
      });
    }

    return bot.answerCallbackQuery(query.id);
  }

  // ===== SUPPORT YAKUNLASH =====
  if (query.data === "support_end") {

    supportActiveUsers.delete(userId);

    await bot.sendMessage(userId, "✅ Suhbat yakunlandi.");

    return bot.answerCallbackQuery(query.id);
  }

  // ===== SCANNER =====
  if (query.data === "scanner") {

    if (!linkScannerActiveUsers.has(userId)) {
      setupLinkScanner(bot, userId);
      linkScannerActiveUsers.add(userId);
    }

    await bot.sendMessage(userId, "🔍 URL (link) tekshirish uchun yuboring:");

    return bot.answerCallbackQuery(query.id);
  }

  bot.answerCallbackQuery(query.id);
});


// ===== GLOBAL MESSAGE LISTENER =====
bot.on("message", async (msg) => {
  const userId = msg.from.id;

  if (!msg.text) return;

  // buyruqlarni o‘tkazib yuboramiz
  if (msg.text.startsWith("/")) return;

  // ===== SUPPORT AKTIV BO'LSA =====
  if (supportActiveUsers.has(userId)) {

    // ⚠️ Bu yerda setupSupport admin ga forward qiladi
    // Biz faqat yakunlash tugmasini chiqaramiz

    await bot.sendMessage(userId, "❓habaringiz yetkazildi biroz kuting...  Suhbatni yakunlash uchun knopkani bosing yoki habar qoldiring?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Suhbatni yakunlash", callback_data: "support_end" }]
        ]
      }
    });

    return;
  }

  // ===== SCANNER AKTIV BO'LSA =====
  if (linkScannerActiveUsers.has(userId)) return;

  // ===== ODDIY XABAR =====
  bot.sendMessage(
    userId,
    "❗ Botni ishga tushirish uchun /start buyrug‘ini yuboring."
  );
});


// ===== GURUH REPLY LISTENER =====
setupGroupReplyListener(bot);

// ===== ADMIN PANEL =====
bot.onText(/\/admin/, (msg) => setupAdminPanel(bot, msg));

console.log("✅ Bot ishga tushdi...");