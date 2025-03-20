require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// 🔑 Cargar claves de API
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
const GUPSHUP_NUMBER = process.env.GUPSHUP_NUMBER;
const ASISTENTE_ID = "asst_bdJlX30wF1qQH3Lf8ZoiptVx"; // ID de Hernán CUPRA Master
// URL del servidor de control panel
const CONTROL_PANEL_URL = process.env.CONTROL_PANEL_URL || 'http://localhost:4000';

// 🗂 Almacena el historial de threads de usuarios
const userThreads = {};

// 🚀 Verificar API Keys
console.log("🔑 API Keys cargadas:");
console.log("OPENAI_API_KEY:", OPENAI_API_KEY ? "✅ OK" : "❌ FALTA");
console.log("GUPSHUP_API_KEY:", GUPSHUP_API_KEY ? "✅ OK" : "❌ FALTA");
console.log("GUPSHUP_NUMBER:", GUPSHUP_NUMBER ? "✅ OK" : "❌ FALTA");
console.log("CONTROL_PANEL_URL:", CONTROL_PANEL_URL);

// ❌ Si faltan claves, detener el servidor
if (!OPENAI_API_KEY || !GUPSHUP_API_KEY || !GUPSHUP_NUMBER) {
    console.error("⚠️ ERROR: Faltan claves de API. Verifica las variables de entorno.");
    process.exit(1);
}

// 📩 Webhook para recibir mensajes de WhatsApp
app.post('/webhook', async (req, res) => {
    try {
        console.log("📩 Mensaje recibido en bruto:", JSON.stringify(req.body, null, 2));

        // Extraer información básica
        const entry = req.body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;

        // Verificar si es una notificación de estado
        if (value?.statuses && Array.isArray(value.statuses) && value.statuses.length > 0) {
            const status = value.statuses[0];
            console.log(`📊 Notificación de estado: ${status.status} para mensaje enviado a ${status.recipient_id}`);
            return res.status(200).send("Estado recibido correctamente");
        }
        
        // Verificar si es un mensaje de texto
        const message = value?.messages?.[0];
        if (!message) {
            console.log("ℹ️ No se encontró un mensaje para procesar");
            return res.status(200).send("Evento recibido pero no procesable");
        }

        // Verificar si el mensaje tiene texto
        if (!message.text || !message.text.body) {
            console.log(`ℹ️ Mensaje de tipo ${message.type} recibido, pero no contiene texto`);
            return res.status(200).send("Mensaje sin texto recibido");
        }

        const mensaje = message.text.body;
        const sender = message.from;

        console.log(`👤 Mensaje recibido de ${sender}: ${mensaje}`);

        // 🔹 Evitar responder a mensajes duplicados
        if (message.id && userThreads[sender]?.lastMessageId === message.id) {
            console.log("⚠️ Mensaje duplicado detectado. Ignorando...");
            return res.status(200).send("Mensaje duplicado, ignorado.");
        }

        // Guardar el último mensaje procesado
        userThreads[sender] = {
            lastMessageId: message.id,
            threadId: userThreads[sender]?.threadId || null,
            conversationId: userThreads[sender]?.conversationId || sender // Usar el número como ID si no hay otro
        };

        // 🔹 Crear un nuevo thread si es un usuario nuevo
        let threadId = userThreads[sender].threadId;
        if (!threadId) {
            console.log(`🆕 Creando nuevo thread para usuario: ${sender}`);
            const threadResponse = await axios.post(
                "https://api.openai.com/v1/threads",
                {},
                {
                    headers: {
                        "Authorization": `Bearer ${OPENAI_API_KEY}`,
                        "Content-Type": "application/json",
                        "OpenAI-Beta": "assistants=v2"
                    }
                }
            );
            threadId = threadResponse.data.id;
            userThreads[sender].threadId = threadId;
        } else {
            console.log(`🔄 Continuando conversación con thread_id: ${threadId}`);
        }

        // 🔹 Enviar mensaje al asistente en OpenAI
        await axios.post(
            `https://api.openai.com/v1/threads/${threadId}/messages`,
            { role: "user", content: mensaje },
            {
                headers: {
                    "Authorization": `Bearer ${OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                    "OpenAI-Beta": "assistants=v2"
                }
            }
        );

        // 🔹 Ejecutar al asistente en el thread
        const runResponse = await axios.post(
            `https://api.openai.com/v1/threads/${threadId}/runs`,
            { assistant_id: ASISTENTE_ID },
            {
                headers: {
                    "Authorization": `Bearer ${OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                    "OpenAI-Beta": "assistants=v2"
                }
            }
        );

        const runId = runResponse.data.id;

        // 🔹 Esperar la respuesta del asistente
        let aiResponse;
        let retries = 10;
        while (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000));

            const statusResponse = await axios.get(
                `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
                {
                    headers: {
                        "Authorization": `Bearer ${OPENAI_API_KEY}`,
                        "Content-Type": "application/json",
                        "OpenAI-Beta": "assistants=v2"
                    }
                }
            );

            if (statusResponse.data.status === "completed") {
                aiResponse = statusResponse.data;
                break;
            }
            retries--;
        }

        // 🔹 Obtener la respuesta del asistente
        const messagesResponse = await axios.get(
            `https://api.openai.com/v1/threads/${threadId}/messages`,
            {
                headers: {
                    "Authorization": `Bearer ${OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                    "OpenAI-Beta": "assistants=v2"
                }
            }
        );

        const respuesta = messagesResponse.data.data?.[0]?.content?.[0]?.text?.value || "No tengo una respuesta en este momento.";
        console.log(`💬 Respuesta de Hernán CUPRA Master: ${respuesta}`);

        // 📨 Enviar la respuesta a WhatsApp mediante Gupshup
        await axios.post(
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

        // 🔄 Registrar la respuesta del bot en el servidor de control panel
        try {
            console.log(`🔄 Registrando respuesta del bot en el control panel: ${CONTROL_PANEL_URL}/register-bot-response`);
            await axios.post(`${CONTROL_PANEL_URL}/register-bot-response`, {
                conversationId: userThreads[sender].conversationId,
                message: respuesta,
                timestamp: new Date().toISOString()
            });
            console.log(`✅ Respuesta del bot registrada en el control panel`);
        } catch (registroError) {
            console.error(`❌ Error al registrar respuesta en el control panel:`, registroError.message);
            // No fallamos el proceso principal si el registro falla
        }

        res.status(200).send("Mensaje procesado correctamente");

    } catch (error) {
        console.error("❌ Error procesando mensaje:", error.response?.data || error.message);
        res.status(500).send("Error interno");
    }
});

// Endpoint para verificar que el servidor está funcionando
app.get('/', (req, res) => {
    res.status(200).json({
        status: "ok", 
        message: "WhatsApp API server is running"
    });
});

// 🟢 Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});

