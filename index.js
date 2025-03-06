require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Ruta de prueba para verificar que el servidor está funcionando
app.get('/', (req, res) => {
    res.send('Bot de WhatsApp funcionando');
});

// Webhook para recibir mensajes de Gupshup
app.post('/webhook', async (req, res) => {
    console.log("📩 Mensaje recibido en bruto:", JSON.stringify(req.body, 
null, 2));

    // Validar si el objeto recibido tiene la estructura esperada
    if (!req.body.entry || !req.body.entry[0].changes) {
        console.log("⚠️ Formato de mensaje no reconocido");
        return res.status(400).send("Formato no válido");
    }

    // Extraer datos reales del mensaje desde la estructura de Gupshup
    const changes = req.body.entry[0].changes[0];
    if (!changes.value || !changes.value.messages || 
changes.value.messages.length === 0) {
        console.log("⚠️ No hay mensajes en la solicitud");
        return res.status(400).send("Sin mensajes");
    }

    // Extraer información del remitente y mensaje
    const sender = changes.value.messages[0].from;
    const message = changes.value.messages[0].text.body;

    console.log(`📩 Mensaje recibido de ${sender}: ${message}`);

    if (!sender || !message) {
        return res.status(400).send("Datos inválidos");
    }

    // Llamar a OpenAI con el asistente
    const response = await axios.post(
        
"https://api.openai.com/v1/assistants/asst_bdJlX30wF1qQH3Lf8ZoiptVx/messages",
        {
            model: "gpt-4-turbo",
            messages: [{ role: "user", content: message }],
        },
        {
            headers: { Authorization: `Bearer 
${process.env.OPENAI_API_KEY}` },
        }
    );

    const botResponse = response.data.choices[0].message.content;

    // Enviar respuesta a Gupshup
    await axios.post(
        "https://api.gupshup.io/sm/api/v1/msg",
        {
            channel: "whatsapp",
            source: "TU_NUMERO_GUPSHUP",
            destination: sender,
            message: botResponse,
        },
        {
            headers: { "apikey": process.env.GUPSHUP_API_KEY },
        }
    );

    res.send("Mensaje enviado");
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});








