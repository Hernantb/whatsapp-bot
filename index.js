require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Verifica que las variables de entorno están cargadas correctamente
console.log("🔑 API Keys cargadas:");
console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "✅ OK" : "❌ FALTA");
console.log("GUPSHUP_API_KEY:", process.env.GUPSHUP_API_KEY ? "✅ OK" : "❌ FALTA");
console.log("GUPSHUP_NUMBER:", process.env.GUPSHUP_NUMBER ? "✅ OK" : "❌ FALTA");

// Cargar claves de API
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
const GUPSHUP_NUMBER = process.env.GUPSHUP_NUMBER;

if (!OPENAI_API_KEY || !GUPSHUP_API_KEY || !GUPSHUP_NUMBER) {
    console.error("⚠️ ERROR: Faltan claves de API. Revisa las variables de entorno en Render.");
    process.exit(1);
}

// Ruta de prueba
app.get('/', (req, res) => {
    res.send('Bot de WhatsApp funcionando');
});

// Webhook para recibir mensajes
app.post('/webhook', async (req, res) => {
    try {
        console.log("📩 Mensaje recibido en bruto:", JSON.stringify(req.body, null, 2));

        const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        if (!message) {
            console.error("❌ Formato del mensaje incorrecto.");
            return res.status(400).send("Formato no válido");
        }

        const sender = message.from;
        const text = message.text?.body || "Mensaje vacío";

        console.log(`📩 Mensaje recibido de ${sender}: ${text}`);

        // Generar respuesta automática
        const responseText = `Recibí tu mensaje: "${text}"`;

        // Enviar mensaje de vuelta a WhatsApp
        const response = await axios.post('https://api.gupshup.io/wa/api/v1/msg', {
            channel: "whatsapp",
            source: GUPSHUP_NUMBER,
            destination: String(sender),  // ✅ Convertir a string por seguridad
            message: { type: "text", text: responseText }
        }, {
            headers: {
                "Content-Type": "application/json",
                "apikey": GUPSHUP_API_KEY // ✅ Gupshup usa "apikey", no "Authorization"
            }
        });

        console.log("✅ Respuesta enviada a WhatsApp:", responseText);
        console.log("📨 Respuesta de Gupshup:", response.data);

        res.status(200).send("Mensaje procesado correctamente");

    } catch (error) {
        console.error("❌ Error procesando mensaje:", error.response?.data || error.message);
        res.status(500).send("Error interno");
    }
});

// Definir puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});











