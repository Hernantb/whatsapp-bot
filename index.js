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

// 🔧 Parche de URL: Corregir CONTROL_PANEL_URL si es necesario
console.log("🔧 APLICANDO PARCHE PARA CORREGIR URLs DEL BOT WHATSAPP");
let originalUrl = process.env.CONTROL_PANEL_URL || 'http://localhost:3001';
console.log("CONTROL_PANEL_URL actual:", originalUrl);

// Detectar entorno
const isProd = process.env.NODE_ENV === 'production';
console.log("Ambiente:", isProd ? "Producción" : "Desarrollo");

// Corregir URL duplicada
if (originalUrl.includes('/register-bot-response/register-bot-response')) {
    originalUrl = originalUrl.replace('/register-bot-response/register-bot-response', '/register-bot-response');
}

// Verificar dominios antiguos y corregirlos
if (isProd && originalUrl.includes('panel-control-whatsapp.onrender.com')) {
    originalUrl = originalUrl.replace('panel-control-whatsapp.onrender.com', 'render-wa.onrender.com');
}

// Corregir estructura
if (originalUrl.endsWith('/register-bot-response')) {
    // URL ya tiene el endpoint, no necesita cambios
    process.env.CONTROL_PANEL_URL = originalUrl.trim();
} else if (originalUrl.includes('/register-bot-response/')) {
    // URL tiene endpoint duplicado
    process.env.CONTROL_PANEL_URL = originalUrl.split('/register-bot-response/')[0] + '/register-bot-response';
} else {
    // URL no tiene endpoint, agregar si no termina en /
    process.env.CONTROL_PANEL_URL = originalUrl.endsWith('/') 
        ? originalUrl.slice(0, -1) + '/register-bot-response'
        : originalUrl + '/register-bot-response';
}

console.log("URL que se usará:", process.env.CONTROL_PANEL_URL);
console.log("✅ Parche aplicado correctamente");
console.log("📝 De ahora en adelante, las URLs duplicadas serán corregidas automáticamente");
console.log("🌐 En ambiente de producción, se usará:", isProd ? process.env.CONTROL_PANEL_URL : "URL de desarrollo");
console.log("🔍 También puedes usar la función global registerBotResponse() para enviar mensajes");

// URL del servidor de control panel
const CONTROL_PANEL_URL = process.env.CONTROL_PANEL_URL || 'http://localhost:3001';
// Nivel de logging
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
// Forzar guardado en Supabase
const FORCE_SAVE_TO_SUPABASE = process.env.FORCE_SAVE_TO_SUPABASE === 'true';

// 🗂 Almacena el historial de threads de usuarios
const userThreads = {};

// 🚀 Verificar API Keys
console.log("🔑 API Keys cargadas:");
console.log("OPENAI_API_KEY:", OPENAI_API_KEY ? "✅ OK" : "❌ FALTA");
console.log("GUPSHUP_API_KEY:", GUPSHUP_API_KEY ? "✅ OK" : "❌ FALTA");
console.log("GUPSHUP_NUMBER:", GUPSHUP_NUMBER ? "✅ OK" : "❌ FALTA");
console.log("CONTROL_PANEL_URL:", CONTROL_PANEL_URL);

// Verificar si CONTROL_PANEL_URL es válido
if (CONTROL_PANEL_URL.includes('api.openai.com')) {
    console.error("🚨 ERROR GRAVE: CONTROL_PANEL_URL está configurado incorrectamente a api.openai.com");
    console.error("🚨 Por favor, actualiza .env con la URL correcta de tu aplicación");
} else if (CONTROL_PANEL_URL.includes('localhost') && process.env.NODE_ENV === 'production') {
    console.warn("⚠️ Advertencia: CONTROL_PANEL_URL está configurado a localhost en entorno de producción");
    console.warn("⚠️ Esto podría causar problemas al registrar respuestas");
}

// ❌ Si faltan claves, detener el servidor
if (!OPENAI_API_KEY || !GUPSHUP_API_KEY || !GUPSHUP_NUMBER) {
    console.error("⚠️ ERROR: Faltan claves de API. Verifica las variables de entorno.");
    process.exit(1);
}

// Función para registrar respuestas en el control panel
async function registerBotResponse(conversationId, message, threadId) {
    try {
        if (!conversationId || !message) {
            console.error("❌ No se puede registrar la respuesta: faltan datos esenciales");
            return { success: false, error: "Datos incompletos" };
        }

        console.log(`🔄 Registrando respuesta del bot para conversación ${conversationId}`);
        
        // Validar si CONTROL_PANEL_URL apunta a OpenAI (configuración incorrecta común)
        if (CONTROL_PANEL_URL.includes('api.openai.com')) {
            console.error("🚨 ERROR: CONTROL_PANEL_URL apunta a api.openai.com, esto es incorrecto");
            console.error("🚨 Actualiza el archivo .env con la URL correcta");
            return { success: false, error: "URL de control panel mal configurada" };
        }
        
        const timestamp = new Date().toISOString();
        
        // Evitar duplicación de /register-bot-response en la URL
        let apiUrl = CONTROL_PANEL_URL;
        if (!apiUrl.endsWith('/register-bot-response')) {
            apiUrl = `${apiUrl}/register-bot-response`;
        }
        
        console.log(`🔄 Registrando respuesta del bot en el control panel: ${apiUrl}`);
        
        // Intentar enviar la respuesta al control panel
        const response = await axios.post(apiUrl, {
            conversationId,
            message,
            threadId,
            timestamp
        });
        
        console.log("✅ Respuesta del bot registrada exitosamente");
        return { success: true, data: response.data };
    } catch (error) {
        console.error("❌ Error al registrar respuesta en el control panel:", error.message);
        
        if (error.response) {
            console.error(`🔍 Código de respuesta: ${error.response.status}`);
            console.error("🔍 Respuesta del servidor:", error.response.data);
        }
        
        return { success: false, error: error.message };
    }
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
            const result = await registerBotResponse(
                userThreads[sender].conversationId,
                respuesta,
                threadId
            );
            
            if (!result.success) {
                console.error(`❌ Error al registrar respuesta en el control panel: ${result.error}`);
            }
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
        message: "WhatsApp API server is running",
        config: {
            control_panel: CONTROL_PANEL_URL
        }
    });
});

// 🟢 Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});

