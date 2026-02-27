import fs from "fs";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const VIRUSTOTAL_API_KEY = process.env.VT_API_KEY;
const ADMIN_ID =6030329675; // O'zingizni Telegram ID

// ================= USERS DATABASE =================
function getUsers() {
    if (!fs.existsSync("users.json")) fs.writeFileSync("users.json", "[]");
    return JSON.parse(fs.readFileSync("users.json"));
}

function saveUsers(users) {
    fs.writeFileSync("users.json", JSON.stringify(users, null, 2));
}

function addUser(userData) {
    const users = getUsers();
    let user = users.find(u => u.id === userData.id);
    if (!user) {
        user = {
            id: userData.id,
            username: userData.username || "NoUsername",
            blocked: false,
            actions: []
        };
        users.push(user);
        saveUsers(users);
    } else if (!Array.isArray(user.actions)) {
        user.actions = [];
    }
    return user;
}

function logAction(userId, action) {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return; // xavfsizlik uchun
    if (!Array.isArray(user.actions)) user.actions = [];
    user.actions.push({ date: new Date().toISOString(), action });
    saveUsers(users);
}

// ================= VIRUSTOTAL FUNCTIONS =================
async function submitUrl(url) {
    const response = await axios.post(
        "https://www.virustotal.com/api/v3/urls",
        new URLSearchParams({ url }),
        { headers: { "x-apikey": VIRUSTOTAL_API_KEY, "Content-Type": "application/x-www-form-urlencoded" } }
    );
    return response.data.data.id;
}

async function getAnalysis(id) {
    const response = await axios.get(
        `https://www.virustotal.com/api/v3/analyses/${id}`,
        { headers: { "x-apikey": VIRUSTOTAL_API_KEY } }
    );
    return response.data.data.attributes;
}

async function waitForCompletion(id) {
    for (let i = 0; i < 10; i++) {
        const analysis = await getAnalysis(id);
        if (analysis.status === "completed") return analysis;
        await new Promise(res => setTimeout(res, 3000));
    }
    return null;
}

// ================= CALLBACK REPORT STORAGE =================
const reports = new Map();

// ================= URL VALIDATION =================
function isValidUrl(text) {
    try { new URL(text); return true; } 
    catch { return false; }
}

// ================= SETUP HANDLERS =================
export function setupHandlers(bot) {

    // START
    bot.onText(/\/start/, (msg) => {
        addUser(msg.from);
        bot.sendMessage(msg.chat.id, "👋 Xush kelibsiz! Foydalanish uchun  URL (Link)  yuboring.");
    });

    // ADMIN PANEL
    bot.onText(/\/admin/, (msg) => {
        if (msg.from.id !== ADMIN_ID)
            return bot.sendMessage(msg.chat.id, "❌ Siz admin emassiz ushbu buyruqdan faqat admin foydalanishi mumkin.");

        const users = getUsers();
        let text = `🛡 ADMIN PANEL\n\n👥 Jami foydalanuvchilar: ${users.length}\n\n`;

        users.forEach(u => {
            text += `👤 @${u.username}\n🆔 ${u.id}\n📌 Holati: ${u.blocked ? "🚫 Bloklangan" : "✅ Aktiv"}\n📄 Oxirgi 5 amal:\n`;
            (u.actions || []).slice(-5).forEach(a => { text += `- ${a.date}: ${a.action}\n`; });
        });

        // Inline tugmalar bloklash / blokdan chiqarish
        const keyboard = users.map(u => [
            { text: u.blocked ? `✅ ${u.username}ni blokdan chiqar` : `🚫 ${u.username}ni bloklash`, callback_data: `toggle_${u.id}` }
        ]);

        bot.sendMessage(msg.chat.id, text, { reply_markup: { inline_keyboard: keyboard } });
    });

    // INLINE CALLBACKS
    bot.on("callback_query", (query) => {
        const data = query.data;
        const chatId = query.message.chat.id;

        if (!data.startsWith("toggle_") && !data.startsWith("report_")) return;

        const users = getUsers();

        if (data.startsWith("toggle_")) {
            const userId = parseInt(data.split("_")[1]);
            if (query.from.id !== ADMIN_ID)
                return bot.answerCallbackQuery(query.id, { text: "❌ Siz admin emassiz." });

            const user = users.find(u => u.id === userId);
            if (!user) return bot.answerCallbackQuery(query.id, { text: "User topilmadi ❌" });

            user.blocked = !user.blocked;
            saveUsers(users);

            bot.editMessageReplyMarkup(
                { inline_keyboard: users.map(u => [{ text: u.blocked ? `✅ ${u.username}ni blokdan chiqar` : `🚫 ${u.username}ni bloklash`, callback_data: `toggle_${u.id}` }]) },
                { chat_id: chatId, message_id: query.message.message_id }
            );

            bot.answerCallbackQuery(query.id, { text: user.blocked ? "🚫 Foydalanuvchi bloklandi" : "✅ Foydalanuvchi blokdan chiqarildi" });
        }

        if (data.startsWith("report_")) {
            const reportId = data.split("_")[1];
            const r = reports.get(reportId);
            if (!r) return bot.answerCallbackQuery(query.id, { text: "Ma'lumot topilmadi ❌" });

            const reportMessage = `
🚨 XAVFLI LINK REPORT
👤 Username: @${r.username}
🆔 User ID: ${r.userId}
🌐 URL: ${r.url}
`;

            bot.sendMessage(ADMIN_ID, reportMessage);
            bot.answerCallbackQuery(query.id, { text: "Admin ga yuborildi ✅" });
            reports.delete(reportId);
        }
    });

    // URL CHECK
    bot.on("message", async (msg) => {

        if (!msg.text || msg.text.startsWith("/")) return;

        const user = addUser(msg.from);

        if (user.blocked) return bot.sendMessage(msg.chat.id, "🚫 Siz bloklangansiz.");

        const url = msg.text.trim();
        if (!isValidUrl(url)) return bot.sendMessage(msg.chat.id, "❌ To‘g‘ri URL (manzil) yuboring.");

        logAction(user.id, `URL yubordi: ${url}`);

        bot.sendMessage(msg.chat.id, "🔍 Biroz kuting Tekshirilmoqda...");

        try {
            const id = await submitUrl(url);
            const analysis = await waitForCompletion(id);

            if (!analysis) return bot.sendMessage(msg.chat.id, "⏳ Tekshiruv tugamadi.");

            const stats = analysis.stats;
            const malicious = stats.malicious || 0;
            const suspicious = stats.suspicious || 0;
            const harmless = stats.harmless || 0;

            let risk = (malicious * 5) + (suspicious * 5);
            if (risk > 100) risk = 100;

            let status = "🟢 XAVFSIZ";
            if (malicious > 0) status = "🔴 XAVFLI";
            else if (suspicious > 0) status = "🟡 SHUBHALI";

            const message = `
╔════════════════╗
🌐 ${url}
╚════════════════╝

🛡 Xolat: ${status}
⚠️ Xavf darajasi: ${risk}%

🔎 yuqori havfsizlik:
🔴 havfli  ${malicious}
🟡 shubhali ${suspicious} 
🟢 havf aniqlanmadi${harmless}  
❗Unicon Soft oltiariq tumani hodimlari tomonidan tekshirildi❗
`;

            if (malicious > 0) {
                const reportId = Date.now().toString();
                reports.set(reportId, { userId: user.id, username: user.username, url });

                bot.sendMessage(msg.chat.id, message, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "📨 Adminga yuborish", callback_data: `report_${reportId}` }]
                        ]
                    }
                });
            } else {
                bot.sendMessage(msg.chat.id, message);
            }

        } catch (err) {
            console.error(err.response?.data || err.message);
            bot.sendMessage(msg.chat.id, "❌ Xatolik yuz berdi.");
        }

    });

}