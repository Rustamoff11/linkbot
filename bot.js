import TelegramBot from "node-telegram-bot-api";
import { TELEGRAM_TOKEN } from "./config.js";
import { setupSupport, setupGroupReplyListener } from "./modules/support.js";
import { setupLinkScanner } from "./linkScanner.js";
import { initAdmin } from "./modules/admin.js";

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// ===== ACTIVE USERLAR =====
const supportActiveUsers = new Set();
const linkScannerActiveUsers = new Set();

// ================= START =================
bot.onText(/\/start/, async (msg) => {
  // ❗ Botlardan kelgan xabarlarni bloklaymiz
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

// ================= CALLBACK HANDLER =================
bot.on("callback_query", async (query) => {
  // ❗ Botlardan kelgan callbackni bloklaymiz
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
    if (!linkScannerActiveUsers.has(userId)) {
      linkScannerActiveUsers.add(userId);
      setupLinkScanner(bot, userId);
    }

    await bot.sendMessage(
      userId,
      "🔍 URL (link) tekshirish uchun yuboring:"
    );

    return bot.answerCallbackQuery(query.id);
  }

  return;
});

// ================= GLOBAL MESSAGE =================
bot.on("message", async (msg) => {
  // ❗ MUHIM: Botlardan kelgan xabarlarni to‘liq bloklash
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

  // ===== SCANNER ACTIVE =====
  if (linkScannerActiveUsers.has(userId)) return;

  // ===== DEFAULT =====
  await bot.sendMessage(
    userId,
    "❗ Botni ishga tushirish uchun /start buyrug‘ini yuboring."
  );
});

// ================= INIT MODULLAR =================
setupGroupReplyListener(bot);
initAdmin(bot);

console.log("✅ Bot ishga tushdi...");