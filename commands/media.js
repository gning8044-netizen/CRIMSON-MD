import fs from 'fs/promises';
import path from 'path';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import Database from '../lib/database.js';
import config from '../config.js';

const MEDIA_BASE_DIR = './user_media';

async function ensureUserMediaDir() {
    const userDir = path.join(MEDIA_BASE_DIR, config.owner); // ⭐ MODIFICATION
    await fs.mkdir(userDir, { recursive: true });
    return userDir;
}

export default {
    name: 'media',
    aliases: ['store', 'vd', 'ad', 'list', 'del', 's', 'sticker', 'take', 'steal'],
    description: 'Gère votre collection de médias personnels',
    
    async execute({ sock, msg, args, userSettings }) {
        const jid = msg.key.remoteJid;
        const phoneNumber = config.owner; // ⭐ MODIFICATION
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const commandName = body.slice(userSettings.prefix.length).trim().split(/\s+/)[0].toLowerCase();

        try {
            const userDir = await ensureUserMediaDir();

            switch(commandName) {
                case 'store': {
                    if (!quoted || (!quoted.audioMessage && !quoted.videoMessage)) {
                        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key }});
                        return;
                    }

                    const name = args[0];
                    if (!name) {
                        await sock.sendMessage(jid, { 
                            text: '❌ Usage: !store nom' 
                        }, { quoted: msg });
                        return;
                    }

                    const mediaType = quoted.videoMessage ? 'video' : 'audio';
                    const extension = mediaType === 'video' ? '.mp4' : '.mp3';
                    const fileName = name.toLowerCase() + extension;
                    const mediaPath = path.join(userDir, fileName);

                    // Vérifier si existe déjà en DB
                    const existing = await Database.getUserMedia(mediaType); // ⭐ MODIFICATION
                    const mediaExists = existing.some(m => m.media_name === name.toLowerCase());
                    
                    if (mediaExists) {
                        await sock.sendMessage(jid, { 
                            text: `❌ ${mediaType} "${name}" existe déjà` 
                        }, { quoted: msg });
                        return;
                    }

                    await sock.sendMessage(jid, { react: { text: '📥', key: msg.key }});
                    
                    // Télécharger et sauvegarder
                    const mediaMessage = quoted.videoMessage || quoted.audioMessage;
                    const stream = await downloadContentFromMessage(mediaMessage, mediaType);
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) {
                        buffer = Buffer.concat([buffer, chunk]);
                    }
                    await fs.writeFile(mediaPath, buffer);
                    
                    // ⭐ MODIFICATION: Sauvegarder sans phoneNumber
                    await Database.saveUserMedia(name, mediaType, mediaPath);
                    
                    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key }});
                    break;
                }

                case 'vd': {
                    const isCircular = args.includes('-c');
                    const name = args.filter(arg => arg !== '-c')[0];

                    if (!name) {
                        await sock.sendMessage(jid, { 
                            text: '❌ Usage: !vd nom [-c pour circulaire]' 
                        }, { quoted: msg });
                        return;
                    }

                    // ⭐ MODIFICATION: Chercher sans phoneNumber
                    const userMedia = await Database.getUserMedia('video');
                    const media = userMedia.find(m => m.media_name === name.toLowerCase());

                    if (!media) {
                        await sock.sendMessage(jid, { 
                            text: `❌ Vidéo "${name}" non trouvée` 
                        }, { quoted: msg });
                        return;
                    }

                    await sock.sendMessage(jid, { react: { text: '🎬', key: msg.key }});
                    
                    try {
                        const videoBuffer = await fs.readFile(media.file_path);
                        await sock.sendMessage(jid, {
                            video: videoBuffer,
                            caption: `📹 ${name}`,
                            ptv: isCircular
                        }, { quoted: msg });
                    } catch (fileError) {
                        await sock.sendMessage(jid, { 
                            text: `❌ Fichier vidéo corrompu` 
                        }, { quoted: msg });
                        // ⭐ MODIFICATION: Nettoyer sans phoneNumber
                        await Database.deleteUserMedia(name, 'video');
                    }
                    break;
                }

                case 'ad': {
                    const name = args[0];
                    if (!name) {
                        await sock.sendMessage(jid, { 
                            text: '❌ Usage: !ad nom' 
                        }, { quoted: msg });
                        return;
                    }

                    // ⭐ MODIFICATION: Chercher sans phoneNumber
                    const userMedia = await Database.getUserMedia('audio');
                    const media = userMedia.find(m => m.media_name === name.toLowerCase());

                    if (!media) {
                        await sock.sendMessage(jid, { 
                            text: `❌ Audio "${name}" non trouvé` 
                        }, { quoted: msg });
                        return;
                    }

                    await sock.sendMessage(jid, { react: { text: '🎵', key: msg.key }});
                    
                    try {
                        const audioBuffer = await fs.readFile(media.file_path);
                        await sock.sendMessage(jid, {
                            audio: audioBuffer,
                            mimetype: 'audio/mpeg',
                            ptt: false,
                        }, { quoted: msg });
                    } catch (fileError) {
                        await sock.sendMessage(jid, { 
                            text: `❌ Fichier audio corrompu` 
                        }, { quoted: msg });
                        // ⭐ MODIFICATION: Supprimer sans phoneNumber
                        await Database.deleteUserMedia(name, 'audio');
                    }
                    break;
                }

                case 'list': {
                    // ⭐ MODIFICATION: Récupérer sans phoneNumber
                    const mediaList = await Database.getUserMedia();
                    
                    const videos = mediaList.filter(m => m.media_type === 'video');
                    const audios = mediaList.filter(m => m.media_type === 'audio');

                    let message = `📁 Vos médias (${mediaList.length}):\n\n`;
                    
                    if (videos.length > 0) {
                        message += `🎬 VIDEOS (${videos.length}):\n`;
                        videos.forEach(video => {
                            message += `• ${video.media_name}\n`;
                        });
                        message += '\n';
                    }
                    
                    if (audios.length > 0) {
                        message += `🎵 AUDIOS (${audios.length}):\n`;
                        audios.forEach(audio => {
                            message += `• ${audio.media_name}\n`;
                        });
                    }
                    
                    if (mediaList.length === 0) {
                        message = '📁 Aucun média sauvegardé';
                    }

                    await sock.sendMessage(jid, { text: message }, { quoted: msg });
                    break;
                }

                case 'del': {
                    const type = args[0]?.toLowerCase();
                    const name = args[1];

                    if (!type || !name || !['audio', 'video'].includes(type)) {
                        await sock.sendMessage(jid, { 
                            text: '❌ Usage: !del audio|video nom' 
                        }, { quoted: msg });
                        return;
                    }

                    // ⭐ MODIFICATION: Supprimer sans phoneNumber
                    const deleted = await Database.deleteUserMedia(name, type);
                    
                    if (deleted) {
                        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key }});
                    } else {
                        await sock.sendMessage(jid, { 
                            text: `❌ ${type} "${name}" non trouvé` 
                        }, { quoted: msg });
                    }
                    break;
                }

                case 'sticker':
                case 's': {
                    const mediaMessage = msg.message?.imageMessage || msg.message?.videoMessage || 
                                    quoted?.imageMessage || quoted?.videoMessage;
                    
                    if (!mediaMessage) {
                        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key }});
                        return;
                    }

                    try {
                        await sock.sendMessage(jid, { react: { text: '✍️', key: msg.key }});

                        const mediaType = mediaMessage.mimetype.includes('video') ? 'video' : 'image';
                        const stream = await downloadContentFromMessage(mediaMessage, mediaType);
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) {
                            buffer = Buffer.concat([buffer, chunk]);
                        }

                        if (!buffer || buffer.length === 0) throw new Error('Buffer vide');

                        const sticker = new Sticker(buffer, {
                            pack: 'TechVerse Bot', // ⭐ MODIFICATION
                            author: config.ownerName || 'Owner', // ⭐ MODIFICATION
                            type: StickerTypes.FULL,
                            quality: 70
                        });

                        await sock.sendMessage(jid, await sticker.toMessage(), { quoted: msg });
                        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key }});

                    } catch (error) {
                        console.error('Erreur sticker:', error);
                        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key }});
                    }
                    break;
                }

                case 'take':
                case 'steal': {
                    if (!quoted || !quoted.stickerMessage) {
                        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key }});
                        return;
                    }

                    try {
                        await sock.sendMessage(jid, { react: { text: '🔄', key: msg.key }});

                        const stream = await downloadContentFromMessage(quoted.stickerMessage, 'sticker');
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) {
                            buffer = Buffer.concat([buffer, chunk]);
                        }

                        if (!buffer) throw new Error('Buffer vide');
                        
                        const [pack, author] = args.join(' ').split('|').map(s => s.trim());
                        const packName = pack || 'TechVerse Bot'; // ⭐ MODIFICATION
                        const authorName = author || (config.ownerName || 'Owner'); // ⭐ MODIFICATION

                        const sticker = new Sticker(buffer, {
                            pack: packName,
                            author: authorName,
                            type: StickerTypes.FULL,
                            quality: 70
                        });

                        await sock.sendMessage(jid, await sticker.toMessage(), { quoted: msg });
                        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key }});

                    } catch (error) {
                        console.error('Erreur take:', error);
                        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key }});
                    }
                    break;
                }
            }
        } catch (error) {
            console.error('Erreur media:', error);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key }});
        }
    }
};