import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'db.json');
const DATA_DIR = path.join(__dirname, '..', 'data');

class JSONDatabase {
    constructor() {
        // S'assurer que le dossier data existe
        if (!existsSync(DATA_DIR)) {
            mkdirSync(DATA_DIR, { recursive: true });
        }
        this.db = this.loadDB();
    }

    loadDB() {
        try {
            if (existsSync(DB_PATH)) {
                const content = readFileSync(DB_PATH, 'utf-8');
                if (content.trim()) {
                    return JSON.parse(content);
                }
                // Fichier vide, retourner structure par défaut
                return this.getDefaultStructure();
            }
            return this.getDefaultStructure();
        } catch (error) {
            console.error('❌ Database Load Error:', error.message);
            return this.getDefaultStructure();
        }
    }

    saveDB() {
        try {
            writeFileSync(DB_PATH, JSON.stringify(this.db, null, 2), 'utf-8');
            return true;
        } catch (error) {
            console.error('❌ Database Save Error:', error.message);
            return false;
        }
    }

    getDefaultStructure() {
        return {
            settings: this.getDefaultUserSettings(),
            groups: {},
            sudoUsers: [],
            premiumUsers: [],
            userMedia: {},
            userWarnings: {}
        };
    }

    getDefaultUserSettings() {
        return {
            prefix: '!',
            bot_name: '𝑪𝑹𝑰𝑴𝑺𝑶𝑵-𝑴𝑫',
            bot_mode: 'private',
            language: 'en',
            antidelete_enabled: false,
            autoreact_enabled: true,
            menu_image: 'https://files.catbox.moe/zqr8he.jpeg',
            welcome_image: 'https://files.catbox.moe/wv1m7n.jpeg'
        };
    }

    getDefaultGroupSettings() {
        return {
            welcome_enabled: false,
            goodbye_enabled: false,
            muted: false,
            antilink_enabled: false,
            antispam_enabled: false,
            antitag_enabled: false,
            antimention_enabled: false,
            antidemote_enabled: true,
            antipromote_enabled: true,
            antilink_threshold: 4,
            antispam_threshold: 4,
            welcome_message: null,
            goodbye_message: null
        };
    }

    // === MÉTHODES POUR COMPATIBILITÉ ===
    async getUserSettingsByPhone(phoneNumber) {
        return this.db.settings || this.getDefaultUserSettings();
    }

    async updateUserSettingsByPhone(phoneNumber, updates) {
        return this.updateUserSettings(updates);
    }

    async getUserByPhone(phoneNumber) {
        return { phone_number: phoneNumber };
    }

    async updateConnectionStatus(phoneNumber, isConnected) {
        console.log(`📡 Connection Status: ${phoneNumber} - ${isConnected ? 'Connected' : 'Disconnected'}`);
        // Optionnel: sauvegarder le statut dans la DB
        if (!this.db.connectionStatus) {
            this.db.connectionStatus = {};
        }
        this.db.connectionStatus[phoneNumber] = {
            isConnected,
            lastUpdate: Date.now()
        };
        this.saveDB();
    }

    async cleanupUserMedia(phoneNumber) {
        // Ne nettoyer que les médias de l'utilisateur spécifié
        const mediaToDelete = Object.keys(this.db.userMedia).filter(key => 
            this.db.userMedia[key].phone_number === phoneNumber
        );
        
        mediaToDelete.forEach(key => {
            delete this.db.userMedia[key];
        });
        
        this.saveDB();
        console.log(`🗑️ Media cleaned up for: ${phoneNumber} (${mediaToDelete.length} items deleted)`);
        return true;
    }

    // === SETTINGS UTILISATEUR ===
    async getUserSettings() {
        return this.db.settings || this.getDefaultUserSettings();
    }

    async updateUserSettings(updates) {
        if (!this.db.settings) {
            this.db.settings = this.getDefaultUserSettings();
        }
        this.db.settings = { ...this.db.settings, ...updates };
        this.saveDB();
        console.log('❤️ User Settings Updated');
        return this.db.settings;
    }

    // === GROUPES ===
    async getGroupSettings(jid) {
        if (!jid) {
            console.warn('⚠️ getGroupSettings called without jid');
            return this.getDefaultGroupSettings();
        }
        return this.db.groups[jid] || this.getDefaultGroupSettings();
    }

    async updateGroupSettings(jid, updates) {
        if (!jid) {
            console.error('❌ updateGroupSettings: jid is required');
            return false;
        }
        
        if (!this.db.groups[jid]) {
            this.db.groups[jid] = this.getDefaultGroupSettings();
        }
        this.db.groups[jid] = { ...this.db.groups[jid], ...updates };
        this.saveDB();
        console.log(`❤️ Group Settings Updated For ${jid}`);
        return true;
    }

    async getAllGroupSettings() {
        return this.db.groups;
    }

    async deleteGroupSettings(jid) {
        if (this.db.groups[jid]) {
            delete this.db.groups[jid];
            this.saveDB();
            console.log(`🗑️ Group settings deleted for: ${jid}`);
            return true;
        }
        return false;
    }

    // === SUDO USERS ===
    async getSudoUsers() {
        return this.db.sudoUsers || [];
    }

    async addSudoUser(userJid) {
        if (!this.db.sudoUsers) {
            this.db.sudoUsers = [];
        }
        if (!this.db.sudoUsers.includes(userJid)) {
            this.db.sudoUsers.push(userJid);
            this.saveDB();
            console.log(`👑 Sudo user added: ${userJid}`);
            return true;
        }
        return false;
    }

    async removeSudoUser(userJid) {
        if (!this.db.sudoUsers) {
            return false;
        }
        const index = this.db.sudoUsers.indexOf(userJid);
        if (index !== -1) {
            this.db.sudoUsers.splice(index, 1);
            this.saveDB();
            console.log(`👑 Sudo user removed: ${userJid}`);
            return true;
        }
        return false;
    }

    async isSudoUser(userJid) {
        return this.db.sudoUsers?.includes(userJid) || false;
    }

    // === PREMIUM USERS ===
    async getPremiumUsers() {
        return this.db.premiumUsers || [];
    }

    async addPremiumUser(userJid, expiryDate = null) {
        if (!this.db.premiumUsers) {
            this.db.premiumUsers = [];
        }
        
        // Vérifier si déjà premium
        const existing = this.db.premiumUsers.find(u => u.jid === userJid);
        if (existing) {
            // Mettre à jour la date d'expiration si fournie
            if (expiryDate) {
                existing.expiryDate = expiryDate;
                this.saveDB();
            }
            return true;
        }
        
        this.db.premiumUsers.push({
            jid: userJid,
            addedAt: Date.now(),
            expiryDate: expiryDate || null
        });
        this.saveDB();
        console.log(`⭐ Premium user added: ${userJid}`);
        return true;
    }

    async removePremiumUser(userJid) {
        if (!this.db.premiumUsers) {
            return false;
        }
        const index = this.db.premiumUsers.findIndex(u => u.jid === userJid);
        if (index !== -1) {
            this.db.premiumUsers.splice(index, 1);
            this.saveDB();
            console.log(`⭐ Premium user removed: ${userJid}`);
            return true;
        }
        return false;
    }

    async isPremiumUser(userJid) {
        if (!this.db.premiumUsers) {
            return false;
        }
        
        const user = this.db.premiumUsers.find(u => u.jid === userJid);
        if (!user) return false;
        
        // Vérifier l'expiration
        if (user.expiryDate && user.expiryDate < Date.now()) {
            // Expiré, le retirer automatiquement
            await this.removePremiumUser(userJid);
            return false;
        }
        
        return true;
    }

    async getAllPremiumUsers() {
        return this.db.premiumUsers || [];
    }

    // === MEDIA ===
    async getUserMedia(mediaType = null) {
        const mediaList = Object.values(this.db.userMedia || {});
        if (mediaType) {
            return mediaList.filter(media => media.media_type === mediaType);
        }
        return mediaList;
    }

    async saveUserMedia(mediaName, mediaType, filePath, metadata = {}) {
        const key = `${mediaType}_${mediaName}_${Date.now()}`;
        if (!this.db.userMedia) {
            this.db.userMedia = {};
        }
        this.db.userMedia[key] = {
            media_name: mediaName,
            media_type: mediaType,
            file_path: filePath,
            created_at: new Date().toISOString(),
            ...metadata
        };
        this.saveDB();
        return key;
    }

    async getUserMediaByKey(key) {
        return this.db.userMedia?.[key] || null;
    }

    async deleteUserMedia(mediaName, mediaType) {
        const key = Object.keys(this.db.userMedia || {}).find(k => 
            k.startsWith(`${mediaType}_${mediaName}`)
        );
        
        if (key && this.db.userMedia[key]) {
            // Optionnel: supprimer le fichier physiquement
            const filePath = this.db.userMedia[key].file_path;
            if (filePath && existsSync(filePath)) {
                try {
                    const { unlinkSync } = await import('fs');
                    unlinkSync(filePath);
                } catch (e) {
                    console.warn('⚠️ Could not delete media file:', e.message);
                }
            }
            
            delete this.db.userMedia[key];
            this.saveDB();
            return true;
        }
        return false;
    }

    async deleteAllUserMedia() {
        this.db.userMedia = {};
        this.saveDB();
        console.log('🗑️ All user media deleted');
        return true;
    }

    // === WARNINGS ===
    getUserWarnings(jid, userId) {
        if (!jid || !userId) {
            return {
                antilink: 0,
                antispam: 0,
                messages: [],
                lastReset: Date.now()
            };
        }
        
        const key = `${jid}_${userId}`;
        const warnings = this.db.userWarnings?.[key];
        
        if (!warnings) {
            return {
                antilink: 0,
                antispam: 0,
                messages: [],
                lastReset: Date.now()
            };
        }
        
        return warnings;
    }

    updateUserWarnings(jid, userId, warnings) {
        if (!jid || !userId) return false;
        
        const key = `${jid}_${userId}`;
        if (!this.db.userWarnings) {
            this.db.userWarnings = {};
        }
        this.db.userWarnings[key] = {
            ...warnings,
            lastUpdate: Date.now()
        };
        this.saveDB();
        return true;
    }

    incrementWarning(jid, userId, type) {
        const warnings = this.getUserWarnings(jid, userId);
        if (type === 'antilink') {
            warnings.antilink = (warnings.antilink || 0) + 1;
        } else if (type === 'antispam') {
            warnings.antispam = (warnings.antispam || 0) + 1;
        }
        warnings.messages.push({ type, time: Date.now() });
        
        // Garder seulement les 50 derniers messages
        if (warnings.messages.length > 50) {
            warnings.messages = warnings.messages.slice(-50);
        }
        
        this.updateUserWarnings(jid, userId, warnings);
        return warnings;
    }

    resetUserWarnings(jid, userId = null) {
        if (!this.db.userWarnings) {
            return;
        }
        
        if (userId) {
            const key = `${jid}_${userId}`;
            delete this.db.userWarnings[key];
        } else if (jid) {
            Object.keys(this.db.userWarnings).forEach(key => {
                if (key.startsWith(`${jid}_`)) {
                    delete this.db.userWarnings[key];
                }
            });
        } else {
            // Reset all warnings
            this.db.userWarnings = {};
        }
        this.saveDB();
        console.log(`⚠️ Warnings reset for ${userId ? `${jid}/${userId}` : jid || 'all users'}`);
    }

    // === MÉTHODES UTILITAIRES ===
    async backup() {
        const backupPath = path.join(DATA_DIR, `backup_${Date.now()}.json`);
        try {
            writeFileSync(backupPath, JSON.stringify(this.db, null, 2), 'utf-8');
            console.log(`💾 Database backup created: ${backupPath}`);
            return backupPath;
        } catch (error) {
            console.error('❌ Backup error:', error.message);
            return null;
        }
    }

    async getStats() {
        return {
            groupsCount: Object.keys(this.db.groups || {}).length,
            sudoUsersCount: (this.db.sudoUsers || []).length,
            premiumUsersCount: (this.db.premiumUsers || []).length,
            mediaCount: Object.keys(this.db.userMedia || {}).length,
            warningsCount: Object.keys(this.db.userWarnings || {}).length
        };
    }
}

const database = new JSONDatabase();
export default database;