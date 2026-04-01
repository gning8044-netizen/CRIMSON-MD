import { sendReply, formatError } from '../lib/helpers.js';

export default {
    name: 'tag',
    aliases: ['tagall', 'hidetag', 'everyone'],
    description: 'Mentionne tous les membres du groupe',
    
    async execute({ sock, msg, args, phoneNumber, userSettings }) {
        const jid = msg.key.remoteJid;
        const body = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || '';
        
        const commandName = body.slice(userSettings.prefix.length).trim().split(/\s+/)[0].toLowerCase();

        if (!jid.endsWith('@g.us')) {
            return sendReply(sock, jid, formatError('❌ Cette commande fonctionne uniquement dans les groupes'), { quoted: msg });
        }

        try {
            let groupPic;
            try {
                groupPic = await sock.profilePictureUrl(jid, 'image');
            } catch {
                groupPic = 'https://i.ibb.co/SDd09XR9/425104bcd93b.jpg';
            }

            if (commandName === 'tagall' || commandName === 'everyone') {
                await handleTagAll(sock, msg, args, phoneNumber, groupPic);
            } else if (commandName === 'tag' || commandName === 'hidetag') {
                await handleHideTag(sock, msg, args, phoneNumber, groupPic);
            }
        } catch (error) {
            console.error(`❌ [${phoneNumber}] Erreur:`, error.message);
            await sendReply(sock, jid, formatError(error.message), { quoted: msg });
        }
    }
};

async function handleTagAll(sock, msg, args, phoneNumber, groupPic) {
    const jid = msg.key.remoteJid;
    const groupMetadata = await sock.groupMetadata(jid);
    const participants = groupMetadata.participants;
    const mentions = participants.map(p => p.id);
    const customMessage = args.join(' ').trim();
    
    const now = new Date();
    const date = now.toLocaleDateString('fr-FR');
    const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    let text = `❤️ *L O V E - X D - B O T* ❤️\n\n`;
    
    if (customMessage) {
        text += `📝 *Message:* ${customMessage}\n\n`;
    }
    
    text += `👥 *Total:* ${participants.length} Membres\n`;
    text += `📅 ${date} • ⏰ ${time}\n\n`;
    text += `┌─⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷\n`;
    
    participants.slice(0, 30).forEach((p, i) => {
        const isAdmin = p.admin === 'admin' || p.admin === 'superadmin';
        text += `│ ${isAdmin ? '👑' : '👤'} ${i+1}. @${p.id.split('@')[0]}\n`;
    });
    
    if (participants.length > 30) {
        text += `│\n│ ... +${participants.length - 30} Autres\n`;
    }
    
    text += `└─⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷\n\n`;
    text += `⚡ *Powered By DarkMods* ⚡`;

    await sock.sendMessage(jid, {
        text: text,
        mentions: mentions,
        contextInfo: {
            externalAdReply: {
                title: groupMetadata.subject,
                thumbnailUrl: groupPic,
                mediaType: 1,
                renderLargerThumbnail: true
            }
        }
    }, { quoted: msg });
}

async function handleHideTag(sock, msg, args, phoneNumber, groupPic) {
    const jid = msg.key.remoteJid;
    const groupMetadata = await sock.groupMetadata(jid);
    const participants = groupMetadata.participants;
    const mentions = participants.map(p => p.id);

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
    const customMessage = args.join(' ').trim();
    
    let text;
    if (quotedText) {
        text = `✨ *Message De* @${msg.key.participant?.split('@')[0] || phoneNumber} ✨\n\n`;
        text += `┌─⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷\n`;
        text += `│ ${quotedText}\n`;
        text += `└─⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷\n\n`;
        text += `👥 *Mentionne ${participants.length} Membres*`;
    } else {
        const msgContent = customMessage || '🔔 Attention Tous Les Membres !';
        text = `🌟 *LOVE-XD HIDETAG* 🌟\n\n`;
        text += `┌─⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷\n`;
        text += `│ ${msgContent}\n`;
        text += `└─⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷\n\n`;
        text += `👥 *${participants.length} Membres Concernés*`;
    }

    try {
        await sock.sendMessage(jid, { delete: msg.key });
    } catch (error) {}
    
    await new Promise(resolve => setTimeout(resolve, 500));

    await sock.sendMessage(jid, {
        text: text,
        mentions: mentions,
        contextInfo: {
            externalAdReply: {
                title: groupMetadata.subject,
                thumbnailUrl: groupPic,
                mediaType: 1,
                renderLargerThumbnail: true
            }
        }
    });
};