require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// 🔑 Verificar API Keys
console.log("🔑 API Keys cargadas:");
console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "✅ OK" : "❌ FALTA");
console.log("GUPSHUP_API_KEY:", process.env.GUPSHUP_API_KEY ? "✅ OK" : "❌ FALTA");
console.log("GUPSHUP_NUMBER:", process.env.GUPSHUP_NUMBER ? "✅ OK" : "❌ FALTA");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
const GUPSHUP_NUMBER = process.env.GUPSHUP_NUMBER.replace("+", ""); // Asegura formato sin "+"

// 🚀 Verificar que las API Keys están cargadas correctamente
if (!OPENAI_API_KEY || !GUPSHUP_API_KEY || !GUPSHUP_NUMBER) {
    console.error("⚠️ ERROR: Faltan claves de API. Revisa las variables de entorno.");
    process.exit(1);
}

// 📌 Ruta raíz
app.get('/', (req, res) => {
    res.send('Bot de WhatsApp funcionando');
});

// 📩 Webhook para recibir mensajes
app.post('/webhook', async (req, res) => {
    try {
        console.log("📩 Mensaje recibido en bruto:", JSON.stringify(req.body, null, 2));

        // Extraer mensaje y remitente
        let mensaje, remitente;
        if (req.body.type === "message" && req.body.payload) {
            mensaje = req.body.payload.payload.text;
            remitente = req.body.payload.sender.phone;
        } else {
            console.error("❌ Error: Formato incorrecto en el mensaje recibido.");
            return res.status(400).send("Formato incorrecto en el mensaje recibido.");
        }

        console.log(`👤 Mensaje recibido de: ${remitente}`);
        console.log(`💬 Contenido del mensaje: ${mensaje}`);

        // 🔹 Enviar mensaje a OpenAI (ChatGPT)
        const openaiResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4-turbo",
            messages: [{ role: "system", content: "Eres Hernán CUPRA Master..." }, { role: "user", content: mensaje }]
        }, {
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            }
        });

        const respuesta = openaiResponse.data.choices[0].message.content.trim();
        console.log("🤖 Respuesta de OpenAI:", respuesta);

        // 📤 Enviar respuesta a Gupshup
        console.log("📤 Enviando respuesta a Gupshup...");
        const gupshupResponse = await axios.post('https://api.gupshup.io/wa/api/v1/msg', null, {
            params: {
                channel: "whatsapp",
                source: GUPSHUP_NUMBER,
                destination: remitente,
                message: JSON.stringify({ type: "text", text: respuesta })
            },
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "apikey": GUPSHUP_API_KEY
            }
        });

        console.log("✅ Respuesta enviada a WhatsApp:", gupshupResponse.data);
        res.status(200).send("Mensaje procesado correctamente");

    } catch (error) {
        console.error("❌ Error al enviar mensaje:", error.response ? error.response.data : error.message);
        res.status(500).send("Error interno");
    }
});

// 🌐 Iniciar servidor en Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});

