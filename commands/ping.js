import { sendReply } from '../lib/helpers.js';

export default {
    name: 'ping',
    description: 'Check bot latency',
    
    async execute({ sock, msg, phoneNumber }) {
        try {
            const jid = msg.key.remoteJid;
            const start = Date.now();
            
            await sock.sendMessage(jid, { 
                react: { text: '⭐', key: msg.key } 
            });
            
            const latency = Date.now() - start;
            
            // Déterminer l'état de la latence
            let statusEmoji = '⚡';
            let imageUrl = '';
            
            if (latency <= 500) {
                statusEmoji = '⚡';
                imageUrl = 'https://files.catbox.moe/zqr8he.jpeg'; // Remplace par ton URL d'image
            } else if (latency > 500 && latency <= 1000) {
                statusEmoji = '📡';
                imageUrl = 'https://files.catbox.moe/zqr8he.jpeg'; // Remplace par ton URL d'image
            } else if (latency > 1000 && latency <= 2000) {
                statusEmoji = '🐢';
                imageUrl = 'https://files.catbox.moe/zqr8he.jpeg'; // Remplace par ton URL d'image
            } else {
                statusEmoji = '😴';
                imageUrl = 'https://files.catbox.moe/zqr8he.jpeg'; // Remplace par ton URL d'image
            }
            
            const pingText = `> *PONG!* ${statusEmoji}\n\n> 👻 Latence: ${latency}ms\n\n> *Cette Bot A Eté Cree Par Dev Shadow Tech.*`;
            
            // Envoyer l'image avec le texte
            await sock.sendMessage(jid, {
                image: {
                    url: imageUrl
                },
                caption: pingText
            }, { quoted: msg });
            
        } catch (error) {
            console.error(`❌ Ping command error for ${phoneNumber}:`, error);
            
            // Fallback: envoyer seulement le texte
            try {
                const start = Date.now();
                const latency = Date.now() - start;
                let statusEmoji = '⚡';
                if (latency > 1000) statusEmoji = '🐢';
                if (latency > 2000) statusEmoji = '😴';
                
                const pingTextFallback = `> *PONG!* ${statusEmoji}\n\n> 🤭 Latence: ${latency}ms\n> \n> *guél la beugue.*`;
                await sendReply(sock, jid, pingTextFallback, { quoted: msg });
            } catch (e) {
                console.error('Fallback error:', e);
            }
        }
    }
};