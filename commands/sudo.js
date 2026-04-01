// commands/sudo.js
import { sendReply, formatSuccess, formatError } from '../lib/helpers.js';
import sudoManager from '../lib/sudoManager.js';
import { isOwner } from '../lib/isAdmin.js';
import config from '../config.js';

export default {
    name: 'sudo',
    aliases: ['addsudo', 'makesudo'],
    description: 'Add a user as sudo (can use bot in private mode)',
    usage: 'sudo @user or sudo (reply to user message)',
    
    async execute({ sock, msg, args, jid, isGroup }) {
        try {
            const phoneNumber = config.owner;
            
            // Vérifier si c'est le propriétaire (sécurité supplémentaire)
            if (!isOwner(msg)) { // ⭐ MODIFICATION: Supprimer phoneNumber
                return await sendReply(sock, jid, 
                    formatError('❌ Only the bot owner can use this command'), 
                    { quoted: null }
                );
            }
            
            let targetUserJid = '';
            
            // Méthode 1: Mention dans le message
            const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentions.length > 0) {
                targetUserJid = mentions[0];
            }
            // Méthode 2: Réponse à un message (priorité au participant)
            else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
                targetUserJid = msg.message.extendedTextMessage.contextInfo.participant;
            }
            // Méthode 3: Réponse à un message (stanzaId pour les LID)
            else if (msg.message?.extendedTextMessage?.contextInfo?.stanzaId) {
                const quotedMsg = msg.message.extendedTextMessage.contextInfo;
                targetUserJid = quotedMsg.participant || quotedMsg.remoteJid;
            }
            // Méthode 4: Argument direct (numéro de téléphone)
            else if (args[0]) {
                const cleanNumber = args[0].replace(/[^0-9]/g, '');
                if (cleanNumber.length > 0) {
                    targetUserJid = cleanNumber + '@s.whatsapp.net';
                }
            }
            else {
                return await sendReply(sock, jid, 
                    formatError('❌ Usage: sudo @user\nOr reply to user message with: sudo'), 
                    { quoted: null }
                );
            }
            
            // Vérifier que l'utilisateur cible est valide
            if (!targetUserJid || (!targetUserJid.includes('@s.whatsapp.net') && !targetUserJid.includes('@lid'))) {
                return await sendReply(sock, jid, formatError('❌ Invalid user'), { quoted: null });
            }
            
            // Ne pas ajouter le propriétaire comme sudo (il l'est déjà par défaut)
            const targetNumber = targetUserJid.split('@')[0].split(':')[0];
            if (targetNumber === phoneNumber) {
                return await sendReply(sock, jid, 
                    formatError('❌ You are already the owner, no need to add yourself as sudo'), 
                    { quoted: null }
                );
            }
            
            // ⭐ MODIFICATION: Supprimer phoneNumber
            const success = sudoManager.addSudoUser(targetUserJid);
            
            if (success) {
                const displayNumber = targetUserJid.split('@')[0];
                
                await sock.sendMessage(jid, {
                    image: {
                        url: 'https://i.postimg.cc/vZ9Tb4Dx/IMG_20260126_WA0045.jpg'
                    },
                    caption: formatSuccess(`> _*SUDO PRIVILEGES GRANTED*_\n\n👤 User: ${displayNumber}\n`),
                    mentions: [targetUserJid]
                }, { quoted: null });
                
            } else {
                await sock.sendMessage(jid, {
                    image: {
                        url: 'https://i.postimg.cc/vZ9Tb4Dx/IMG_20260126_WA0045.jpg'
                    },
                    caption: formatError('❌ *USER ALREADY SUDO*\n\nThis user already has sudo privileges.\nNo action required.'),
                    mentions: [targetUserJid]
                }, { quoted: null });
            }
            
        } catch (error) {
            console.error(`❌ Sudo command error:`, error); // ⭐ MODIFICATION: Supprimer phoneNumber
            
            await sock.sendMessage(jid, {
                image: {
                    url: 'https://i.postimg.cc/vZ9Tb4Dx/IMG_20260126_WA0045.jpg'
                },
                caption: formatError(`💥 *COMMAND ERROR*\n\nError: ${error.message}\n\nPlease try again or contact support.`)
            }, { quoted: null });
        }
    }
};