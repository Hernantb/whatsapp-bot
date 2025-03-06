require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Obtener claves de API desde las variables de entorno
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
const GUPSHUP_NUMBER = process.env.GUPSHUP_NUMBER;

// Verifica que las claves están configuradas
if (!OPENAI_API_KEY || !GUPSHUP_API_KEY || !GUPSHUP_NUMBER) {
    console.error("⚠️ ERROR: Faltan claves de API. Revisa las variables de 
entorno.");
    process.exit(1);
}

const conversationHistory = {};

// Endpoint de prueba
app.get('/', (req, res) => {
    res.send('✅ Bot de WhatsApp funcionando correctamente.');
});

// Webhook para recibir mensajes de WhatsApp desde Gupshup
app.post('/webhook', async (req, res) => {
    try {
        const messageData = req.body;
        console.log("📩 Mensaje recibido en bruto:", 
JSON.stringify(messageData, null, 2));

        if (!messageData || !messageData.entry || 
!messageData.entry[0].changes) {
            return res.status(400).send("Formato incorrecto.");
        }

        const messageEntry = messageData.entry[0].changes[0].value;
        if (!messageEntry.messages || messageEntry.messages.length === 0) 
{
            return res.status(400).send("No se encontraron mensajes.");
        }

        const message = messageEntry.messages[0];
        const sender = message.from;
        const text = message.text.body;

        console.log(`📩 Mensaje recibido de ${sender}: ${text}`);

        // Guardar historial de conversación
        if (!conversationHistory[sender]) {
            conversationHistory[sender] = [];
        }
        conversationHistory[sender].push({ role: "user", content: text });

        // Llamar a OpenAI
        const openaiResponse = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-4-turbo",
                messages: conversationHistory[sender],
            },
            {
                headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
            }
        );

        const botReply = openaiResponse.data.choices[0].message.content;
        conversationHistory[sender].push({ role: "assistant", content: 
botReply });

        // Enviar mensaje de respuesta por Gupshup
        await axios.post(
            "https://api.gupshup.io/sm/api/v1/msg",
            {
                channel: "whatsapp",
                source: GUPSHUP_NUMBER,
                destination: sender,
                message: botReply,
            },
            {
                headers: { "apikey": GUPSHUP_API_KEY },
            }
        );

        console.log(`✅ Mensaje enviado a ${sender}: ${botReply}`);
        res.send("Mensaje procesado correctamente.");
    } catch (error) {
        console.error("❌ Error en el webhook:", error);
        res.status(500).send("Error interno del servidor.");
    }
});

// Servidor en el puerto 3000 o el definido en Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});
