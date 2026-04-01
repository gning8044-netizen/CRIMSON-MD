import { sendReply, formatError, formatSuccess } from '../lib/helpers.js';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

export default {
    name: 'utils',
    aliases: ['getpp', 'pp', 'profilepic', 'avatar', 'setpp', 'jid', 'idch'],
    description: 'Commandes utilitaires diverses',

    async execute({ sock, msg, args, phoneNumber, userSettings }) {
        const jid = msg.key.remoteJid;
        const body = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || '';
        
        const commandName = body.slice(userSettings.prefix.length).trim().split(/\s+/)[0].toLowerCase();

        try {
            switch (commandName) {
                case 'getpp':
                case 'pp':
                case 'profilepic':
                case 'avatar':
                    await handleGetPP(sock, msg, args, phoneNumber);
                    break;
                    
                case 'setpp':
                    await handleSetPP(sock, msg, args, phoneNumber);
                    break;
                    
                case 'jid':
                    await handleJID(sock, msg, phoneNumber);
                    break;
                    
                case 'idch':
                    await handleIDCH(sock, msg, phoneNumber);
                    break;
            }
        } catch (error) {
            console.error(`❌ [${phoneNumber}] Erreur ${commandName}:`, error.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            await sendReply(sock, jid, formatError(`Erreur: ${error.message}`), { quoted: msg });
        }
    }
};

// ========== GETPP - Récupérer photo de profil ==========
async function handleGetPP(sock, msg, args, phoneNumber) {
    const jid = msg.key.remoteJid;
    const isGroup = jid.endsWith('@g.us');

    try {
        let targetJid = null;
        let targetName = '';
        let isGroupPic = false;

        // CAS 1: Dans un groupe sans arguments → Photo du groupe
        if (isGroup && args.length === 0 && !msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
            targetJid = jid;
            isGroupPic = true;
            
            try {
                const metadata = await sock.groupMetadata(jid);
                targetName = metadata.subject;
            } catch (err) {
                targetName = 'Groupe';
            }
        }
        // CAS 2: Réponse à un message → Photo de l'utilisateur cité
        else if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quotedParticipant = msg.message.extendedTextMessage.contextInfo.participant;
            if (quotedParticipant) {
                targetJid = quotedParticipant;
                targetName = quotedParticipant.split('@')[0];
            } else {
                // Si c'est une réponse dans un groupe sans participant spécifique
                targetJid = jid;
                targetName = isGroup ? 'Groupe' : jid.split('@')[0];
                isGroupPic = isGroup;
            }
        }
        // CAS 3: Mention d'un utilisateur → Photo de l'utilisateur mentionné
        else if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            const mentionedJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            targetJid = mentionedJid;
            targetName = mentionedJid.split('@')[0];
        }
        // CAS 4: Numéro fourni en argument
        else if (args.length > 0) {
            let number = args[0].replace(/[^0-9]/g, '');
            if (number.length < 8) {
                return await sendReply(sock, jid, formatError('Numéro invalide. Format: !getpp 237xxxxxxxxx'), { quoted: msg });
            }
            targetJid = number + '@s.whatsapp.net';
            targetName = number;
        }
        // CAS 5: En privé sans arguments → Photo de l'interlocuteur
        else if (!isGroup) {
            targetJid = jid;
            targetName = jid.split('@')[0];
        }
        // CAS 6: Aucune cible identifiable
        else {
            const helpMsg = `📸 *GetPP - Usage*\n\n` +
                           `• Dans un groupe: !getpp → Photo du groupe\n` +
                           `• Répondre à un message: !getpp → Photo de l'utilisateur\n` +
                           `• Mentionner: !getpp @user → Photo de l'utilisateur\n` +
                           `• Numéro: !getpp 237xxx → Photo du contact\n\n` +
                           `> 𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 DEV SHADOW TECH`;
            return await sendReply(sock, jid, helpMsg, { quoted: msg });
        }

        // Réaction de chargement
        await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

        // Récupérer la photo de profil
        let ppUrl = null;
        try {
            ppUrl = await sock.profilePictureUrl(targetJid, 'image');
        } catch (err) {
            if (err.message.includes('404') || err.message.includes('not-found')) {
                await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
                return await sendReply(sock, jid, 
                    `❌ ${isGroupPic ? 'Ce groupe' : targetName} n'a pas de photo de profil.\n\n> 𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 DEV SHADOW TECH`, 
                    { quoted: msg }
                );
            }
            throw err;
        }

        if (!ppUrl) {
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return await sendReply(sock, jid, 
                `❌ ${isGroupPic ? 'Ce groupe' : targetName} n'a pas de photo de profil.\n\n> 𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 DEV SHADOW TECH`, 
                { quoted: msg }
            );
        }

        // Envoyer la photo
        await sock.sendMessage(jid, {
            image: { url: ppUrl },
            caption: `📸 Photo de profil: ${targetName}\n\n> 𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 DEV SHADOW TECH`
        }, { quoted: msg });

        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        console.log(`✅ [${phoneNumber}] Photo de profil récupérée: ${targetName}`);

    } catch (error) {
        console.error(`❌ [${phoneNumber}] Erreur getpp:`, error.message);
        throw error;
    }
}

// ========== SETPP - Définir photo de profil ==========
async function handleSetPP(sock, msg, args, phoneNumber) {
    const jid = msg.key.remoteJid;
    const isGroup = jid.endsWith('@g.us');

    try {
        // Vérifier qu'on répond à un message avec image
        const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const imageMessage = quotedMessage?.imageMessage;

        if (!imageMessage) {
            const helpMsg = `🖼️ *SetPP - Usage*\n\n` +
                           `• Répondez à une image avec: !setpp\n` +
                           `• Pour le groupe: Le bot doit être admin\n` +
                           `• Pour le bot: Photo de profil du bot\n\n` +
                           `> 𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 DEV SHADOW TECH`;
            return await sendReply(sock, jid, helpMsg, { quoted: msg });
        }

        await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

        // Télécharger l'image
        const buffer = await downloadMediaMessage(
            { 
                message: quotedMessage,
                key: msg.key
            },
            'buffer',
            {},
            { 
                logger: { level: 'silent', log: () => {} },
                reuploadRequest: sock.updateMediaMessage
            }
        );

        if (!buffer || buffer.length === 0) {
            throw new Error('Impossible de télécharger l\'image');
        }

        // Définir comme photo de profil
        if (isGroup) {
            // Pour un groupe - vérifier si le bot est admin
            const groupMetadata = await sock.groupMetadata(jid);
            const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const isAdmin = groupMetadata.participants.some(p => p.id === botJid && p.admin);
            
            if (!isAdmin) {
                await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
                return await sendReply(sock, jid, 
                    formatError('❌ Le bot doit être admin pour changer la photo du groupe.\n\n> 𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 DEV SHADOW TECH'), 
                    { quoted: msg }
                );
            }
            
            await sock.updateProfilePicture(jid, buffer);
            await sendReply(sock, jid, 
                formatSuccess('✅ Photo de profil du groupe mise à jour avec succès!\n\n> 𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 DEV SHADOW TECH'), 
                { quoted: msg }
            );
        } else {
            // Pour le bot lui-même
            const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            await sock.updateProfilePicture(botJid, buffer);
            await sendReply(sock, jid, 
                formatSuccess('✅ Photo de profil du bot mise à jour avec succès!\n\n> 𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 DEV SHADOW TECH'), 
                { quoted: msg }
            );
        }

        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        console.log(`✅ [${phoneNumber}] Photo de profil mise à jour`);

    } catch (error) {
        console.error(`❌ [${phoneNumber}] Erreur setpp:`, error.message);
        
        if (error.message.includes('forbidden') || error.message.includes('403')) {
            return await sendReply(sock, jid, 
                formatError('❌ Permission refusée. Le bot doit être admin pour changer la photo du groupe.\n\n> 𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 DEV SHADOW TECH'), 
                { quoted: msg }
            );
        }
        
        throw error;
    }
}

// ========== JID - Obtenir JID d'un groupe ==========
async function handleJID(sock, msg, phoneNumber) {
    const jid = msg.key.remoteJid;
    const isGroup = jid.endsWith('@g.us');

    try {
        if (!isGroup) {
            return await sendReply(sock, jid, 
                formatError('❌ Cette commande fonctionne uniquement dans les groupes\n\n> 𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐃𝐚𝐫𝐤𝐌𝐨𝐝𝐬'), 
                { quoted: msg }
            );
        }

        // Récupérer les métadonnées du groupe
        const metadata = await sock.groupMetadata(jid);
        
        // Récupérer les admins
        const admins = metadata.participants
            .filter(p => p.admin)
            .map(p => p.id);

        const response = `📊 *INFORMATIONS DU GROUPE*\n\n` +
                        `📝 *Nom:* ${metadata.subject}\n` +
                        `🆔 *JID:* \`${jid}\`\n` +
                        `👥 *Membres:* ${metadata.participants.length}\n` +
                        `👑 *Admins:* ${admins.length}\n` +
                        `📅 *Créé le:* ${new Date(metadata.creation * 1000).toLocaleDateString('fr-FR')}\n` +
                        `🔑 *Propriétaire:* ${metadata.owner ? '@' + metadata.owner.split('@')[0] : 'Non défini'}\n\n` +
                        `> 𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 DEV SHADOW TECH`;

        await sendReply(sock, jid, response, { 
            quoted: msg,
            mentions: metadata.owner ? [metadata.owner] : []
        });

        console.log(`✅ [${phoneNumber}] JID du groupe récupéré: ${jid}`);

    } catch (error) {
        console.error(`❌ [${phoneNumber}] Erreur jid:`, error.message);
        throw error;
    }
}

// ========== IDCH - Obtenir JID d'une chaîne ==========
async function handleIDCH(sock, msg, phoneNumber) {
    const jid = msg.key.remoteJid;
    const isNewsletter = jid.includes('@newsletter');

    try {
        // Vérifier si c'est une chaîne
        if (!isNewsletter) {
            const helpMsg = `📢 *IDCH - Obtenir l'ID d'une chaîne*\n\n` +
                           `❌ Cette commande fonctionne uniquement dans les chaînes WhatsApp.\n\n` +
                           `📝 *Comment utiliser:*\n` +
                           `• Allez dans une chaîne WhatsApp\n` +
                           `• Envoyez la commande: !idch\n` +
                           `• Le bot vous donnera l'ID de la chaîne\n\n` +
                           `> 𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 DEV SHADOW TECH`;
            return await sendReply(sock, jid, helpMsg, { quoted: msg });
        }

        // Réaction de chargement
        await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

        // Extraire l'ID de la chaîne
        const channelId = jid.split('@')[0];
        
        // Essayer de récupérer les infos de la chaîne si disponibles
        let channelName = 'Chaîne WhatsApp';
        let channelDesc = '';
        
        try {
            // Tentative de récupération des métadonnées de la chaîne
            if (sock.getNewsletterInfo) {
                const newsletterInfo = await sock.getNewsletterInfo(jid);
                if (newsletterInfo) {
                    channelName = newsletterInfo.name || channelName;
                    channelDesc = newsletterInfo.description || '';
                }
            }
        } catch (err) {
            // Ignorer l'erreur, on utilise les infos par défaut
            console.log('Impossible de récupérer les infos de la chaîne:', err.message);
        }

        // Construire la réponse
        let response = `📢 *INFORMATIONS DE LA CHAÎNE*\n\n` +
                      `📝 *Nom:* ${channelName}\n` +
                      `🆔 *JID complet:* \`${jid}\`\n` +
                      `🔢 *ID de la chaîne:* \`${channelId}\`\n` +
                      `📱 *Type:* ${jid.includes('@newsletter') ? 'Newsletter' : 'Chaîne WhatsApp'}\n`;
        
        if (channelDesc) {
            response += `📄 *Description:* ${channelDesc}\n`;
        }
        
        response += `\n💡 *Utilisation:*\n` +
                   `• Cet ID peut être utilisé pour:\n` +
                   `  - Cibler cette chaîne avec des commandes\n` +
                   `  - Configurer des fonctionnalités spécifiques\n` +
                   `  - Partager l'identifiant unique de la chaîne\n\n` +
                   `> 𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 DEV SHADOW TECH`;

        // Envoyer la réponse
        await sendReply(sock, jid, response, { quoted: msg });
        
        // Réaction de succès
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        
        console.log(`✅ [${phoneNumber}] Id de la chaîne récupéré: ${jid}`);

    } catch (error) {
        console.error(`❌ [${phoneNumber}] Erreur idch:`, error.message);
        
        // Message d'erreur plus détaillé
        let errorMsg = `❌ *Erreur lors de la récupération de l'ID*\n\n`;
        errorMsg += `Message: ${error.message}\n\n`;
        errorMsg += `📝 *Assurez-vous:*\n`;
        errorMsg += `• D'être dans une chaîne WhatsApp valide\n`;
        errorMsg += `• Que la chaîne est accessible\n`;
        errorMsg += `• Que le bot a les permissions nécessaires\n\n`;
        errorMsg += `> 𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 DEV SHADOW TECH`;
        
        await sendReply(sock, jid, errorMsg, { quoted: msg });
        throw error;
    }
};