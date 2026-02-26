import TelegramBot from 'node-telegram-bot-api';
import { setupHandlers } from './handlers.js';
import { TELEGRAM_TOKEN } from './config.js';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

setupHandlers(bot);

console.log("✅ Bot ishga tushdi...");
