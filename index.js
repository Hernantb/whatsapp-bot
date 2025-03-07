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

        if (!req.body || !req.body.message) {
            return res.status(400).send("Formato no válido");
        }

        const mensaje = req.body.message;

        // Aquí puedes procesar el mensaje y generar una respuesta
        const respuesta = `Recibí tu mensaje: "${mensaje}"`;

        // Enviar respuesta a WhatsApp usando Gupshup
        await axios.post('https://api.gupshup.io/wa/api/v1/msg', {
            channel: "whatsapp",
            source: GUPSHUP_NUMBER,
            destination: req.body.sender || "DEFAULT_NUMBER",
            message: { type: "text", text: respuesta }
        }, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${GUPSHUP_API_KEY}`
            }
        });

        console.log("✅ Respuesta enviada:", respuesta);
        res.status(200).send("Mensaje procesado correctamente");

    } catch (error) {
        console.error("❌ Error procesando mensaje:", error);
        res.status(500).send("Error interno");
    }
});

// Definir el puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});

