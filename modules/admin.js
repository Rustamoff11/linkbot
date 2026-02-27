import fs from "fs";
import { ADMIN_ID } from "../config.js";

const USERS_FILE = "../users.json";

// ===== JSON helper =====
function readUsers() {
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");
  let content = fs.readFileSync(USERS_FILE, "utf-8");
  if (!content.trim()) content = "[]";
  try {
    return JSON.parse(content);
  } catch (err) {
    console.error("❌ JSON parse xato:", err);
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// ===== HTML escape =====
function escapeHTML(text = "") {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ===== Admin panel =====
export function setupAdminPanel(bot) {

  bot.removeTextListener(/\/admin/);

  bot.onText(/\/admin/, async (msg) => {
    try {
      if (msg.from.id !== Number(ADMIN_ID)) {
        return bot.sendMessage(msg.chat.id, "❌ Siz admin emassiz");
      }

      const users = readUsers();

      if (!Array.isArray(users) || users.length === 0) {
        return bot.sendMessage(msg.chat.id, "📂 Ma’lumot yo‘q");
      }

      let text = `🛡 <b>ADMIN PANEL</b>\n`;
      text += `📊 Jami foydalanuvchilar: <b>${users.length}</b>\n`;
      text += `─────────────────────────────\n\n`;

      const inlineKeyboard = [];

      users.slice(-50).reverse().forEach((u, i) => {
        text += `<b>${i + 1}) 👤 @${escapeHTML(u.username || "no_username")}</b>\n`;
        text += `🆔 ID: <code>${u.userId}</code>\n`;
        text += `📈 Umumiy harakatlar: <b>${u.total_actions || 0}</b>\n`;

        if (Array.isArray(u.actions) && u.actions.length > 0) {
          text += `📜 Oxirgi 3 harakat:\n`;
          const lastThree = u.actions.slice(-3).reverse();
          lastThree.forEach((a, idx) => {
            let feedbackText = a.feedback ? ` | Feedback: <b>${a.feedback}</b>` : "";
            text += `  ${idx + 1}) ${escapeHTML(a.text)} — <i>${a.time}</i>${feedbackText}\n`;
          });
        } else {
          text += `📜 Harakatlar: <i>Yo‘q</i>\n`;
        }

        // Bloklash/ochish tugmasi
        const btnText = u.blocked ? `✅ Bloklangan @${u.username}` : `🚫 Bloklash @${u.username}`;
        inlineKeyboard.push([{ text: btnText, callback_data: `block_${u.userId}` }]);

        text += `─────────────────────────────\n`;
      });

      // users.json tozalash tugmasi
      inlineKeyboard.push([{ text: "🧹 Users.json tozalash", callback_data: "clear_users" }]);

      await bot.sendMessage(msg.chat.id, text, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: inlineKeyboard }
      });

      // Inline callback listener
      bot.on("callback_query", (q) => {
        if (q.from.id !== Number(ADMIN_ID)) {
          return bot.answerCallbackQuery(q.id, { text: "❌ Siz admin emassiz", show_alert: true });
        }

        const data = q.data;

        // Foydalanuvchini bloklash/ochish
        if (data.startsWith("block_")) {
          const userId = Number(data.split("_")[1]);
          const users = readUsers();
          const user = users.find(u => u.userId === userId);
          if (!user) return;

          user.blocked = !user.blocked; // bloklash/ochish
          writeUsers(users);

          bot.answerCallbackQuery(q.id, { 
            text: user.blocked ? `✅ @${user.username} bloklandi` : `✅ @${user.username} blok ochildi`, 
            show_alert: true 
          });

          // Admin panelni yangilash
          bot.emit("text", { chat: { id: msg.chat.id }, from: { id: ADMIN_ID }, text: "/admin" });
        }

        // users.json tozalash
        if (data === "clear_users") {
          writeUsers([]);
          bot.answerCallbackQuery(q.id, { text: "✅ users.json fayli tozalandi", show_alert: true });
          bot.sendMessage(msg.chat.id, "📂 users.json fayli tozalandi!");
        }
      });

    } catch (err) {
      console.error("Admin panel xato:", err);
      bot.sendMessage(msg.chat.id, "❌ Xatolik yuz berdi");
    }
  });
}