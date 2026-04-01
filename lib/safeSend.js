const messageTimestamps = new Map();
const MIN_DELAY = 2000; // 2 secondes entre chaque message

/**
 * Envoyer un message avec protection anti rate-limit
 */
async function safeSend(sock, jid, message, options = {}) {
    // Vérification que sock est valide
    if (!sock || typeof sock.sendMessage !== 'function') {
        console.error('❌ safeSend: invalid socket object');
        return null;
    }
    
    if (!jid) {
        console.error('❌ safeSend: jid is required');
        return null;
    }
    
    const key = `${jid}`;
    const now = Date.now();
    const lastTime = messageTimestamps.get(key) || 0;
    const timeSinceLastMessage = now - lastTime;
    
    // Attendre si nécessaire
    if (timeSinceLastMessage < MIN_DELAY) {
        const waitTime = MIN_DELAY - timeSinceLastMessage;
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    try {
        const result = await sock.sendMessage(jid, message, options);
        messageTimestamps.set(key, Date.now());
        return result;
    } catch (error) {
        // Gestion des erreurs de rate-limit
        if (error.message?.includes('rate-overlimit') || error.message?.includes('too many requests')) {
            console.log(`⚠️ WhatsApp rate limit hit for ${jid}, waiting 10s...`);
            // Attendre 10 secondes avant de réessayer
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // Réessayer une fois
            try {
                const result = await sock.sendMessage(jid, message, options);
                messageTimestamps.set(key, Date.now());
                return result;
            } catch (retryError) {
                console.error('❌ Rate limit persists, message not sent');
                return null;
            }
        }
        
        // Gestion des erreurs de connexion
        if (error.message?.includes('not connected') || 
            error.message?.includes('closed') ||
            error.message?.includes('Socket closed') ||
            error.message?.includes('connection') ||
            error.code === 'ECONNRESET') {
            console.error('❌ Socket not connected, message not sent');
            return null;
        }
        
        // Gestion des autres erreurs
        console.error('❌ Send message error:', error.message);
        return null;
    }
}

/**
 * Envoyer une réaction avec protection anti rate-limit
 */
async function safeReact(sock, jid, msg, emoji) {
    // Vérifications
    if (!sock || !jid || !msg || !msg.key) {
        console.error('❌ safeReact: invalid parameters');
        return false;
    }
    
    try {
        await safeSend(sock, jid, {
            react: {
                text: emoji,
                key: msg.key
            }
        });
        return true;
    } catch (error) {
        if (!error.message?.includes('rate-overlimit') && 
            !error.message?.includes('too many requests')) {
            console.error('❌ Reaction error:', error.message);
        }
        return false;
    }
}

/**
 * Envoyer une présence (typing, recording, etc.)
 */
async function safePresence(sock, jid, type) {
    // Vérifications
    if (!sock || typeof sock.sendPresenceUpdate !== 'function') {
        console.error('❌ safePresence: invalid socket object');
        return false;
    }
    
    if (!jid) {
        console.error('❌ safePresence: jid is required');
        return false;
    }
    
    // Types valides pour WhatsApp
    const validTypes = ['composing', 'recording', 'paused'];
    if (!validTypes.includes(type)) {
        console.warn(`⚠️ safePresence: unknown presence type "${type}"`);
        return false;
    }
    
    try {
        await sock.sendPresenceUpdate(type, jid);
        return true;
    } catch (error) {
        // Gestion des erreurs de connexion
        if (error.message?.includes('not connected') || 
            error.message?.includes('closed') ||
            error.message?.includes('Socket closed') ||
            error.message?.includes('connection') ||
            error.code === 'ECONNRESET') {
            // Silencieux pour les erreurs de connexion (normales)
            return false;
        }
        
        // Gestion des erreurs rate-limit
        if (!error.message?.includes('rate-overlimit') && 
            !error.message?.includes('too many requests')) {
            console.error('❌ Presence error:', error.message);
        }
        return false;
    }
}

/**
 * Nettoyer les anciens timestamps (appeler périodiquement)
 */
function cleanupTimestamps() {
    const now = Date.now();
    const maxAge = 60000; // 1 minute
    let deletedCount = 0;
    
    for (const [key, timestamp] of messageTimestamps.entries()) {
        if (now - timestamp > maxAge) {
            messageTimestamps.delete(key);
            deletedCount++;
        }
    }
    
    if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old message timestamps`);
    }
}

// Nettoyer automatiquement toutes les minutes
let cleanupInterval = null;

function startCleanup() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
    }
    cleanupInterval = setInterval(cleanupTimestamps, 60000);
}

function stopCleanup() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
}

// Démarrer automatiquement
startCleanup();

/**
 * Obtenir les stats du rate-limiter
 */
function getRateLimitStats() {
    return {
        activeChats: messageTimestamps.size,
        minDelay: MIN_DELAY,
        lastCleanup: Date.now()
    };
}

/**
 * Réinitialiser les timestamps pour un chat spécifique
 */
function resetChatTimestamps(jid) {
    if (jid) {
        const key = `${jid}`;
        messageTimestamps.delete(key);
    } else {
        messageTimestamps.clear();
    }
    console.log(`🔄 Rate limit timestamps reset for ${jid || 'all chats'}`);
}

export {
    safeSend,
    safeReact,
    safePresence,
    cleanupTimestamps,
    startCleanup,
    stopCleanup,
    getRateLimitStats,
    resetChatTimestamps
};