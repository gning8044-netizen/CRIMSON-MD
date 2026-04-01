import { sendReply, formatError, formatSuccess } from '../lib/helpers.js';
import axios from 'axios';
import FormData from 'form-data';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

export default {
    name: 'url',
    aliases: ['tourl', 'imgtourl', 'imageurl', 'upload'],
    description: 'Convertir une image en URL directe',
    usage: 'url (en réponse à une image)',
    category: 'tools',

    async execute({ sock, msg, phoneNumber }) {
        const jid = msg.key.remoteJid;
        
        const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        if (!quotedMessage?.imageMessage) {
            return await sendReply(sock, jid, '❌ Répondez à une image avec !url', { quoted: msg });
        }

        try {
            await sendReply(sock, jid, '📤 Upload en cours...', { quoted: msg });

            const imageUrl = await this.uploadImageToImgBB(quotedMessage.imageMessage);
            
            if (!imageUrl) {
                throw new Error('Échec de l\'upload');
            }

            // Envoi direct de l'URL uniquement
            await sock.sendMessage(jid, { 
                text: imageUrl 
            }, { quoted: msg });

            console.log(`🔗 [${phoneNumber}] Image convertie en URL: ${imageUrl}`);

        } catch (error) {
            console.error(`❌ [${phoneNumber}] Erreur conversion URL:`, error);
            await sendReply(sock, jid, `❌ Erreur: ${error.message}`, { quoted: msg });
        }
    },

    async uploadImageToImgBB(imageMessage) {
        try {
            const stream = await downloadContentFromMessage(imageMessage, 'image');
            if (!stream) {
                throw new Error('Impossible de télécharger l\'image');
            }

            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            if (!buffer || buffer.length === 0) {
                throw new Error('Image vide');
            }
            
            const formData = new FormData();
            formData.append('image', buffer.toString('base64'));
            
            const response = await axios.post('https://api.imgbb.com/1/upload', formData, {
                params: {
                    key: '254b685aea07ed364f7091dee628d26b'
                },
                headers: {
                    ...formData.getHeaders()
                },
                timeout: 30000
            });

            if (response.data?.data?.url) {
                console.log('✅ Image uploadée sur imgBB');
                return response.data.data.url;
            } else {
                throw new Error('Réponse invalide de imgBB');
            }

        } catch (error) {
            console.error('❌ Erreur upload imgBB:', error.message);
            throw new Error(`Upload échoué: ${error.message}`);
        }
    }
};