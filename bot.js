// import TelegramBot from 'node-telegram-bot-api';
// import { setupHandlers } from './handlers.js';
// import { TELEGRAM_TOKEN } from './config.js';

// const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// setupHandlers(bot);

// console.log("✅ Bot ishga tushdi...");
import TelegramBot from 'node-telegram-bot-api';
import { TELEGRAM_TOKEN } from './config.js';
import { setupSupport } from './modules/support.js';
import { setupHandlers } from './handlers.js';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// start menyu
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Tanlang:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📨 Murojaat yuborish", callback_data: "support" }],
        [{ text: "🔍 Link Scanner", callback_data: "scanner" }]
      ]
    }
  });
});

// Tugmalarni yo‘naltirish
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;

  if (query.data === "support") {
    setupSupport(bot, chatId, query.from);
  }

  if (query.data === "scanner") {
    setupHandlers(bot, chatId);
  }

  bot.answerCallbackQuery(query.id);
});

console.log("✅ Bot ishga tushdi...");