import fs from "fs";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const VIRUSTOTAL_API_KEY = process.env.VT_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const ADMIN_ID = Number(process.env.ADMIN_ID);

const USERS_FILE = "./users.json";


// ================= JSON Helper =================

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
    user = { id: userData.id, username: userData.username || "NoUsername", blocked: false };
    users.push(user);
    saveUsers(users);
  }
  return user;
}


// ================= URL VALIDATION =================

function isValidUrl(text) {
  try { new URL(text); return true; }
  catch { return false; }
}


// ================= VIRUSTOTAL =================

async function scanVirusTotal(url) {
  const submit = await axios.post(
    "https://www.virustotal.com/api/v3/urls",
    new URLSearchParams({ url }),
    { headers: { "x-apikey": VIRUSTOTAL_API_KEY } }
  );

  const id = submit.data.data.id;

  for (let i = 0; i < 10; i++) {
    const result = await axios.get(
      `https://www.virustotal.com/api/v3/analyses/${id}`,
      { headers: { "x-apikey": VIRUSTOTAL_API_KEY } }
    );

    if (result.data.data.attributes.status === "completed") {
      return result.data.data.attributes.stats;
    }

    await new Promise(r => setTimeout(r, 3000));
  }

  return null;
}


// ================= GOOGLE SAFE BROWSING =================

async function scanGoogleSafe(url) {
  const response = await axios.post(
    `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${GOOGLE_API_KEY}`,
    {
      client: {
        clientId: "telegram-scan-bot",
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

  return response.data;
}


// ================= MAIN SETUP =================

export function setupLinkScanner(bot) {

  bot.on("message", async (msg) => {

    if (!msg.text || msg.text.startsWith("/")) return;

    const user = addUser(msg.from);
    if (user.blocked) return bot.sendMessage(msg.chat.id, "🚫 Siz bloklangansiz.");

    const url = msg.text.trim();
    if (!isValidUrl(url)) return;

    bot.sendMessage(msg.chat.id, "🔍 Tekshirilmoqda...");

    try {

      // 1️⃣ VirusTotal
      const vtStats = await scanVirusTotal(url);

      if (!vtStats) {
        return bot.sendMessage(msg.chat.id, "⏳ VirusTotal javob bermadi.");
      }

      const malicious = vtStats.malicious || 0;
      const suspicious = vtStats.suspicious || 0;
      const harmless = vtStats.harmless || 0;

      let vtStatus = "🟢 XAVFSIZ";
      if (malicious > 0) vtStatus = "🔴 XAVFLI";
      else if (suspicious > 0) vtStatus = "🟡 SHUBHALI";


      // 2️⃣ Google Safe Browsing
      const googleResult = await scanGoogleSafe(url);

      let googleStatus = "🟢 XAVFSIZ";

      if (googleResult.matches) {
        googleStatus = "🔴 XAVFLI";
      }


      // 3️⃣ Yakuniy Status
      let finalStatus = "🟢 XAVFSIZ";

      if (malicious > 0 || googleResult.matches) {
        finalStatus = "🔴 XAVFLI";
      } else if (suspicious > 0) {
        finalStatus = "🟡 SHUBHALI";
      }


      const message = `
╔══════════════════
🌐 ${url}
╚══════════════════

🛡 YAKUNIY HOLAT: ${finalStatus}

━━━━━━━━━━━━━━
🧪 birinchi scanner:
   Holat: ${vtStatus}
   🔴 Havfli: ${malicious}
   🟡 Shubhali: ${suspicious}
   ✅ Xavfsiz: ${harmless}ta antivirus havfsiz deb topdi

━━━━━━━━━━━━━━
🛡 Ikkinchi scaner:
   Holat: ${googleStatus}

━━━━━━━━━━━━━━
🔐 Unicon-Soft Oltiariq @ScannerLink_bot 
`;

      bot.sendMessage(msg.chat.id, message);

    } catch (err) {
      console.error(err.response?.data || err.message);
      bot.sendMessage(msg.chat.id, "❌ Xatolik yuz berdi.");
    }

  });
}