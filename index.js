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
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "DEFAULT_KEY";
const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY || "DEFAULT_GUPSHUP_KEY";
const GUPSHUP_NUMBER = process.env.GUPSHUP_NUMBER || "DEFAULT_NUMBER";

// Verifica que las claves están configuradas
if (!process.env.OPENAI_API_KEY || !process.env.GUPSHUP_API_KEY || !process.env.GUPSHUP_NUMBER) {
    console.error("⚠️ ERROR: Faltan claves de API. Revisa las variables de entorno en Render.");
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

        // Verifica que el mensaje tenga la estructura correcta
        if (!req.body.entry || !req.body.entry[0].changes || !req.body.entry[0].changes[0].value.messages) {
            console.error("❌ Error: Formato incorrecto en el mensaje recibido.");
            return res.status(400).send("Formato no válido");
        }

        const mensaje = req.body.entry[0].changes[0].value.messages[0].text.body;
        const sender = req.body.entry[0].changes[0].value.messages[0].from;

        console.log("👤 Mensaje recibido de:", sender);
        console.log("💬 Contenido del mensaje:", mensaje);

        // Genera una respuesta simple
        const respuesta = `Recibí tu mensaje: "${mensaje}"`;

        console.log("📤 Enviando respuesta a Gupshup...");

        // Enviar respuesta a WhatsApp usando Gupshup
        const response = await axios.post('https://api.gupshup.io/wa/api/v1/msg', null, {
            params: {
                channel: "whatsapp",
                source: GUPSHUP_NUMBER,
                destination: sender,
                message: JSON.stringify({ type: "text", text: respuesta }),
            },
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "apikey": GUPSHUP_API_KEY
            }
        });

        console.log("✅ Respuesta de Gupshup:", response.data);
        res.status(200).send("Mensaje procesado correctamente");

    } catch (error) {
        console.error("❌ Error al enviar mensaje a Gupshup:", error.response ? error.response.data : error.message);
        res.status(500).send("Error interno");
    }
});

// Definir el puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});

