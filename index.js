// Cargar el parche global que define registerBotResponse
require('./global-patch.js');

// Importaciones principales
const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno
dotenv.config();

// Configuración de OpenAI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID || "proj_Xfvuzj63nhqR6MJkIcFt8oz8"; // ID del asistente del usuario
const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
const GUPSHUP_NUMBER = process.env.GUPSHUP_NUMBER;
const GUPSHUP_USERID = process.env.GUPSHUP_USERID || '2000233790';
const PORT = process.env.PORT || 3010;
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
    originalUrl = originalUrl.replace('panel-control-whatsapp.onrender.com', 'whatsapp-bot-if6z.onrender.com');
}

// Si la URL contiene el dominio antiguo, actualizarlo
if (originalUrl.includes('render-wa.onrender.com')) {
    originalUrl = originalUrl.replace('render-wa.onrender.com', 'whatsapp-bot-if6z.onrender.com');
    console.log("URL actualizada a dominio correcto:", originalUrl);
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

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// URL del servidor de control panel
const CONTROL_PANEL_URL = process.env.CONTROL_PANEL_URL || 'https://whatsapp-bot-if6z.onrender.com';
const BUSINESS_ID = process.env.BUSINESS_ID || '2d385aa5-40e0-4ec9-9360-19281bc605e4';

// Configuración express
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 🗂 Almacena el historial de threads de usuarios
const userThreads = {};

// 🚀 Verificar API Keys
console.log("🔑 API Keys cargadas:");
console.log("OPENAI_API_KEY:", OPENAI_API_KEY ? "✅ OK" : "❌ FALTA");
console.log("GUPSHUP_API_KEY:", GUPSHUP_API_KEY ? "✅ OK" : "❌ FALTA");
console.log("GUPSHUP_NUMBER:", GUPSHUP_NUMBER ? "✅ OK" : "❌ FALTA");
console.log("GUPSHUP_USERID:", GUPSHUP_USERID ? "✅ OK" : "❌ FALTA");
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
        
        // Actualizar URL si contiene el dominio antiguo
        if (apiUrl.includes('render-wa.onrender.com')) {
            apiUrl = apiUrl.replace('render-wa.onrender.com', 'whatsapp-bot-if6z.onrender.com');
            console.log("URL del panel actualizada a:", apiUrl);
        }
        
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

// Punto de entrada para webhooks de WhatsApp
app.post('/webhook', async (req, res) => {
  try {
    console.log('📩 Mensaje recibido en webhook:', JSON.stringify(req.body));
    
    // Procesar el mensaje
    const { message, sender } = extractMessageData(req.body);
    
    if (!message || !sender) {
      console.log('⚠️ Mensaje no válido o no es un mensaje de texto');
      return res.status(200).send('OK');
    }
    
    console.log(`👤 Mensaje recibido de ${sender}: ${message}`);
    
    // Enviar mensaje a OpenAI
    const response = await processMessageWithOpenAI(sender, message);
    
    // Enviar respuesta a WhatsApp
    await sendWhatsAppResponse(sender, response);
    
    // Usar try/catch específico para el registro en panel de control
    try {
      // Registrar respuesta en el panel de control usando la función global
      console.log(`🔄 Intentando registrar respuesta con business_id: ${BUSINESS_ID}`);
      
      // Usar la función global registerBotResponse para guardar en Supabase
      const result = await global.registerBotResponse(sender, response, BUSINESS_ID);
      
      // Verificar resultado
      if (result && result.success === true) {
        console.log(`✅ Respuesta guardada correctamente en Supabase`);
      } else {
        console.error(`❌ Error al guardar en Supabase: ${result?.error || 'Error desconocido'}`);
      }
      
      // También usar la función local para el panel de control
      const panelResult = await registerBotResponse(sender, response, BUSINESS_ID);
      
      // Verificar específicamente el resultado
      if (panelResult && panelResult.success === false) {
        console.error(`❌ Fallo al registrar respuesta en panel: ${panelResult.error || 'Error desconocido'}`);
      } else {
        console.log(`✅ Respuesta registrada correctamente en el panel de control`);
      }
    } catch (controlPanelError) {
      console.error(`❌ Error al registrar respuesta: ${controlPanelError.message}`);
      // No interrumpimos el flujo principal por un error en el registro
    }
    
    return res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error procesando webhook:', error.message);
    return res.status(500).send('Error');
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
app.listen(PORT, () => {
    console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
    console.log(`🤖 Bot conectado al panel: ${CONTROL_PANEL_URL}`);
});

// Función para extraer datos del mensaje
function extractMessageData(body) {
  try {
    // Para mensajes de WhatsApp via GupShup
    if (body.entry && body.entry[0] && body.entry[0].changes) {
      const changes = body.entry[0].changes;
      
      for (const change of changes) {
        if (change.field === 'messages' && change.value && change.value.messages && change.value.messages.length > 0) {
          const message = change.value.messages[0];
          const sender = message.from;
          
          if (message.type === 'text' && message.text && message.text.body) {
            return {
              message: message.text.body,
              sender: sender,
              timestamp: message.timestamp
            };
          }
        }
      }
    }
    
    console.log('⚠️ Formato de mensaje no reconocido:', JSON.stringify(body));
    return { message: null, sender: null };
  } catch (error) {
    console.error('❌ Error al extraer datos del mensaje:', error.message);
    return { message: null, sender: null };
  }
}

// Función para procesar mensaje con OpenAI
async function processMessageWithOpenAI(sender, message) {
  try {
    console.log(`⚙️ Procesando mensaje de ${sender} con OpenAI: "${message}"`);
    
    // Crear o obtener un thread para este usuario para mantener contexto
    if (!userThreads[sender]) {
      console.log(`🧵 Creando nuevo thread para usuario ${sender}`);
      userThreads[sender] = uuidv4();
    }
    
    const threadId = userThreads[sender];
    console.log(`🧵 Usando thread ${threadId} para usuario ${sender}`);
    
    // Llamar a la API de OpenAI
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-3.5-turbo", // Puedes cambiar a gpt-4 si lo prefieres
      messages: [
        { role: "system", content: "Eres un asistente amable y servicial de WhatsApp que responde preguntas de manera concisa y útil. Mantén tus respuestas breves y directas." },
        { role: "user", content: message }
      ],
      max_tokens: 500
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Extraer la respuesta
    if (response.data && response.data.choices && response.data.choices.length > 0) {
      const aiResponse = response.data.choices[0].message.content.trim();
      console.log(`✅ Respuesta recibida de OpenAI: "${aiResponse.substring(0, 50)}${aiResponse.length > 50 ? '...' : ''}"`);
      return aiResponse;
    } else {
      console.error('❌ Respuesta de OpenAI no tiene el formato esperado:', JSON.stringify(response.data));
      return "Lo siento, no pude procesar tu mensaje correctamente. Por favor intenta de nuevo.";
    }
  } catch (error) {
    console.error('❌ Error procesando mensaje con OpenAI:', error.message);
    if (error.response) {
      console.error('📄 Respuesta de error de OpenAI:', 
                   error.response.status, 
                   JSON.stringify(error.response.data).substring(0, 200));
    }
    return "Lo siento, tuve un problema procesando tu mensaje. Por favor, intenta de nuevo más tarde.";
  }
}

// Función para enviar respuesta a WhatsApp
async function sendWhatsAppResponse(recipient, message) {
  try {
    console.log(`📤 Enviando respuesta a ${recipient}: "${message}"`);
    
    // API v1 de GupShup - Método que funciona
    const apiUrl = 'https://api.gupshup.io/wa/api/v1/msg';
    const apiKey = process.env.GUPSHUP_API_KEY;
    const source = process.env.GUPSHUP_NUMBER;
    
    console.log(`🔑 Usando API Key: ${apiKey}`);
    console.log(`📱 Desde número: ${source}`);
    console.log(`📱 Hacia número: ${recipient}`);
    
    const formData = new URLSearchParams();
    formData.append('channel', 'whatsapp');
    formData.append('source', source);
    formData.append('destination', recipient);
    formData.append('src.name', source);
    formData.append('message', JSON.stringify({
      type: 'text',
      text: message
    }));
    
    const headers = {
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/x-www-form-urlencoded',
      'apikey': apiKey
    };
    
    console.log('🔄 Enviando mensaje a WhatsApp...');
    
    const response = await axios.post(apiUrl, formData, { headers });
    
    console.log('📡 Respuesta:', JSON.stringify(response.data));
    
    if (response.status >= 200 && response.status < 300) {
      console.log('✅ Mensaje enviado correctamente');
      return true;
    } else {
      console.error(`❌ Error: Código de respuesta ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Error enviando mensaje:', error.message);
    
    if (error.response) {
      console.error('🔍 Detalles del error:', 
                  error.response.status, 
                  JSON.stringify(error.response.data));
    } else if (error.request) {
      console.error('🔍 No se recibió respuesta del servidor');
    } else {
      console.error('🔍 Error en la configuración de la solicitud:', error.message);
    }
    
    return false;
  }
}

// Exportar funciones para testing
module.exports = {
  app,
  extractMessageData,
  processMessageWithOpenAI,
  sendWhatsAppResponse
};

