require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// 🔑 Cargar variables de entorno
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
const GUPSHUP_NUMBER = process.env.GUPSHUP_NUMBER;
const ASISTENTE_ID = "asst_bdJlX30wF1qQH3Lf8ZoiptVx"; // ID de Hernán CUPRA Master

// 🔍 Verificación de claves
console.log("🔑 API Keys cargadas:");
console.log("OPENAI_API_KEY:", OPENAI_API_KEY ? "✅ OK" : "❌ FALTA");
console.log("GUPSHUP_API_KEY:", GUPSHUP_API_KEY ? "✅ OK" : "❌ FALTA");
console.log("GUPSHUP_NUMBER:", GUPSHUP_NUMBER ? "✅ OK" : "❌ FALTA");

// ❌ Si faltan claves, detener el servidor
if (!OPENAI_API_KEY || !GUPSHUP_API_KEY || !GUPSHUP_NUMBER) {
    console.error("⚠️ ERROR: Faltan claves de API. Verifica las variables de entorno.");
    process.exit(1);
}

// 🏠 Ruta raíz para verificar que el servidor está activo
app.get('/', (req, res) => {
    res.send('Bot de WhatsApp funcionando');
});

// 📩 Webhook para recibir mensajes de WhatsApp
app.post('/webhook', async (req, res) => {
    try {
        console.log("📩 Mensaje recibido en bruto:", JSON.stringify(req.body, null, 2));

        // Validación del mensaje entrante
        const entry = req.body.entry?.[0];
        const changes = entry?.changes?.[0];
        const message = changes?.value?.messages?.[0];

        if (!message || !message.text || !message.text.body) {
            console.error("❌ Error: Formato incorrecto en el mensaje recibido.");
            return res.status(400).send("Formato incorrecto.");
        }

        const mensaje = message.text.body;
        const sender = message.from;

        console.log(`👤 Mensaje recibido de ${sender}: ${mensaje}`);

        // 🔹 Llamar a Hernán CUPRA Master en OpenAI
        const aiResponse = await axios.post(
            "https://api.openai.com/v1/threads",
            {
                assistant_id: ASISTENTE_ID,
                messages: [{ role: "user", content: mensaje }]
            },
            {
                headers: {
                    "Authorization": `Bearer ${OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const respuesta = aiResponse.data.choices?.[0]?.message?.content || "No tengo una respuesta en este momento.";
        console.log(`💬 Respuesta de Hernán CUPRA Master: ${respuesta}`);

        // 📨 Enviar la respuesta a WhatsApp mediante Gupshup
        const response = await axios.post(
            "https://api.gupshup.io/wa/api/v1/msg",
            new URLSearchParams({
                channel: "whatsapp",
                source: GUPSHUP_NUMBER,
                destination: sender,
                message: JSON.stringify({ type: "text", text: respuesta })
            }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "apikey": GUPSHUP_API_KEY
                }
            }
        );

        console.log(`✅ Mensaje enviado a ${sender}: ${respuesta}`);
        res.status(200).send("Mensaje procesado correctamente");

    } catch (error) {
        console.error("❌ Error procesando mensaje:", error.response?.data || error.message);
        res.status(500).send("Error interno");
    }
});

// 🟢 Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});

