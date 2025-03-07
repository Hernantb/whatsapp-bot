app.post('/webhook', async (req, res) => {
    console.log("📩 Mensaje recibido en bruto:", JSON.stringify(req.body, null, 2));

    // Verificar si el mensaje tiene el formato correcto
    if (!req.body || !req.body.type || req.body.type !== "message") {
        console.log("❌ Formato incorrecto recibido.");
        return res.status(400).send("Formato no válido");
    }

    const mensaje = req.body.payload?.text || "Mensaje vacío";

    console.log("📩 Mensaje recibido de usuario:", mensaje);

    const respuesta = `Recibí tu mensaje: "${mensaje}"`;

    try {
        await axios.post('https://api.gupshup.io/wa/api/v1/msg', 
            new URLSearchParams({
                channel: "whatsapp",
                source: GUPSHUP_NUMBER,
                destination: req.body.sender?.phone || "DEFAULT_NUMBER",
                message: JSON.stringify({ type: "text", text: respuesta })
            }), 
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "apikey": GUPSHUP_API_KEY
                }
            }
        );

        console.log("✅ Respuesta enviada:", respuesta);
        res.status(200).send("Mensaje procesado correctamente");

    } catch (error) {
        console.error("❌ Error procesando mensaje:", error.response?.data || error.message);
        res.status(500).send("Error interno");
    }
});

