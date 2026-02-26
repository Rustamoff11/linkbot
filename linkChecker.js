import axios from 'axios';
import { VIRUSTOTAL_KEY } from './config.js';

export async function checkLink(url) {
    try {
        const response = await axios.post(
            'https://www.virustotal.com/api/v3/urls',
            new URLSearchParams({ url }),
            { headers: { "x-apikey": VIRUSTOTAL_KEY } }
        );

        const analysisId = response.data.data.id;

        // Tekshirish natijasi uchun kutish
        let analysis;
        for (let i = 0; i < 5; i++) {
            const res = await axios.get(
                `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
                { headers: { "x-apikey": VIRUSTOTAL_KEY } }
            );

            analysis = res.data.data.attributes;
            if(analysis.status === "completed") break;
            await new Promise(r => setTimeout(r, 3000));
        }

        if(analysis.status !== "completed") return null;

        const stats = analysis.stats;
        const total = stats.harmless + stats.malicious + stats.suspicious + stats.undetected;
        const safePercent = ((stats.harmless / total) * 100).toFixed(2);

        // Detallangan engine natijalari
        const engines = analysis.results || {};
        let engineDetails = "";
        for(const [engine, result] of Object.entries(engines)) {
            engineDetails += `🔹 ${engine}: ${result.category || 'No info'}\n`;
        }

        return { safePercent, stats, engineDetails };

    } catch(err) {
        console.error("VirusTotal xato:", err.message);
        return null;
    }
}