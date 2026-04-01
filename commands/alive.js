import { sendReply } from '../lib/helpers.js';

export default {
    name: 'alive',
    description: 'Check bot status',
    aliases: ['status', 'runtime'],
    
    async execute({ sock, msg}) {
        try {
            const jid = msg.key.remoteJid;
            
            const uptime = process.uptime();
            const hrs = Math.floor(uptime / 3600);
            const mins = Math.floor((uptime % 3600) / 60);
            const secs = Math.floor(uptime % 60);
            
            const statusText = `👹 *𝑪𝑹𝑰𝑴𝑺𝑶𝑵-𝑴𝑫-𝑩𝑶𝑻*\n\n🎉 𝐔𝐩𝐭𝐢𝐦𝐞: ${hrs}h ${mins}m ${secs}s\n⚡ 𝐒𝐭𝐚𝐭𝐮𝐭: 𝐀𝐜𝐭𝐢𝐯𝐞\n\n👺 Bot du clan Crimson ! Cree Par Dev Shadow Tech.`;
            
            // Image depuis une URL
            const imageUrl = 'https://files.catbox.moe/zqr8he.jpeg'; // Remplacez par votre URL
            
            await sock.sendMessage(jid, {
                image: { url: imageUrl },
                caption: statusText,
                mimetype: 'image/jpeg'
            }, { quoted: msg });
            
        } catch (error) {
            console.error('Alive Command Error:', error.message);
            // Fallback: envoyer seulement le texte
            await sendReply(sock, jid, `❤️ *Love-XD*\n⏱️ *Uptime*: ${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`, { quoted: msg });
        }
    }
};