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

        // Validar si el mensaje tiene el formato correcto
        if (!req.body || !req.body.entry || !req.body.entry[0].changes[0].value.messages) {
            return res.status(400).send("Formato no válido");
        }

        // Extraer el mensaje del usuario
        const mensajeUsuario = req.body.entry[0].changes[0].value.messages[0].text.body;
        const numeroUsuario = req.body.entry[0].changes[0].value.messages[0].from;

        console.log(`📩 Mensaje recibido de ${numeroUsuario}: ${mensajeUsuario}`);

        // Generar una respuesta simple (puedes cambiarlo por una respuesta con OpenAI)
        const respuestaBot = `Hola! Recibí tu mensaje: "${mensajeUsuario}"`;

        // Enviar la respuesta a WhatsApp usando Gupshup
        const response = await axios.post("https://api.gupshup.io/wa/api/v1/msg", 
        new URLSearchParams({
            channel: "whatsapp",
            source: GUPSHUP_NUMBER,
            destination: numeroUsuario,
            message: JSON.stringify({ type: "text", text: respuestaBot })
        }), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "apikey": GUPSHUP_API_KEY
            }
        });

        console.log("✅ Respuesta enviada:", respuestaBot);
        res.status(200).send("Mensaje procesado correctamente");

    } catch (error) {
        console.error("❌ Error procesando mensaje:", error.response ? error.response.data : error.message);
        res.status(500).send("Error interno");
    }
});

// Definir el puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});

