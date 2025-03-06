require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json());

// Ruta principal
app.get('/', (req, res) => {
    res.send('Bot de WhatsApp funcionando');
});

// 📌 Agregar soporte GET para probar en navegador
app.get('/webhook', (req, res) => {
    res.send("✅ Webhook activo y esperando mensajes.");
});

// 📌 Webhook que usará Gupshup (acepta POST)
app.post('/webhook', (req, res) => {
    console.log("📩 Webhook recibido:", req.body);
    res.status(200).send("Webhook funcionando");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});



