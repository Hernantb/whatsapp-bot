const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Configuración del cliente de WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox']
    }
});

// Variables de estado
let isAuthenticated = false;
let isReady = false;

// Función para verificar mensajes pendientes
async function checkPendingMessages() {
    try {
        const response = await axios.get('http://localhost:4001/bot-pending-messages');
        const messages = response.data;
        
        if (messages && messages.length > 0) {
            console.log('Mensajes pendientes encontrados:', messages);
            
            for (const message of messages) {
                try {
                    await client.sendMessage(message.phone, message.message);
                    console.log('Mensaje enviado exitosamente a:', message.phone);
                    
                    // Actualizar estado del mensaje en el servidor
                    await axios.post('http://localhost:4001/update-message-status', {
                        messageId: message._id,
                        status: 'sent'
                    });
                } catch (error) {
                    console.error('Error al enviar mensaje:', error);
                    // Actualizar estado del mensaje como fallido
                    await axios.post('http://localhost:4001/update-message-status', {
                        messageId: message._id,
                        status: 'failed',
                        error: error.message
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error al verificar mensajes pendientes:', error);
    }
}

// Iniciar verificación periódica de mensajes
setInterval(checkPendingMessages, 5000);

// Eventos del cliente WhatsApp
client.on('qr', (qr) => {
    console.log('🔐 CÓDIGO QR GENERADO - ESCANEA CON WHATSAPP:');
    qrcode.generate(qr, { small: true });
    console.log('===========================================');
});

client.on('ready', () => {
    console.log('✅ Cliente WhatsApp listo y autenticado!');
    isReady = true;
    isAuthenticated = true;
});

client.on('authenticated', () => {
    console.log('✅ Cliente WhatsApp autenticado exitosamente!');
    isAuthenticated = true;
});

client.on('auth_failure', () => {
    console.error('❌ Error de autenticación WhatsApp');
    isAuthenticated = false;
});

client.on('disconnected', (reason) => {
    console.log('❌ Cliente WhatsApp desconectado:', reason);
    isReady = false;
});

// Inicializar el cliente
client.initialize();

// Endpoint para verificar estado del bot
app.get('/bot-status', (req, res) => {
    res.json({
        isAuthenticated,
        isReady,
        timestamp: new Date().toISOString()
    });
});

// Endpoint para enviar mensaje
app.post('/send-message', async (req, res) => {
    try {
        const { phone, message } = req.body;
        
        if (!phone || !message) {
            return res.status(400).json({ error: 'Phone y message son requeridos' });
        }

        if (!isReady) {
            return res.status(503).json({ error: 'Bot no está listo' });
        }

        console.log('📤 Enviando mensaje a:', phone);
        console.log('📝 Contenido:', message);

        await client.sendMessage(phone, message);
        console.log('✅ Mensaje enviado exitosamente');
        
        res.json({ success: true, message: 'Mensaje enviado exitosamente' });
    } catch (error) {
        console.error('❌ Error al enviar mensaje:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para reiniciar el bot
app.post('/restart-bot', async (req, res) => {
    try {
        await client.destroy();
        await client.initialize();
        res.json({ success: true, message: 'Bot reiniciado exitosamente' });
    } catch (error) {
        console.error('Error al reiniciar el bot:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});

