import fs from "fs";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const VIRUSTOTAL_API_KEY = process.env.VT_API_KEY;
const ADMIN_ID = Number(process.env.ADMIN_ID);

const USERS_FILE = "./users.json";

// ===== JSON helper =====
function getUsers() {
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");
  return JSON.parse(fs.readFileSync(USERS_FILE));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function addUser(userData) {
  const users = getUsers();
  let user = users.find(u => u.id === userData.id);
  if (!user) {
    user = { id: userData.id, username: userData.username || "NoUsername", blocked: false, actions: [] };
    users.push(user);
    saveUsers(users);
  } else if (!Array.isArray(user.actions)) user.actions = [];
  return user;
}

function logAction(userId, action) {
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return;
  if (!Array.isArray(user.actions)) user.actions = [];
  user.actions.push({ date: new Date().toISOString(), action });
  saveUsers(users);
}

// ===== VirusTotal API =====
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

const reports = new Map();
function isValidUrl(text) { try { new URL(text); return true; } catch { return false; } }

// ========================
// Main function
// ========================
export function setupLinkScanner(bot) {
  // Flag faqat inline knopka bosilganda xabarlarni qabul qiladi
  let scannerActiveUsers = new Set();

  // Inline query orqali ishga tushiriladi
  bot.on("callback_query", (query) => {
    if (!query.message || !query.message.chat) return;

    const userId = query.from.id;

    // Inline knopka "scanner" bosilganda
    if (query.data === "scanner") {
      const user = addUser(query.from);
      if (user.blocked) {
        return bot.answerCallbackQuery(query.id, { text: "🚫 Siz bloklangansiz.", show_alert: true });
      }

      scannerActiveUsers.add(userId); // Shu user linkScanner uchun faollashdi
      bot.sendMessage(userId, "🔍 Link Scanner ishga tushdi! URL yuboring.");
      bot.answerCallbackQuery(query.id);
    }

    // Admin ga yuborish tugmasi
    if (query.data.startsWith("report_")) {
      const reportId = query.data.split("_")[1];
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

  // Message listener faqat scannerActiveUsers ichidagi foydalanuvchilar uchun ishlaydi
  bot.on("message", async (msg) => {
    const userId = msg.from.id;
    if (!scannerActiveUsers.has(userId)) return; // agar foydalanuvchi inline knopka bosmagan bo‘lsa

    if (!msg.text || msg.text.startsWith("/")) return;

    const user = addUser(msg.from);
    if (user.blocked) return bot.sendMessage(userId, "🚫 Siz bloklangansiz.");

    const url = msg.text.trim();
    if (!isValidUrl(url)) return bot.sendMessage(userId, "❌ To‘g‘ri URL yuboring.");

    logAction(user.id, `URL yubordi: ${url}`);
    bot.sendMessage(userId, "🔍 Tekshirilmoqda...");

    try {
      const id = await submitUrl(url);
      const analysis = await waitForCompletion(id);
      if (!analysis) return bot.sendMessage(userId, "⏳ Tekshiruv tugamadi.");

      const stats = analysis.stats;
      const malicious = stats.malicious || 0;
      const suspicious = stats.suspicious || 0;
      const harmless = stats.harmless || 0;

      let status = "🟢 XAVFSIZ";
      if (malicious > 0) status = "🔴 XAVFLI";
      else if (suspicious > 0) status = "🟡 SHUBHALI";

      const message = `
╔════════════════
🌐 ${url}
╚════════════════

🛡 Holat: ${status}
⚠️ Havf darajasi: ${malicious + suspicious}%
🔎  antiviruslar: ${harmless + suspicious + malicious}
⚠️ Havfli: ${malicious}
🚷 Shubhali: ${suspicious} 
✅ Xavfsiz: ${harmless} ta si havfsiz deb baholadi
🔰 70 ta antivuruslar orqali tekshirildi 
💠 Ma'lumotlar Unicon-Soft hodimlari tomonidan yaratildi
`;

      if (malicious > 0) {
        const reportId = Date.now().toString();
        reports.set(reportId, { userId: user.id, username: user.username, url });

        bot.sendMessage(userId, message, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "📨 Adminga yuborish", callback_data: `report_${reportId}` }]
            ]
          }
        });
      } else {
        bot.sendMessage(userId, message);
      }
    } catch (err) {
      console.error(err.response?.data || err.message);
      bot.sendMessage(userId, "❌ Xatolik yuz berdi.");
    }
  });
}