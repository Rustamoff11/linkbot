import fs from 'fs';
import { ADMIN_GROUP_ID } from '../config.js';

const SUPPORT_FILE = './support.json';

// JSON fayldan o‘qish
function getSupportData() {
    if (!fs.existsSync(SUPPORT_FILE)) fs.writeFileSync(SUPPORT_FILE, '[]');
    return JSON.parse(fs.readFileSync(SUPPORT_FILE));
}

// JSON faylga yozish
function saveSupportData(data) {
    fs.writeFileSync(SUPPORT_FILE, JSON.stringify(data, null, 2));
}

// Foydalanuvchi ID bo‘yicha murojat qo‘shish
function addSupport(userId, username, question) {
    const data = getSupportData();
    const entry = {
        id: Date.now() + "_" + Math.floor(Math.random()*1000),
        userId,
        username,
        question,
        reply: null
    };
    data.push(entry);
    saveSupportData(data);
    return entry;
}

// Admin javobini saqlash
function saveReply(id, reply) {
    const data = getSupportData();
    const entry = data.find(d => d.id === id);
    if(entry){
        entry.reply = reply;
        saveSupportData(data);
    }
}

// Pending mapping (admin message_id → foydalanuvchi)
const pendingReplies = {};

export function setupSupport(bot) {

    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;

        const opts = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Murojaat yuborish", callback_data: 'send_request' }],
                    [{ text: "Link Scanner", callback_data: 'link_scan' }]
                ]
            }
        };
        bot.sendMessage(chatId, "👋 Salom! Quyidagi tugmalardan birini tanlang:", opts);
    });

    // Callback querylar
    bot.on('callback_query', (query) => {
        const chatId = query.message.chat.id;
        const userId = query.from.id;
        const username = query.from.username || query.from.first_name;

        if(query.data === 'send_request'){
            bot.answerCallbackQuery(query.id);
            bot.sendMessage(chatId, "✏️ Iltimos, savolingizni yozing:");

            bot.once('message', (msg) => {
                const question = msg.text;

                // JSON faylga saqlash
                const entry = addSupport(userId, username, question);

                // Admin guruhga yuborish
                bot.sendMessage(ADMIN_GROUP_ID, `📨 @${username} murojat yubordi:\n${question}`, {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "✅ Javob yoq", callback_data: `answer_no_${entry.id}` },
                                { text: "💌 Javob bor", callback_data: `answer_yes_${entry.id}` }
                            ]
                        ],
                        force_reply: true
                    }
                }).then(sentMsg => {
                    pendingReplies[sentMsg.message_id] = entry.id;
                });
            });
        }

        // Inline tugmalar (javob bor/yok)
        if(query.data.startsWith('answer_yes_') || query.data.startsWith('answer_no_')){
            const parts = query.data.split('_');
            const status = parts[1]; // yes yoki no
            const entryId = parts[2];
            const entryData = getSupportData().find(d => d.id === entryId);
            if(entryData){
                const text = status === 'yes' ? "💌 Admin javobi mavjud" : "❌ Admin javobi yo‘q";
                bot.sendMessage(entryData.userId, text);
            }
            bot.answerCallbackQuery(query.id);
        }
    });

    // Admin reply yozsa foydalanuvchiga yuborish va JSONga saqlash
    bot.on('message', (msg) => {
        if(msg.chat.id === ADMIN_GROUP_ID && msg.reply_to_message){
            const entryId = pendingReplies[msg.reply_to_message.message_id];
            if(entryId){
                const entryData = getSupportData().find(d => d.id === entryId);
                if(entryData){
                    bot.sendMessage(entryData.userId, `💬 Admin javobi: ${msg.text}`);
                    saveReply(entryId, msg.text);
                    delete pendingReplies[msg.reply_to_message.message_id];
                }
            }
        }
    });
}