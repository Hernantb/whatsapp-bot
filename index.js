require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// 🔑 Verifica que las variables de entorno están cargadas correctamente
console.log("🔑 API Keys cargadas:");
console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "✅ OK" : "❌ FALTA");
console.log("GUPSHUP_API_KEY:", process.env.GUPSHUP_API_KEY ? "✅ OK" : "❌ FALTA");
console.log("GUPSHUP_NUMBER:", process.env.GUPSHUP_NUMBER ? "✅ OK" : "❌ FALTA");

// Cargar claves de API desde variables de entorno
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
const GUPSHUP_NUMBER = process.env.GUPSHUP_NUMBER;

// Verifica que las claves están configuradas
if (!OPENAI_API_KEY || !GUPSHUP_API_KEY || !GUPSHUP_NUMBER) {
    console.error("⚠️ ERROR: Faltan claves de API. Revisa las variables de entorno.");
    process.exit(1);
}

// Ruta raíz para verificar que el servidor está corriendo
app.get('/', (req, res) => {
    res.send('Bot de WhatsApp funcionando');
});

// Webhook para recibir mensajes de Gupshup
app.post('/webhook', async (req, res) => {
    try {
        console.log("📩 Mensaje recibido en bruto:", JSON.stringify(req.body, null, 2));

        // Validar estructura del mensaje
        if (!req.body || !req.body.entry || !req.body.entry[0].changes) {
            console.error("❌ Error: Formato incorrecto en el mensaje recibido.");
            return res.status(400).send("Formato incorrecto en el mensaje recibido.");
        }

        const messageData = req.body.entry[0].changes[0].value.messages;
        if (!messageData || messageData.length === 0) {
            console.error("❌ Error: No se encontraron mensajes en la solicitud.");
            return res.status(400).send("No se encontraron mensajes.");
        }

        // Extraer información del mensaje
        const mensaje = messageData[0].text.body;
        const sender = messageData[0].from;
        console.log(`👤 Mensaje recibido de ${sender}: ${mensaje}`);

        // Generar respuesta con OpenAI (ChatGPT)
        const aiResponse = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-4-turbo",
                messages: [{ role: "system", content: "Responde de forma amable y breve." }, { role: "user", content: mensaje }],
            },
            {
                headers: {
                    "Authorization": `Bearer ${OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const respuestaAI = aiResponse.data.choices[0].message.content;
        console.log("💬 Respuesta de AI:", respuestaAI);

        // Enviar respuesta a WhatsApp usando Gupshup
        const responseGupshup = await axios.post('https://api.gupshup.io/wa/api/v1/msg', 
            new URLSearchParams({
                channel: "whatsapp",
                source: GUPSHUP_NUMBER,
                destination: sender,
                message: JSON.stringify({ type: "text", text: respuestaAI })
            }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "apikey": GUPSHUP_API_KEY
                }
            }
        );

        console.log("📤 Respuesta enviada a Gupshup:", responseGupshup.data);
        res.status(200).send("Mensaje procesado correctamente");

    } catch (error) {
        console.error("❌ Error procesando mensaje:", error.response?.data || error.message);
        res.status(500).send("Error interno del servidor");
    }
});

// Definir el puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});

