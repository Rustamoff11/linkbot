import TelegramBot from "node-telegram-bot-api";
import { TELEGRAM_TOKEN } from "./config.js";
import { setupSupport, setupGroupReplyListener } from "./modules/support.js";
import { setupLinkScanner, activateScanner } from "./linkScanner.js";
import { initAdmin } from "./modules/admin.js";

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// ===== ACTIVE USERLAR =====
const supportActiveUsers = new Set();

// ================= START =================
bot.onText(/\/start/, async (msg) => {
  if (msg.from.is_bot) return;

  const userId = msg.from.id;

  await bot.sendMessage(
    userId,
    "Quyidagi xizmatlardan birini tanlang:",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📨 Hodimga murojaat yuborish", callback_data: "support" }],
          [{ text: "🔍 Shubhali havola tekshirish", callback_data: "scanner" }]
        ]
      }
    }
  );
});

// ================= CALLBACK =================
bot.on("callback_query", async (query) => {
  if (query.from.is_bot) return;

  const userId = query.from.id;
  const data = query.data;

  // ===== SUPPORT =====
  if (data === "support") {
    if (!supportActiveUsers.has(userId)) {
      supportActiveUsers.add(userId);

      setupSupport(bot, query.from, () => {
        supportActiveUsers.delete(userId);
      });
    }

    return bot.answerCallbackQuery(query.id);
  }

  // ===== SUPPORT END =====
  if (data === "support_end") {
    supportActiveUsers.delete(userId);
    await bot.sendMessage(userId, "✅ Suhbat yakunlandi.");
    return bot.answerCallbackQuery(query.id);
  }

  // ===== SCANNER =====
  if (data === "scanner") {

    activateScanner(userId); // 🔥 faqat aktiv qilamiz

    await bot.sendMessage(
      userId,
      "🔍 URL (link) tekshirish uchun yuboring:"
    );

    return bot.answerCallbackQuery(query.id);
  }

});

// ================= GLOBAL MESSAGE =================
bot.on("message", async (msg) => {
  if (msg.from.is_bot) return;

  const userId = msg.from.id;

  if (!msg.text) return;
  if (msg.text.startsWith("/")) return;

  // ===== SUPPORT ACTIVE =====
  if (supportActiveUsers.has(userId)) {
    await bot.sendMessage(
      userId,
      "❓ Habaringiz yetkazildi. Biroz kuting...\n\nSuhbatni yakunlash uchun tugmani bosing:",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Suhbatni yakunlash", callback_data: "support_end" }]
          ]
        }
      }
    );
    return;
  }

});

// ================= INIT =================

// 🔥 Scanner listener faqat 1 marta
setupLinkScanner(bot);

setupGroupReplyListener(bot);
initAdmin(bot);

console.log("✅ Bot ishga tushdi...");