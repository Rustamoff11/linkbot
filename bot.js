// import TelegramBot from 'node-telegram-bot-api';
// import { setupHandlers } from './handlers.js';
// import { TELEGRAM_TOKEN } from './config.js';

// const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// setupHandlers(bot);

// console.log("✅ Bot ishga tushdi...");

import TelegramBot from 'node-telegram-bot-api';
import { setupHandlers } from './handlers.js';
import { setupSupport } from './modules/support.js';
import { TELEGRAM_TOKEN } from './config.js';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Modulni ishga tushirish
setupHandlers(bot);  // Link Scanner
setupSupport(bot);   // Murojaat va start tugmalari

console.log("✅ Bot ishga tushdi...");