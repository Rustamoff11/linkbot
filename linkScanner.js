import fs from "fs";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const VIRUSTOTAL_API_KEY = process.env.VT_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

const USERS_FILE = "./users.json";

// 🔥 Aktiv scanner userlar
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
    user = { id: userData.id, username: userData.username || "NoUsername", blocked: false };
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

  // ❗ FAQAT BITTA LISTENER
  bot.on("message", async (msg) => {

    if (msg.from.is_bot) return;
    if (!msg.text || msg.text.startsWith("/")) return;

    const userId = msg.from.id;

    // 🔥 faqat aktiv userlar ishlaydi
    if (!activeScanners.has(userId)) return;

    const user = addUser(msg.from);
    if (user.blocked) {
      return bot.sendMessage(msg.chat.id, "🚫 Siz bloklangansiz.");
    }

    const url = msg.text.trim();
    if (!isValidUrl(url)) {
      return bot.sendMessage(msg.chat.id, "❗ Iltimos to‘g‘ri URL yuboring.");
    }

    activeScanners.delete(userId); // 🔥 1 martalik ishlash

    bot.sendMessage(msg.chat.id, "🔍 Tekshirilmoqda...");

    try {

      // VirusTotal
      const submit = await axios.post(
        "https://www.virustotal.com/api/v3/urls",
        new URLSearchParams({ url }),
        { headers: { "x-apikey": VIRUSTOTAL_API_KEY } }
      );

      const id = submit.data.data.id;

      let vtStats = null;

      for (let i = 0; i < 8; i++) {
        const result = await axios.get(
          `https://www.virustotal.com/api/v3/analyses/${id}`,
          { headers: { "x-apikey": VIRUSTOTAL_API_KEY } }
        );

        if (result.data.data.attributes.status === "completed") {
          vtStats = result.data.data.attributes.stats;
          break;
        }

        await new Promise(r => setTimeout(r, 2500));
      }

      if (!vtStats) {
        return bot.sendMessage(msg.chat.id, "⏳ VirusTotal javob bermadi.");
      }

      const malicious = vtStats.malicious || 0;
      const suspicious = vtStats.suspicious || 0;
      const harmless = vtStats.harmless || 0;

      let finalStatus = "🟢 XAVFSIZ";
      if (malicious > 0) finalStatus = "🔴 XAVFLI";
      else if (suspicious > 0) finalStatus = "🟡 SHUBHALI";

      const message = `
🌐 ${url}

🛡 Yakuniy holat: ${finalStatus}

🔴 Havfli: ${malicious}
🟡 Shubhali: ${suspicious}
✅ Xavfsiz: ${harmless}
`;

      bot.sendMessage(msg.chat.id, message);

    } catch (err) {
      console.error(err.response?.data || err.message);
      bot.sendMessage(msg.chat.id, "❌ Xatolik yuz berdi.");
    }

  });

}