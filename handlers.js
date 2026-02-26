import { checkLink } from './linkChecker.js';
import { formatStatsUz, getInlineKeyboard, isAllowedFile } from './utils.js';
import { logAction, isBlocked, getAllUsers, blockUser, unblockUser } from './users.js';
import { ADMIN_ID } from './config.js';

// Inline tugmalar yaratish - Admin panel
function getAdminKeyboard(allUsers) {
    const buttons = [];

    // Har bir foydalanuvchi uchun blok/unblok tugmalari
    for (const userId in allUsers) {
        const blocked = isBlocked(parseInt(userId));
        buttons.push([
            { text: `👤 ${userId}`, callback_data: 'noop' },
            blocked
                ? { text: '✅ Blokdan chiqarish', callback_data: `unblock_${userId}` }
                : { text: '⛔ Bloklash', callback_data: `block_${userId}` }
        ]);
    }

    // Adminga boshqa imkoniyatlar
    buttons.push([{ text: "📊 Statistika", callback_data: 'show_stats' }]);

    return { reply_markup: { inline_keyboard: buttons } };
}

export function setupHandlers(bot) {
    bot.on('message', async msg => {
        const userId = msg.from.id;

        // Bloklangan foydalanuvchi
        if (isBlocked(userId)) {
            return bot.sendMessage(userId, "⛔ Siz bloklangansiz va botda hech qanday amal bajara olmaysiz. Masul hodimga aloqaga chiqing @rustamov0036");
        }

        const text = msg.text || '';
        const file = msg.document;

        // Foydalanuvchiga har doim link yuborish so‘rovi
        if (!text.startsWith('http') && !file && userId !== ADMIN_ID) {
            return bot.sendMessage(userId, "📤 Foydalanuvchi linkni yuboring:");
        }

        // Faylni tekshirish
        if (file && !isAllowedFile(file.file_name)) {
            return bot.sendMessage(userId, "❌ Ushbu fayl turi qabul qilinmaydi.");
        }

        // Link tekshirish
        if (text.startsWith('http')) {
            logAction(userId, `Link yubordi: ${text}`);
            bot.sendMessage(userId, "⏳ Link tekshirilmoqda...");

            const result = await checkLink(text);
            if (!result) return bot.sendMessage(userId, "❌ Linkni tekshirishda xatolik yuz berdi.");

            const message = formatStatsUz(result.stats, result.safePercent, result.engineDetails);
            bot.sendMessage(userId, message, getInlineKeyboard());
        }

        // Admin panel ishga tushurish
        if (text === '/admin' && userId === ADMIN_ID) {
            const allUsers = getAllUsers();
            bot.sendMessage(userId, "🛠️ Admin panel:", getAdminKeyboard(allUsers));
        }
    });

    // Inline tugmalar
    bot.on('callback_query', query => {
        const userId = query.from.id;
        const data = query.data;

        // Bloklangan foydalanuvchi
        if (isBlocked(userId)) {
            return bot.answerCallbackQuery(query.id, { text: "⛔ Siz  bloklangansiz! Masul hodim bilan bog'laning @Rustamov0036", show_alert: true });
        }

        // Admin inline tugmalarini ishlatish
        if (userId === ADMIN_ID) {

            if (data.startsWith('block_')) {
                const target = parseInt(data.split('_')[1]);
                blockUser(target);
                bot.editMessageReplyMarkup(getAdminKeyboard(getAllUsers()).reply_markup, {
                    chat_id: userId,
                    message_id: query.message.message_id
                });
                return bot.answerCallbackQuery(query.id, { text: `✅ ${target} bloklandi.` });
            }

            if (data.startsWith('unblock_')) {
                const target = parseInt(data.split('_')[1]);
                unblockUser(target);
                bot.editMessageReplyMarkup(getAdminKeyboard(getAllUsers()).reply_markup, {
                    chat_id: userId,
                    message_id: query.message.message_id
                });
                return bot.answerCallbackQuery(query.id, { text: `✅ ${target} blokdan chiqarildi.` });
            }

            if (data === 'show_stats') {
                const allUsers = getAllUsers();
                let msgText = "📋 Foydalanuvchilar amallari:\n\n";
                for (const id in allUsers) {
                    msgText += `👤 ${id}:\n`;
                    allUsers[id].forEach(a => { msgText += `- ${a.date}: ${a.action}\n`; });
                    msgText += "\n";
                }
                bot.sendMessage(userId, msgText || "Hech qanday amal yo'q.");
                return bot.answerCallbackQuery(query.id);
            }
        }

        // Oddiy foydalanuvchi inline tugmalari
        if (data === 'new_link') {
            bot.sendMessage(userId, "📤  yangi link yuboring:");
        }
        if (data === 'send_admin') {
            bot.sendMessage(ADMIN_ID, `📨 Foydalanuvchi ${userId} javob yubordi.`);
        }

        bot.answerCallbackQuery(query.id);
    });
}