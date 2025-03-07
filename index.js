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

        // Verifica si el mensaje es válido
        if (!req.body || !req.body.type || !req.body.payload || !req.body.payload.sender) {
            return res.status(400).send("Formato no válido");
        }

        const sender = req.body.payload.sender.phone;
        const message = req.body.payload.payload.text;

        console.log(`📩 Mensaje recibido de ${sender}: ${message}`);

        // Generar respuesta con OpenAI (simulado por ahora)
        const responseText = `Recibí tu mensaje: "${message}"`;

        // Enviar mensaje de vuelta a WhatsApp con Gupshup
        const qs = new URLSearchParams();
        qs.append("channel", "whatsapp");
        qs.append("source", GUPSHUP_NUMBER);
        qs.append("destination", sender);
        qs.append("message", JSON.stringify({ type: "text", text: responseText }));

        const response = await axios.post('https://api.gupshup.io/wa/api/v1/msg', qs.toString(), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "apikey": GUPSHUP_API_KEY // ✅ Gupshup usa "apikey", NO "Authorization"
            }
        });

        console.log("✅ Respuesta enviada:", responseText);
        res.status(200).send("Mensaje procesado correctamente");

    } catch (error) {
        console.error("❌ Error procesando mensaje:", error.message);
        res.status(500).send("Error interno");
    }
});

// Definir el puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});





