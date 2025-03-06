require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json());

// Verifica que la API responda en la raíz
app.get('/', (req, res) => {
    res.send('Bot de WhatsApp funcionando');
});

// Webhook para recibir mensajes de Gupshup
app.post('/webhook', (req, res) => {
    console.log("📩 Mensaje recibido:", req.body);
    res.status(200).send("Webhook funcionando");
});

// Asegurar que Render detecte el puerto correcto
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});






