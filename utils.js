// Fayl turi filtr
export function isAllowedFile(filename) {
    const banned = ['.apk', '.mp4', '.avi', '.mov', '.doc', '.docx', '.exe'];
    return !banned.some(ext => filename.endsWith(ext));
}

// Inline tugmalar dizayni
export function getInlineKeyboard() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🔁 Yangi link yuborish", callback_data: "new_link" }],
                [{ text: "📤 Javobni adminga yuborish", callback_data: "send_admin" }]
            ]
        }
    };
}

// VirusTotal natijalarini O'zbekcha xabar formatlash
export function formatStatsUz(stats, safePercent, engineDetails) {
    return `
📊 **Xavfsizlik tahlili:**
- Zararsiz (Harmless): ${stats.harmless}
- Zararli (Malicious): ${stats.malicious}
- Shubhali (Suspicious): ${stats.suspicious}
- Aniqlanmagan (Undetected): ${stats.undetected}

🖥️  Antivirus dasturlari natijalari: 
- Umumiy xavfsizlik foiz: ${safePercent}%
 

ℹ️ Link tekshiruvi Unicon Soft tomonidan amalga oshirildi
`;
}