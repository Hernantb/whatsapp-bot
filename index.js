require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;

if (!OPENAI_API_KEY || !GUPSHUP_API_KEY) {
    console.error("⚠️ ERROR: Faltan claves de API. Revisa las variables de 
entorno.");
    process.exit(1); // Detiene el servidor si faltan claves
}

// Verifica que la API responda en la raíz
app.get('/', (req, res) => {
    res.send('Bot de WhatsApp funcionando');
});

// Webhook para recibir mensajes de Gupshup
app.post('/webhook', async (req, res) => {
    console.log("📩 Mensaje recibido en bruto:", JSON.stringify(req.body, 
null, 2));

    try {
        // Validar estructura del webhook de Gupshup
        const { entry } = req.body;
        if (!entry || !entry[0]?.changes) {
            return res.status(400).send("Formato incorrecto de mensaje");
        }

        const messageData = entry[0].changes[0].value.messages?.[0];
        if (!messageData) {
            return res.status(400).send("No hay mensaje válido en el 
webhook");
        }

        const sender = messageData.from;
        const message = messageData.text?.body || "";

        console.log(`📩 Mensaje recibido de ${sender}: ${message}`);

        // Enviar el mensaje a OpenAI
        const openaiResponse = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-4-turbo",
                messages: [{ role: "user", content: message }]
            },
            {
                headers: {
                    "Authorization": `Bearer ${OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const botReply = openaiResponse.data.choices[0].message.content;
        console.log(`🤖 Respuesta de OpenAI: ${botReply}`);

        // Enviar la respuesta a WhatsApp a través de Gupshup
        await axios.post(
            "https://api.gupshup.io/sm/api/v1/msg",
            {
                channel: "whatsapp",
                source: "TU_NUMERO_GUPSHUP",
                destination: sender,
                message: botReply,
            },
            {
                headers: {
                    "apikey": GUPSHUP_API_KEY,
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        );

        console.log(`✅ Mensaje enviado a ${sender}`);
        res.send("Mensaje enviado correctamente");
    } catch (error) {
        console.error("🚨 Error al procesar el mensaje:", error.message);
        res.status(500).send("Error interno del servidor");
    }
});

// Definir el puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});









