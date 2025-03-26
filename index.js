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
const ASSISTANT_ID = process.env.ASSISTANT_ID || "asst_bdJlX30wF1qQH3Lf8ZoiptVx"; // ID de Hernán CUPRA Master
const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
const GUPSHUP_NUMBER = process.env.GUPSHUP_NUMBER;
const GUPSHUP_USERID = process.env.GUPSHUP_USERID || '2000233790';
const PORT = process.env.PORT || 3010;

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

// 🔃 Control de mensajes procesados para evitar duplicados
const processedMessages = new Map();
const MESSAGE_EXPIRE_TIME = 60000; // 60 segundos para expirar mensajes procesados

// Función para verificar si un mensaje ya fue procesado
function isMessageProcessed(messageId, sender, text) {
  // Si tenemos un ID específico del mensaje
  if (messageId) {
    return processedMessages.has(messageId);
  }
  
  // Si no tenemos ID, usamos una combinación de remitente + texto + timestamp aproximado
  const messageKey = `${sender}:${text}`;
  const now = Date.now();
  
  // Verificar si ya existe una entrada reciente con esta combinación
  for (const [key, timestamp] of processedMessages.entries()) {
    if (key.startsWith(messageKey) && (now - timestamp) < MESSAGE_EXPIRE_TIME) {
      return true;
    }
  }
  
  return false;
}

// Función para marcar un mensaje como procesado
function markMessageAsProcessed(messageId, sender, text) {
  const key = messageId || `${sender}:${text}:${Date.now()}`;
  processedMessages.set(key, Date.now());
  
  // Limpieza de mensajes expirados (cada 100 mensajes)
  if (processedMessages.size > 100) {
    const now = Date.now();
    for (const [key, timestamp] of processedMessages.entries()) {
      if (now - timestamp > MESSAGE_EXPIRE_TIME) {
        processedMessages.delete(key);
      }
    }
  }
}

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
    const { message, sender, messageId, isStatusUpdate, messageType } = extractMessageData(req.body);
    
    // Si es una notificación de estado, simplemente confirmamos recepción
    if (isStatusUpdate) {
      console.log('📊 Procesada notificación de estado');
      return res.status(200).send('OK');
    }
    
    if (!message || !sender) {
      console.log('⚠️ Mensaje no válido o no es un mensaje de texto');
      
      // Si tenemos remitente pero no mensaje (tipo no soportado)
      if (sender && messageType) {
        console.log(`⚠️ Mensaje de tipo '${messageType}' no soportado`);
        // Opcionalmente podríamos enviar un mensaje informando que ese tipo no se soporta
        await sendWhatsAppResponse(sender, "Lo siento, por el momento solo puedo procesar mensajes de texto.");
      }
      
      return res.status(200).send('OK');
    }
    
    // Normalizar el ID del remitente
    const normalizedSender = String(sender).trim().replace(/_TEST.*$/i, '');
    
    // Verificar si este mensaje ya fue procesado para evitar duplicados
    if (isMessageProcessed(messageId, normalizedSender, message)) {
      console.log(`🔁 Mensaje duplicado detectado: ${messageId || `${normalizedSender}:${message}`}`);
      return res.status(200).send('OK');
    }
    
    console.log(`👤 Mensaje recibido de ${normalizedSender}: ${message}`);
    
    // Marcar el mensaje como procesado
    markMessageAsProcessed(messageId, normalizedSender, message);
    
    // Guardar el mensaje del usuario en Supabase
    try {
      // Guardar mensaje del usuario
      console.log(`💾 Guardando mensaje del usuario en Supabase: ${message}`);
      const userMessageResult = await global.registerBotResponse(normalizedSender, message, BUSINESS_ID, 'user');
      
      if (userMessageResult && userMessageResult.success) {
        console.log('✅ Mensaje del usuario guardado correctamente en Supabase');
      } else {
        console.error('❌ Error al guardar mensaje del usuario en Supabase');
      }
    } catch (supabaseUserError) {
      console.error('❌ Error al guardar mensaje del usuario:', supabaseUserError.message);
      // No interrumpimos el flujo principal por un error en el registro
    }
    
    // Enviar mensaje a OpenAI
    const response = await processMessageWithOpenAI(normalizedSender, message);
    
    // Enviar respuesta a WhatsApp
    await sendWhatsAppResponse(sender, response);
    
    // Usar try/catch específico para el registro en panel de control
    try {
      // Registrar respuesta en el panel de control usando la función global
      console.log(`🔄 Intentando registrar respuesta con business_id: ${BUSINESS_ID}`);
      
      // Usar la función global registerBotResponse para guardar en Supabase
      const result = await global.registerBotResponse(normalizedSender, response, BUSINESS_ID, 'bot');
      
      // Verificar resultado
      if (result && result.success === true) {
        console.log(`✅ Respuesta guardada correctamente en Supabase`);
      } else {
        console.error(`❌ Error al guardar en Supabase: ${result?.error || 'Error desconocido'}`);
      }
      
      // También usar la función local para el panel de control
      const panelResult = await registerBotResponse(normalizedSender, response, BUSINESS_ID);
      
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

// Endpoint de prueba para simular un mensaje
app.post('/test-message', async (req, res) => {
  try {
    console.log('📩 Mensaje de prueba recibido:', JSON.stringify(req.body));
    
    const { message, sender } = req.body;
    
    if (!message || !sender) {
      return res.status(400).json({ error: 'Mensaje o remitente faltante' });
    }
    
    // Normalizar el ID del remitente
    const normalizedSender = String(sender).trim().replace(/_TEST.*$/i, '');
    console.log(`👤 Mensaje de prueba recibido de ${normalizedSender}: ${message}`);
    
    // Guardar el mensaje del usuario en Supabase
    try {
      console.log(`💾 Guardando mensaje del usuario en Supabase: ${message}`);
      const userMessageResult = await global.registerBotResponse(normalizedSender, message, BUSINESS_ID, 'user');
      
      if (userMessageResult && userMessageResult.success) {
        console.log('✅ Mensaje del usuario guardado correctamente en Supabase');
      } else {
        console.error('❌ Error al guardar mensaje del usuario en Supabase');
      }
    } catch (supabaseUserError) {
      console.error('❌ Error al guardar mensaje del usuario:', supabaseUserError.message);
      // No interrumpimos el flujo principal por un error en el registro
    }
    
    // Enviar mensaje a OpenAI
    const response = await processMessageWithOpenAI(normalizedSender, message);
    
    // Guardar la respuesta del bot en Supabase
    try {
      console.log(`🔄 Intentando registrar respuesta del bot con business_id: ${BUSINESS_ID}`);
      
      // Usar la función global registerBotResponse para guardar en Supabase
      const result = await global.registerBotResponse(normalizedSender, response, BUSINESS_ID, 'bot');
      
      // Verificar resultado
      if (result && result.success === true) {
        console.log(`✅ Respuesta del bot guardada correctamente en Supabase`);
      } else {
        console.error(`❌ Error al guardar respuesta del bot en Supabase: ${result?.error || 'Error desconocido'}`);
      }
    } catch (controlPanelError) {
      console.error(`❌ Error al registrar respuesta del bot en Supabase:`, controlPanelError.message);
    }
    
    // Solo devolver la respuesta, no enviar a WhatsApp
    return res.status(200).json({ 
      success: true,
      message: response,
      sender: sender
    });
  } catch (error) {
    console.error('❌ Error procesando mensaje de prueba:', error.message);
    return res.status(500).json({ error: error.message });
  }
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
        // Verificar si es una notificación de estado (delivered, read, etc.)
        if (change.field === 'messages' && change.value && change.value.statuses) {
          console.log('📊 Notificación de estado recibida, no requiere respuesta');
          return { message: null, sender: null, messageId: null, isStatusUpdate: true };
        }
        
        // Procesamiento normal para mensajes de texto
        if (change.field === 'messages' && change.value && change.value.messages && change.value.messages.length > 0) {
          const message = change.value.messages[0];
          const sender = message.from;
          const messageId = message.id; // Capturamos el ID del mensaje
          
          // Verificar si es un mensaje de texto
          if (message.type === 'text' && message.text && message.text.body) {
            return {
              message: message.text.body,
              sender: sender,
              timestamp: message.timestamp,
              messageId: messageId,
              isStatusUpdate: false
            };
          }
          
          // Manejo de otros tipos de mensajes (audio, imagen, etc.)
          console.log(`⚠️ Mensaje de tipo no soportado: ${message.type}`);
          return { 
            message: null, 
            sender: sender, 
            messageId: messageId, 
            isStatusUpdate: false,
            messageType: message.type 
          };
        }
      }
    }
    
    console.log('⚠️ Formato de mensaje no reconocido:', JSON.stringify(body).substring(0, 200) + '...');
    return { message: null, sender: null, messageId: null, isStatusUpdate: false };
  } catch (error) {
    console.error('❌ Error al extraer datos del mensaje:', error.message);
    return { message: null, sender: null, messageId: null, isStatusUpdate: false };
  }
}

// Función para procesar mensaje con OpenAI
async function processMessageWithOpenAI(sender, message) {
  try {
    // Normalizar el ID del remitente para garantizar consistencia
    const normalizedSender = String(sender).trim().replace(/_TEST.*$/i, '');
    console.log(`⚙️ Procesando mensaje de ${normalizedSender} con OpenAI: "${message}"`);
    
    // Verificar que tenemos API key válida
    if (!OPENAI_API_KEY || OPENAI_API_KEY.includes('xxxxxxx') || OPENAI_API_KEY === 'tu-api-key-de-openai') {
      console.error('❌ ERROR CRÍTICO: API key de OpenAI no configurada correctamente');
      return "Lo siento, el sistema no está configurado correctamente. Por favor contacta al administrador.";
    }
    
    console.log(`🔑 Usando OpenAI API Key: ${OPENAI_API_KEY.substring(0, 7)}...`);
    console.log(`🤖 Usando Assistant ID: ${ASSISTANT_ID}`);
    
    // Crear o obtener un thread para este usuario para mantener contexto
    if (!userThreads[normalizedSender]) {
      // Crear un nuevo thread para el usuario
      try {
        const threadResponse = await axios.post('https://api.openai.com/v1/threads', {}, {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2'
          }
        });
        
        userThreads[normalizedSender] = threadResponse.data.id;
        console.log(`🧵 Nuevo thread creado para usuario ${normalizedSender}: ${userThreads[normalizedSender]}`);
      } catch (threadError) {
        console.error('❌ Error creando thread:', threadError.message);
        if (threadError.response) {
          console.error('📄 Respuesta de error al crear thread:', 
                     threadError.response.status, 
                     JSON.stringify(threadError.response.data).substring(0, 500));
        }
        return "Lo siento, no puedo procesar tu mensaje en este momento. Por favor intenta más tarde.";
      }
    }
    
    const threadId = userThreads[normalizedSender];
    console.log(`🧵 Usando thread ${threadId} para usuario ${normalizedSender}`);
    console.log(`🤖 Procesando con asistente específico: ${ASSISTANT_ID}`);
    
    // Paso 1: Añadir el mensaje al thread
    try {
      await axios.post(`https://api.openai.com/v1/threads/${threadId}/messages`, {
        role: 'user',
        content: message
      }, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        }
      });
    } catch (messageError) {
      console.error('❌ Error añadiendo mensaje al thread:', messageError.message);
      if (messageError.response) {
        console.error('📄 Respuesta de error al añadir mensaje:', 
                   messageError.response.status, 
                   JSON.stringify(messageError.response.data).substring(0, 500));
      }
      return "Lo siento, hubo un problema al procesar tu mensaje. Por favor intenta de nuevo.";
    }
    
    // Paso 2: Ejecutar el asistente en el thread
    let runId;
    try {
      const runResponse = await axios.post(`https://api.openai.com/v1/threads/${threadId}/runs`, {
        assistant_id: ASSISTANT_ID
      }, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      
      runId = runResponse.data.id;
      console.log(`🏃 Run iniciado con ID: ${runId}`);
    } catch (runError) {
      console.error('❌ Error iniciando run:', runError.message);
      if (runError.response) {
        console.error('📄 Respuesta de error al iniciar run:', 
                     runError.response.status, 
                     JSON.stringify(runError.response.data).substring(0, 500));
                     
        // Si es un error de autenticación, proveer un mensaje más específico
        if (runError.response.status === 401) {
          console.error('🔑 ERROR DE AUTENTICACIÓN: API key inválida o expirada');
          return "Lo siento, hay un problema de autenticación con nuestro servicio. Por favor contacta al administrador.";
        }
        
        // Si es un error de asistente no encontrado
        if (runError.response.status === 404 && runError.response.data.error?.message?.includes('assistant')) {
          console.error(`🤖 ERROR: Asistente con ID ${ASSISTANT_ID} no encontrado`);
          return "Lo siento, el asistente configurado no está disponible. Por favor contacta al administrador.";
        }
      }
      return "Lo siento, tuve un problema técnico. Por favor intenta de nuevo más tarde.";
    }
    
    // Paso 3: Esperar a que el run termine
    let runStatus = 'queued';
    let attempts = 0;
    const maxAttempts = 30; // Máximo de intentos para evitar bucles infinitos
    
    while (runStatus !== 'completed' && runStatus !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo
      
      try {
        const statusResponse = await axios.get(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2'
          }
        });
        
        runStatus = statusResponse.data.status;
        console.log(`🔄 Estado del run: ${runStatus} (intento ${attempts + 1})`);
        attempts++;
      } catch (statusError) {
        console.error('❌ Error verificando estado del run:', statusError.message);
        attempts++;
        continue;
      }
    }
    
    if (runStatus === 'completed') {
      // Paso 4: Obtener la respuesta
      try {
        const messagesResponse = await axios.get(`https://api.openai.com/v1/threads/${threadId}/messages`, {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2'
          }
        });
        
        // Obtener el mensaje más reciente del asistente
        const assistantMessages = messagesResponse.data.data.filter(msg => msg.role === 'assistant');
        
        if (assistantMessages.length > 0) {
          const latestMessage = assistantMessages[0];
          
          // Extraer el contenido del mensaje
          let responseText = '';
          if (latestMessage.content && latestMessage.content.length > 0) {
            const textContent = latestMessage.content.filter(item => item.type === 'text');
            if (textContent.length > 0) {
              responseText = textContent[0].text.value;
            }
          }
          
          if (responseText) {
            console.log(`✅ Respuesta del asistente: "${responseText.substring(0, 50)}${responseText.length > 50 ? '...' : ''}"`);
            return responseText;
          } else {
            console.error('❌ No se pudo extraer texto de la respuesta del asistente');
            return "Lo siento, hubo un problema al generar una respuesta. Por favor, intenta de nuevo.";
          }
        } else {
          console.error('❌ No se encontraron mensajes del asistente');
          return "Lo siento, no pude recibir una respuesta del asistente. Por favor, intenta de nuevo.";
        }
      } catch (messagesError) {
        console.error('❌ Error obteniendo mensajes:', messagesError.message);
        return "Lo siento, hubo un problema recuperando la respuesta. Por favor, intenta de nuevo.";
      }
    } else {
      console.error(`❌ El procesamiento no se completó. Estado final: ${runStatus}`);
      return "Lo siento, hubo un problema procesando tu mensaje. Por favor, intenta de nuevo más tarde.";
    }
  } catch (error) {
    console.error('❌ Error procesando mensaje con OpenAI:', error.message);
    if (error.response) {
      console.error('📄 Respuesta de error de OpenAI:', 
                   error.response.status, 
                   JSON.stringify(error.response.data).substring(0, 500));
    }
    return "Lo siento, tuve un problema técnico procesando tu mensaje. Por favor, intenta de nuevo más tarde.";
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