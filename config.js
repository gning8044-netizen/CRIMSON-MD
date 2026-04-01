import dotenv from 'dotenv';
dotenv.config();

const config = {
    // Configuration de base
    prefix: process.env.BOT_PREFIX || '!',
    owner: process.env.BOT_OWNER || 'numero telephone',  //For The Paring Code 
    ownerName: process.env.BOT_OWNER_NAME || '𝐃𝐚𝐫𝐤𝐌𝐨𝐝𝐬-𝐍𝐞𝐦𝐞𝐬𝐢𝐬⁰⁰⁷',  //(Don't Touch Or Change)
    
    // Session
    sessionDir: process.env.SESSION_DIR || 'session',
    
    // Serveur
    port: process.env.PORT || 3000,
    
    // Fonctionnalités (activées par défaut)
    anticall: process.env.ANTICALL !== 'false',
    autostatus: process.env.AUTOSTATUS === 'false',
    antidelete: process.env.ANTIDELETE !== 'false',
    autoreact: process.env.AUTOREACT === 'true',
    autowrite: process.env.AUTOWRITE === 'false',
    
    // Protection groupes (activées par défaut)
    antilink: process.env.ANTILINK !== 'false',
    antispam: process.env.ANTISPAM !== 'false',
    antimention: process.env.ANTIMENTION !== 'false',
    antitag: process.env.ANTITAG !== 'false',
    antidemote: process.env.ANTIDEMOTE !== 'true',
    antipromote: process.env.ANTIPROMOTE !== 'true',
    
   
    // Seuils protection
    antilinkThreshold: parseInt(process.env.ANTILINK_THRESHOLD) || 4,
    antispamThreshold: parseInt(process.env.ANTISPAM_THRESHOLD) || 4,


    updateZipUrl: process.env.UPDATE_ZIP_URL || "",
};

export default config;