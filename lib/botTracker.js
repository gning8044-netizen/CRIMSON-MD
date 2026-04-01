import config from '../config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BotTracker {
    constructor() {
        this.stats = {
            phoneNumber: config.owner || 'unknown',
            startTime: Date.now(),
            commandsExecuted: 0,
            lastHeartbeat: Date.now(),
            isActive: true,
            version: '1.0.0',
            lastCommand: null,
            commandHistory: []
        };
        
        // Dossier pour sauvegarder les stats localement
        this.dataDir = path.join(__dirname, '../data');
        this.statsFile = path.join(this.dataDir, 'bot-stats.json');
        
        // URL de l'API - AJOUT MANQUANT
        this.apiUrl = config.apiUrl || process.env.BOT_API_URL || null;
        
        // Créer le dossier data s'il n'existe pas
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        
        this.heartbeatInterval = null;
        this.isApiAvailable = true;
        this.saveInterval = null;
        
        console.log('📊 BotTracker initialized for:', this.stats.phoneNumber);
        
        // Charger les stats existantes
        this.loadStats();
    }

    // Charger les stats sauvegardées
    loadStats() {
        try {
            if (fs.existsSync(this.statsFile)) {
                const savedStats = JSON.parse(fs.readFileSync(this.statsFile, 'utf8'));
                this.stats.commandsExecuted = savedStats.commandsExecuted || 0;
                this.stats.startTime = savedStats.startTime || this.stats.startTime;
                console.log('📊 Previous stats loaded:', this.stats.commandsExecuted, 'commands');
            }
        } catch (error) {
            console.error('❌ Error loading stats:', error.message);
        }
    }

    // Sauvegarder les stats localement
    saveStats() {
        try {
            const statsToSave = {
                commandsExecuted: this.stats.commandsExecuted,
                startTime: this.stats.startTime,
                lastSave: Date.now()
            };
            fs.writeFileSync(this.statsFile, JSON.stringify(statsToSave, null, 2));
        } catch (error) {
            console.error('❌ Error saving stats:', error.message);
        }
    }

    // Démarrer le tracking
    start() {
        if (this.heartbeatInterval) {
            console.log('⚠️ Bot tracker already running');
            return;
        }
        
        console.log('📊 Bot tracker started');
        
        // Envoyer immédiatement un heartbeat
        this.sendHeartbeat();
        
        // Puis toutes les heures
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, 60 * 60 * 1000); // 1 heure
        
        // Sauvegarder les stats toutes les 5 minutes
        this.saveInterval = setInterval(() => {
            this.saveStats();
        }, 5 * 60 * 1000);
        
        console.log('⏰ Heartbeat scheduled every 60 minutes');
        console.log('💾 Stats auto-save every 5 minutes');
    }

    // Arrêter le tracking
    stop() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
            this.saveInterval = null;
        }
        
        this.stats.isActive = false;
        this.sendHeartbeat(); // Dernier heartbeat avant arrêt
        this.saveStats(); // Sauvegarde finale
        console.log('📊 Bot tracker stopped');
    }

    // Incrémenter le compteur de commandes
    incrementCommands(commandName = null) {
        this.stats.commandsExecuted++;
        this.stats.lastHeartbeat = Date.now();
        this.stats.lastCommand = {
            name: commandName,
            time: Date.now(),
            timestamp: new Date().toISOString()
        };
        
        // Garder seulement les 100 dernières commandes
        this.stats.commandHistory.unshift(this.stats.lastCommand);
        if (this.stats.commandHistory.length > 100) {
            this.stats.commandHistory.pop();
        }
        
        console.log(`📊 Command executed: ${commandName || 'unknown'}. Total: ${this.stats.commandsExecuted}`);
        
        // Sauvegarder après chaque commande (optionnel, peut être commenté si trop de I/O)
        // this.saveStats();
    }

    // Calculer l'uptime
    getUptime() {
        const uptimeMs = Date.now() - this.stats.startTime;
        const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
        const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((uptimeMs % (1000 * 60)) / 1000);
        return { hours, minutes, seconds, milliseconds: uptimeMs };
    }

    // Envoyer les données au serveur
    async sendHeartbeat() {
        try {
            const uptime = this.getUptime();
            
            const payload = {
                phoneNumber: this.stats.phoneNumber,
                commandsExecuted: this.stats.commandsExecuted,
                uptimeHours: uptime.hours,
                uptimeMinutes: uptime.minutes,
                uptimeSeconds: uptime.seconds,
                uptimeMs: uptime.milliseconds,
                lastHeartbeat: Date.now(),
                isActive: this.stats.isActive,
                version: this.stats.version,
                timestamp: new Date().toISOString(),
                lastCommand: this.stats.lastCommand
            };

            console.log('📤 Sending heartbeat to API...');
            console.log(`📊 Stats: ${this.stats.commandsExecuted} commands, ${uptime.hours}h ${uptime.minutes}m ${uptime.seconds}s uptime`);

            // Vérifier si l'URL de l'API est configurée
            if (!this.apiUrl) {
                console.log('⚠️ No API URL configured, logging locally only');
                this.logHeartbeatLocally(payload);
                return;
            }

            // Essayer d'envoyer à l'API si disponible
            if (this.isApiAvailable) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000);
                    
                    const response = await fetch(this.apiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(payload),
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);

                    if (response.ok) {
                        const data = await response.json();
                        console.log('✅ Heartbeat sent successfully:', data.message || 'OK');
                        // Réactiver l'API si elle était désactivée
                        if (!this.isApiAvailable) {
                            this.isApiAvailable = true;
                            console.log('🔄 API back online');
                        }
                    } else {
                        throw new Error(`HTTP ${response.status}`);
                    }
                } catch (apiError) {
                    // Si l'API échoue, on désactive temporairement et on log localement
                    if (this.isApiAvailable) {
                        this.isApiAvailable = false;
                        console.log('⚠️ API unavailable, switching to local mode only');
                    }
                    this.logHeartbeatLocally(payload);
                }
            } else {
                // Mode local seulement
                this.logHeartbeatLocally(payload);
            }
            
        } catch (error) {
            console.error('❌ Heartbeat error:', error.message);
            this.logHeartbeatLocally(payload);
        }
    }
    
    // Log local des heartbeats
    logHeartbeatLocally(payload) {
        const logFile = path.join(this.dataDir, 'heartbeat-logs.json');
        try {
            let logs = [];
            if (fs.existsSync(logFile)) {
                const content = fs.readFileSync(logFile, 'utf8');
                if (content.trim()) {
                    logs = JSON.parse(content);
                }
            }
            
            logs.push({
                ...payload,
                localLogTime: Date.now()
            });
            
            // Garder seulement les 1000 derniers logs
            if (logs.length > 1000) {
                logs = logs.slice(-1000);
            }
            
            fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
            console.log('💾 Heartbeat logged locally');
        } catch (error) {
            console.error('❌ Error logging heartbeat locally:', error.message);
        }
    }

    // Obtenir les stats actuelles
    getStats() {
        const uptime = this.getUptime();
        return {
            ...this.stats,
            uptime,
            apiAvailable: this.isApiAvailable,
            apiUrlConfigured: !!this.apiUrl
        };
    }
    
    // Afficher un résumé des stats
    showStats() {
        const stats = this.getStats();
        console.log('\n📊 === BOT STATISTICS ===');
        console.log(`📱 Phone: ${stats.phoneNumber}`);
        console.log(`⏱️  Uptime: ${stats.uptime.hours}h ${stats.uptime.minutes}m ${stats.uptime.seconds}s`);
        console.log(`⚡ Commands: ${stats.commandsExecuted}`);
        console.log(`💚 Status: ${stats.isActive ? 'Active' : 'Stopped'}`);
        console.log(`📡 API Mode: ${stats.apiUrlConfigured ? (stats.apiAvailable ? 'Online' : 'Local only') : 'Not configured'}`);
        if (stats.lastCommand) {
            console.log(`🔄 Last command: ${stats.lastCommand.name || 'unknown'} at ${new Date(stats.lastCommand.time).toLocaleString()}`);
        }
        console.log('========================\n');
    }
    
    // Méthode pour forcer l'envoi d'un heartbeat (utile pour debug)
    async forceHeartbeat() {
        console.log('🔄 Forcing heartbeat...');
        this.isApiAvailable = true; // Réessayer l'API
        await this.sendHeartbeat();
        this.showStats();
    }
}

// Export singleton
const botTracker = new BotTracker();
export default botTracker;