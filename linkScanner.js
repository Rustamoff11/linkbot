import fs from "fs";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const VIRUSTOTAL_API_KEY = process.env.VT_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

const USERS_FILE = "./users.json";
const activeScanners = new Set();

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
    user = {
      id: userData.id,
      username: userData.username || "NoUsername",
      blocked: false
    };
    users.push(user);
    saveUsers(users);
  }

  return user;
}

function isValidUrl(text) {
  try { new URL(text); return true; }
  catch { return false; }
}

export function activateScanner(userId) {
  activeScanners.add(userId);
}

export function deactivateScanner(userId) {
  activeScanners.delete(userId);
}

export function setupLinkScanner(bot) {

  bot.on("message", async (msg) => {

    if (msg.from.is_bot) return;
    if (!msg.text || msg.text.startsWith("/")) return;

    const userId = msg.from.id;
    if (!activeScanners.has(userId)) return;

    const user = addUser(msg.from);
    if (user.blocked) {
      return bot.sendMessage(msg.chat.id, "🚫 Siz bloklangansiz.");
    }

    const url = msg.text.trim();
    if (!isValidUrl(url)) {
      return bot.sendMessage(msg.chat.id, "❗ Iltimos to‘g‘ri URL yuboring.");
    }

    activeScanners.delete(userId);

    await bot.sendMessage(msg.chat.id, "🔍 URL tekshirilmoqda...");

    try {

      // ================== VIRUSTOTAL ==================
      const submit = await axios.post(
        "https://www.virustotal.com/api/v3/urls",
        new URLSearchParams({ url }),
        { headers: { "x-apikey": VIRUSTOTAL_API_KEY } }
      );

      const analysisId = submit.data.data.id;
      let vtStats = null;

      for (let i = 0; i < 8; i++) {
        const result = await axios.get(
          `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
          { headers: { "x-apikey": VIRUSTOTAL_API_KEY } }
        );

        if (result.data.data.attributes.status === "completed") {
          vtStats = result.data.data.attributes.stats;
          break;
        }

        await new Promise(r => setTimeout(r, 2500));
      }

      // ================== GOOGLE SAFE BROWSING ==================
      const googleCheck = await axios.post(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${GOOGLE_API_KEY}`,
        {
          client: {
            clientId: "telegram-link-scanner",
            clientVersion: "1.0"
          },
          threatInfo: {
            threatTypes: [
              "MALWARE",
              "SOCIAL_ENGINEERING",
              "UNWANTED_SOFTWARE",
              "POTENTIALLY_HARMFUL_APPLICATION"
            ],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url }]
          }
        }
      );

      // ================== NATIJA HISOBLASH ==================

      let malicious = 0;
      let suspicious = 0;
      let harmless = 0;

      if (vtStats) {
        malicious = vtStats.malicious || 0;
        suspicious = vtStats.suspicious || 0;
        harmless = vtStats.harmless || 0;
      }

      const googleThreat = googleCheck.data.matches ? true : false;

      let finalStatus = "🟢 XAVFSIZ";
      let riskScore = 0;

      if (malicious > 0 || googleThreat) {
        finalStatus = "🔴 XAVFLI";
        riskScore = 90;
      } 
      else if (suspicious > 0) {
        finalStatus = "🟡 SHUBHALI";
        riskScore = 50;
      } 
      else {
        riskScore = 5;
      }

      // ================== CHIROYLI JAVOB ==================

      const resultMessage = `
━━━━━━━━━━━━━━━━━━
🔎 URL TEKSHIRUV NATIJASI
━━━━━━━━━━━━━━━━━━

🌐 Manzil:
${url}

🛡 Yakuniy holat:
${finalStatus}

📊 Risk darajasi:
${riskScore}%

━━━━━━━━━━━━━━━━━━
🧪 Birinchi tekshiruv:
🔴 Havfli: ${malicious}
🟡 Shubhali: ${suspicious}
✅ Xavfsiz: ${harmless}

🛡 ikkinchi tekshiruv:
${googleThreat ? "🔴 Tahdid aniqlangan" : "🟢 Tahdid topilmadi"}

━━━━━━━━━━━━━━━━━━

⚠️ Eslatma: Loyiha Unicon-Soft Oltiariq tumani hodimlari tomonidan yaratildi.
Hech qachon shubhali linklarga shaxsiy ma'lumot kiritmang.
━━━━━━━━━━━━━━━━━━
`;

      await bot.sendMessage(msg.chat.id, resultMessage);

    } catch (err) {
      console.error(err.response?.data || err.message);
      await bot.sendMessage(msg.chat.id, "❌ Tekshiruv vaqtida xatolik yuz berdi.");
    }

  });

}