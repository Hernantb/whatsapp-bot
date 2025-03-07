require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// 🔑 Verificar que las claves están bien cargadas
console.log("🔑 API Keys cargadas:");
console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "✅ OK" : "❌ FALTA");
console.log("GUPSHUP_API_KEY:", process.env.GUPSHUP_API_KEY ? "✅ OK" : "❌ FALTA");
console.log("GUPSHUP_NUMBER:", process.env.GUPSHUP_NUMBER ? "✅ OK" : "❌ FALTA");

// Cargar claves desde variables de entorno
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

        // 🛑 Ajustamos la estructura del mensaje según los logs
        const mensaje = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body;
        const sender = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;

        if (!mensaje || !sender) {
            console.log("❌ Error: No se pudo extraer el mensaje o el remitente.");
            return res.status(400).send("Formato no válido");
        }

        console.log("👤 Mensaje recibido de:", sender);
        console.log("💬 Contenido del mensaje:", mensaje);

        // Respuesta automática
        const respuesta = `Hola! Recibí tu mensaje: "${mensaje}"`;

        console.log("📤 Enviando respuesta a Gupshup...");

        // Enviar respuesta a WhatsApp usando Gupshup
        const response = await axios({
            method: 'POST',
            url: 'https://api.gupshup.io/wa/api/v1/msg',
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "apikey": GUPSHUP_API_KEY
            },
            data: new URLSearchParams({
                channel: "whatsapp",
                source: GUPSHUP_NUMBER,
                destination: sender,
                message: JSON.stringify({ type: "text", text: respuesta })
            })
        });

        console.log("✅ Respuesta enviada con éxito a Gupshup:", response.data);
        res.status(200).send("Mensaje procesado correctamente");

    } catch (error) {
        console.error("❌ Error al enviar mensaje a Gupshup:");
        if (error.response) {
            console.error("🔴 Respuesta de Gupshup:", error.response.data);
        } else {
            console.error("🔴 Error general:", error.message);
        }
        res.status(500).send("Error interno al procesar el mensaje.");
    }
});

// Definir el puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});

