import NodeCache from 'node-cache';
import Database from './database.js';
import sudoManager from './sudoManager.js';
import config from '../config.js';

// Cache pour les métadonnées des groupes (expire après 30 minutes)
const groupMetadataCache = new NodeCache({ stdTTL: 1800 });
const pendingRequests = new Map();
const rateLimitCache = new NodeCache({ stdTTL: 60 });

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getGroupMetadataWithCache(sock, chatId) {
    try {
        const cached = groupMetadataCache.get(chatId);
        if (cached) return cached;

        if (pendingRequests.has(chatId)) {
            return await pendingRequests.get(chatId);
        }

        const requestCount = rateLimitCache.get(chatId) || 0;
        if (requestCount > 5) {
            const backoffTime = Math.min(1000 * (requestCount - 5), 30000);
            await wait(backoffTime);
        }

        const requestPromise = (async () => {
            try {
                rateLimitCache.set(chatId, requestCount + 1);
                const metadata = await sock.groupMetadata(chatId);
                groupMetadataCache.set(chatId, metadata);
                return metadata;
            } catch (error) {
                // Gestion du rate limit (429)
                if (error.status === 429 || error.data === 429) {
                    await wait(5000);
                    const metadata = await sock.groupMetadata(chatId);
                    groupMetadataCache.set(chatId, metadata);
                    return metadata;
                }
                // Si on a un cache même expiré, l'utiliser en fallback
                const cachedData = groupMetadataCache.get(chatId);
                if (cachedData) {
                    console.log('⚠️ API error, using cached metadata for:', chatId);
                    return cachedData;
                }
                throw error;
            }
        })();

        pendingRequests.set(chatId, requestPromise);
        const result = await requestPromise;
        pendingRequests.delete(chatId);

        return result;
    } catch (error) {
        console.error('❌ Error getting group metadata:', error.message);
        throw error;
    }
}

const getParticipantInfo = async (sock, chatId, userIdentifier) => {
    try {
        const groupMetadata = await getGroupMetadataWithCache(sock, chatId);
        const participants = groupMetadata.participants;
        const participant = participants.find(p => {
            const ids = [p.id, p.lid, p.jid].filter(Boolean);
            return ids.some(id => 
                id === userIdentifier ||
                (typeof userIdentifier === 'string' && id && id.includes(userIdentifier.split('@')[0]))
            );
        });
        return participant || {};
    } catch (error) {
        console.error('❌ Error getting participant info:', error.message);
        return {};
    }
};

/**
 * Vérifie si un utilisateur est un administrateur du groupe.
 */
async function isAdmin(sock, jid, user) {
    try {
        // Essayer d'abord avec getParticipantInfo
        const participantInfo = await getParticipantInfo(sock, jid, user);
        if (participantInfo && participantInfo.admin) {
            return true;
        }

        // Fallback: chercher directement dans les participants
        const metadata = await getGroupMetadataWithCache(sock, jid);
        const participants = metadata.participants;
        
        const userNumber = user.split('@')[0];
        
        const participant = participants.find(p => {
            const participantId = p.id || '';
            const participantLid = p.lid || '';
            return p.id === user ||
                   p.lid === user ||
                   participantId.includes(userNumber) ||
                   participantLid.includes(userNumber);
        });

        if (participant) {
            return !!participant.admin;
        }
        return false;
    } catch (error) {
        console.error("❌ Error in isAdmin function:", error.message);
        return false;
    }
}

/**
 * Vérifie si l'expéditeur est le propriétaire du bot.
 */
function isOwner(msg) {
    // Vérifier les paramètres obligatoires
    if (!msg || !msg.key) return false;
    
    // Si le message vient du bot lui-même
    if (msg.key.fromMe) return true;

    const sender = msg.key.participant || msg.key.remoteJid;
    if (!sender) return false;
    
    const senderNumber = sender.split('@')[0].split(':')[0];

    // Dans un PV, le remoteJid est le numéro de l'expéditeur
    // Dans un groupe, le participant est l'expéditeur
    const isPrivateChat = msg.key.remoteJid && msg.key.remoteJid.endsWith('@s.whatsapp.net');
    
    if (isPrivateChat) {
        // En PV, le remoteJid est directement le numéro de l'expéditeur
        const remoteJidNumber = msg.key.remoteJid.split('@')[0];
        return remoteJidNumber === config.owner;
    } else {
        // En groupe, utiliser le participant
        return senderNumber === config.owner;
    }
}

/**
 * Vérifie si l'utilisateur est premium
 */
async function isPremium(userJid) {
    try {
        if (!userJid) return false;
        return await Database.isPremiumUser(userJid);
    } catch (error) {
        console.error('❌ Error checking premium status:', error.message);
        return false;
    }
}

/**
 * Vérifie si l'utilisateur est sudo
 */
function isSudoUser(userJid) {
    try {
        if (!userJid) return false;
        return sudoManager.isSudoUser(userJid);
    } catch (error) {
        console.error('❌ Error checking sudo status:', error.message);
        return false;
    }
}

/**
 * Vérifie si l'utilisateur peut utiliser le bot en mode privé
 */
function canUseInPrivateMode(msg) {
    // Vérifier les paramètres
    if (!msg || !msg.key) return false;
    
    // 1. Le propriétaire peut toujours utiliser
    if (isOwner(msg)) {
        return true;
    }
    
    // 2. Récupérer le JID de l'expéditeur
    const sender = msg.key.participant || msg.key.remoteJid;
    if (!sender) return false;
    
    // 3. Vérifier si l'utilisateur est sudo
    return isSudoUser(sender);
}

/**
 * Vérifie les permissions pour l'exécution des commandes
 */
async function checkPermissions({ sock, msg, userSettings, commandName }) {
    // Vérifications des paramètres obligatoires
    if (!msg || !msg.key) {
        console.error('❌ checkPermissions: invalid msg object');
        return { allowed: false, reason: 'INVALID_MESSAGE' };
    }
    
    const jid = msg.key.remoteJid;
    if (!jid) {
        console.error('❌ checkPermissions: missing remoteJid');
        return { allowed: false, reason: 'INVALID_JID' };
    }
    
    const sender = msg.key.participant || jid;
    const isGroup = jid.endsWith('@g.us');

    try {
        // Vérifier le mode d'accès
        const mode = userSettings?.bot_mode || 'public';
        if (mode === 'private') {
            // En mode privé, seul le propriétaire et les utilisateurs sudo peuvent utiliser les commandes
            if (!canUseInPrivateMode(msg)) {
                return { allowed: false, reason: 'ACCESS_DENIED', silent: true };
            }
        }

        // Commandes réservées au propriétaire (sudo ne peut pas les utiliser)
        const ownerCommands = ['setprefix', 'setname', 'private', 'public', 'sudo', 'addsudo', 'makesudo', 'delsudo', 'removesudo', 'unsudo'];
        if (ownerCommands.includes(commandName) && !isOwner(msg)) {
            return { allowed: false, reason: 'OWNER_ONLY' };
        }

        // Commandes réservées aux utilisateurs premium
        const premiumCommands = ['broadcast', 'autoreply', 'backup', 'restore', 'stats'];
        if (premiumCommands.includes(commandName)) {
            const userIsPremium = await isPremium(sender);
            if (!userIsPremium) {
                return { allowed: false, reason: 'PREMIUM_ONLY' };
            }
        }

        // Commandes réservées aux admins dans les groupes
        const adminCommands = ['protection', 'greet', 'warnings', 'mute', 'unmute', 'promote', 'demote'];
        if (isGroup && adminCommands.includes(commandName)) {
            const userIsAdmin = await isAdmin(sock, jid, sender);
            if (!userIsAdmin) {
                return { allowed: false, reason: 'ADMIN_ONLY' };
            }
        }

        return { allowed: true };
    } catch (error) {
        console.error('❌ Permission check error:', error.message);
        // En cas d'erreur, autoriser l'exécution pour éviter de bloquer le bot
        return { allowed: true };
    }
}

export {
    isAdmin,
    isOwner,
    isPremium,
    isSudoUser,
    canUseInPrivateMode,
    checkPermissions
};