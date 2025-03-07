app.post('/webhook', async (req, res) => {
    try {
        console.log("📩 LOG COMPLETO DEL MENSAJE RECIBIDO:", JSON.stringify(req.body, null, 2));

        let mensaje = null;
        let remitente = null;

        // Buscar el mensaje en diferentes estructuras
        if (req.body.entry && req.body.entry[0].changes && req.body.entry[0].changes[0].value.messages) {
            const messageData = req.body.entry[0].changes[0].value.messages[0];
            mensaje = messageData.text.body;
            remitente = messageData.from;
        } else if (req.body.message) {
            mensaje = req.body.message;
            remitente = req.body.sender || "Número desconocido";
        } else {
            console.error("❌ Error: Formato incorrecto en el mensaje recibido.");
            return res.status(400).send("Formato incorrecto en el mensaje recibido.");
        }

        console.log(`👤 Mensaje recibido de: ${remitente}`);
        console.log(`💬 Contenido del mensaje: ${mensaje}`);

        // 🔹 Enviar mensaje a OpenAI
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

