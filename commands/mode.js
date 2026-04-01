import { sendReply, formatSuccess, formatError } from '../lib/helpers.js';
import Database from '../lib/database.js';
import { isOwner } from '../lib/isAdmin.js';
import config from '../config.js';

export default {
    name: 'private',
    aliases: ['public'],
    description: 'Change bot access mode',
    
    async execute({ sock, msg, args, userSettings }) {
        const jid = msg.key.remoteJid;
        const phoneNumber = config.owner; // ⭐ MODIFICATION
        
        // Vérification owner
        if (!isOwner(msg)) { // ⭐ MODIFICATION: Supprimer phoneNumber
            return sendReply(sock, jid, 
                formatError('Only the bot owner can change access mode.'), 
                { quoted: msg }
            );
        }

        const command = msg.message.conversation?.toLowerCase() || 
                       msg.message.extendedTextMessage?.text?.toLowerCase() || '';
        
        let newMode;
        if (command.includes('private')) {
            newMode = 'private';
        } else if (command.includes('public')) {
            newMode = 'public';
        } else {
            // Afficher le statut actuel
            const currentMode = userSettings.bot_mode || 'public';
            return sendReply(sock, jid, 
                `🔒 *Current Mode:* ${currentMode.toUpperCase()}\n\n` +
                `*Commands:*\n` +
                `• ${userSettings.prefix}private - Private mode (owner only)\n` +
                `• ${userSettings.prefix}public - Public mode (everyone)`,
                { quoted: msg }
            );
        }

        try {
            // ⭐ MODIFICATION: Mettre à jour directement les settings
            await Database.updateUserSettings({ bot_mode: newMode });
            
            const modeText = newMode === 'private' ? 
                '🔒 PRIVATE - Bot du clan crimson' : 
                '🔓 PUBLIC - Bot du clan crimson';
                
            await sendReply(sock, jid, 
                formatSuccess(modeText), 
                { quoted: msg }
            );
            
            console.log(`🔄 Bot mode updated: ${newMode}`);
            
        } catch (error) {
            console.error('Error updating mode:', error);
            await sendReply(sock, jid, 
                formatError('Database error. Please try again.'), 
                { quoted: msg }
            );
        }
    }
};