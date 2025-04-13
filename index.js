// Importar librerías
// Fix para Supabase en Render
require('./supabase-render-helper');

// Configuración específica para Render
if (process.env.RENDER === 'true') {
  console.log('🚀 Iniciando en entorno Render...');
  // Render asigna PORT=3000 por defecto, pero nuestro servicio debe adaptarse
  if (!process.env.PORT) {
    console.log('⚠️ Variable PORT no detectada. Usando valor predeterminado 3000');
    process.env.PORT = 3000;
  } else {
    console.log(`✅ Usando puerto asignado por Render: ${process.env.PORT}`);
  }
}

require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const OpenAI = require('openai');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const bodyParser = require('body-parser');
const session = require('express-session');
const nodemailer = require('nodemailer');
const MessageMedia = require('whatsapp-web.js').MessageMedia;
const { sendTextMessageGupShup } = require('./sendTextMessageGupShup');
const crypto = require('crypto');

// Función para sanitizar cabeceras HTTP para Supabase
function sanitizeHeaders(key) {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + key
  };
}


// Cargar variables de entorno en variables globales para facilitar su uso en toda la aplicación
let GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
let GUPSHUP_NUMBER = process.env.GUPSHUP_NUMBER;
let GUPSHUP_USERID = process.env.GUPSHUP_USERID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const BUSINESS_ID = process.env.BUSINESS_ID;
let CONTROL_PANEL_URL = process.env.CONTROL_PANEL_URL || 'http://localhost:7777/api/register-bot-response';
const ASSISTANT_ID = process.env.ASSISTANT_ID;
const PORT = process.env.FORCE_PORT || process.env.PORT || 10000;
console.log(`🔑 Puerto configurado en index.js: ${PORT}`);
console.log(`🚀 Iniciando servidor en puerto ${PORT}`);
console.log(`🤖 Bot conectado al panel: ${CONTROL_PANEL_URL}`);

// Inicialización temprana para verificar variables críticas
console.log('Inicializando servidor de WhatsApp con las siguientes credenciales:');
console.log(`GUPSHUP_NUMBER: ${GUPSHUP_NUMBER ? GUPSHUP_NUMBER : 'NO CONFIGURADO'}`);
console.log(`GUPSHUP_API_KEY: ${GUPSHUP_API_KEY ? `${GUPSHUP_API_KEY.substring(0, 8)}...${GUPSHUP_API_KEY.substring(GUPSHUP_API_KEY.length - 5)}` : 'NO CONFIGURADO'}`);
console.log(`GUPSHUP_USERID: ${GUPSHUP_USERID ? `${GUPSHUP_USERID.substring(0, 8)}...` : 'NO CONFIGURADO'}`);
console.log(`SUPABASE_URL: ${SUPABASE_URL ? SUPABASE_URL : 'NO CONFIGURADO'}`);
console.log(`CONTROL_PANEL_URL: ${CONTROL_PANEL_URL}`);

// SOLUCIÓN DEFINITIVA: Forzar URL en Render
// Detectar ambiente Render
const RENDER_ENV = process.env.RENDER === 'true' || process.env.RENDER_EXTERNAL_URL !== undefined;
const PROD_ENV = process.env.NODE_ENV === 'production';

// En Render, siempre usar la URL correcta (antes de cualquier otro código)
if (RENDER_ENV || PROD_ENV) {
  const correctUrl = 'https://whatsapp-bot-if6z.onrender.com/api/register-bot-response';
  process.env.CONTROL_PANEL_URL = correctUrl;
  CONTROL_PANEL_URL = correctUrl;
  console.log(`🛠️ CONFIGURACIÓN TEMPRANA: URL forzada a ${correctUrl}`);
  
  // Guardar también variables para Supabase para asegurar que estén disponibles
  if (!process.env.SUPABASE_KEY && process.env.SUPABASE_ANON_KEY) {
    process.env.SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
    console.log('🔑 CONFIGURACIÓN TEMPRANA: Copiando SUPABASE_ANON_KEY a SUPABASE_KEY');
  }
}

// Cargar el parche global que define registerBotResponse
require('./global-patch');

// Inicializar OpenAI
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

// Verificar el formato de la API Key
if (OPENAI_API_KEY && !OPENAI_API_KEY.startsWith('sk-')) {
    console.warn('⚠️ ADVERTENCIA: El formato de la API Key de OpenAI parece incorrecto. Debería comenzar con "sk-"');
    console.warn('⚠️ Por favor, verifica tu API Key en https://platform.openai.com/account/api-keys');
}

const SYSTEM_PROMPT = `Eres un asistente de ventas amigable y profesional para concesionarios SEAT y CUPRA. Tu objetivo es ayudar a los clientes a encontrar el vehículo que mejor se adapte a sus necesidades, responder preguntas sobre modelos específicos, características, financiamiento y promociones.

Reglas importantes:
1. Sé respetuoso y profesional en todo momento.
2. Proporciona información precisa sobre vehículos SEAT y CUPRA.
3. Si no conoces la respuesta, sugiérele al cliente que visite el concesionario o hable con un asesor humano.
4. No inventes información sobre precios exactos, promociones o disponibilidad.
5. Mantén tus respuestas concisas y directas.
6. No uses emojis.
7. Cuando sugieras un modelo, menciona brevemente sus características principales.`;

// Mapeo bidireccional para mantener relación entre números telefónicos e IDs de conversación
const phoneToConversationMap = {};
// Mapeo de IDs de conversación a números telefónicos
const conversationIdToPhoneMap = {};

// Caché del estado del bot por remitente
const senderBotStatusMap = {};

// Cache para evitar procesar mensajes duplicados (por ID + contenido)
const processedMessages = {};

// Set para almacenar mensajes procesados recientemente (evitar duplicados)
const recentlyProcessedMessages = new Set();

// Set para almacenar hashes de mensajes recientes para evitar duplicación en registerBotResponse
const recentMessageHashes = new Set();

// 🗂 Almacena el historial de threads de usuarios
const userThreads = {};

// Función para actualizar/mantener los mapeos entre conversaciones y números telefónicos
// Debe llamarse cada vez que se crea o accede a una conversación
async function updateConversationMappings() {
  console.log('🔄 Actualizando mapeos de conversaciones y números...');
  
  try {
    // Obtener todas las conversaciones activas para el negocio
    const { data, error } = await supabase
      .from('conversations')
      .select('id, user_id')
      .eq('business_id', BUSINESS_ID);
    
    if (error) {
      console.error('❌ Error al cargar mapeos:', error.message);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('ℹ️ No hay conversaciones para mapear');
      return;
    }
    
    console.log(`🔍 Encontradas ${data.length} conversaciones para mapeo`);
    
    // Actualizar mapeos en memoria
    data.forEach(conv => {
      if (conv.id && conv.user_id) {
        // Solo actualizar si ambos valores existen
        phoneToConversationMap[conv.user_id] = conv.id;
        conversationIdToPhoneMap[conv.id] = conv.user_id;
      }
    });
    
    console.log(`Mapeos actualizados: ${Object.keys(phoneToConversationMap).length} números mapeados`);
  } catch (e) {
    console.error('❌ Error crítico en actualización de mapeos:', e.message);
  }
}

// 🔧 Parche de URL: Corregir CONTROL_PANEL_URL si es necesario
console.log("🔧 APLICANDO PARCHE PARA CORREGIR URLs DEL BOT WHATSAPP");

// Usar constantes definidas al inicio
console.log("Ambiente:", PROD_ENV ? "Producción" : "Desarrollo");
console.log("Render detectado:", RENDER_ENV ? "SÍ" : "NO");

// En Render, siempre usar la URL correcta
if (RENDER_ENV && PROD_ENV) {
  const renderUrl = 'https://whatsapp-bot-if6z.onrender.com/api/register-bot-response';
  console.log(`🏗️ Ambiente Render detectado, forzando URL correcta: ${renderUrl}`);
  process.env.CONTROL_PANEL_URL = renderUrl;
  CONTROL_PANEL_URL = renderUrl;
  console.log(`URL configurada para Render: ${CONTROL_PANEL_URL}`);
} else {
  // Procesar la URL para otros entornos
  let originalUrl = process.env.CONTROL_PANEL_URL || (PROD_ENV ? 'https://whatsapp-bot-if6z.onrender.com/api/register-bot-response' : 'http://localhost:3000');
console.log("CONTROL_PANEL_URL actual:", originalUrl);

  // Si estamos en producción y la URL contiene localhost, corregirla
  if (PROD_ENV && originalUrl.includes('localhost')) {
    console.log("⚠️ Detectada URL de localhost en ambiente de producción. Corrigiendo...");
    originalUrl = 'https://whatsapp-bot-if6z.onrender.com/api/register-bot-response';
    console.log("✅ URL corregida para producción:", originalUrl);
  }

// Corregir URL duplicada
if (originalUrl.includes('/register-bot-response/register-bot-response')) {
    originalUrl = originalUrl.replace('/register-bot-response/register-bot-response', '/register-bot-response');
}

// Verificar dominios antiguos y corregirlos
  if (PROD_ENV && originalUrl.includes('panel-control-whatsapp.onrender.com')) {
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
    CONTROL_PANEL_URL = originalUrl.trim();
} else if (originalUrl.includes('/register-bot-response/')) {
    // URL tiene endpoint duplicado
    process.env.CONTROL_PANEL_URL = originalUrl.split('/register-bot-response/')[0] + '/register-bot-response';
    CONTROL_PANEL_URL = process.env.CONTROL_PANEL_URL;
} else {
    // URL no tiene endpoint, agregar si no termina en /
    const formattedUrl = originalUrl.endsWith('/') 
        ? originalUrl.slice(0, -1) + '/register-bot-response'
        : originalUrl + '/register-bot-response';
    process.env.CONTROL_PANEL_URL = formattedUrl;
    CONTROL_PANEL_URL = formattedUrl;
  }
}

console.log("URL final que se usará:", CONTROL_PANEL_URL);
console.log("✅ Parche aplicado correctamente");
console.log("📝 De ahora en adelante, las URLs duplicadas serán corregidas automáticamente");
console.log("🌐 En ambiente de producción, se usará:", PROD_ENV ? CONTROL_PANEL_URL : "URL de desarrollo");
console.log("🔍 También puedes usar la función global registerBotResponse() para enviar mensajes");

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Configuración express
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configurar CORS
const corsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'https://whatsapp-mern-front.vercel.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  exposedHeaders: ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials']
};
app.use(cors(corsOptions));

// Variable global para activar modo debug
const DEBUG_MODE = process.env.DEBUG_MODE === 'true' || process.env.NODE_ENV === 'development';

// Middleware para registro de solicitudes CORS
app.use((req, res, next) => {
  if (DEBUG_MODE) {
    console.log("Request: " + req.method + " " + req.url + " - Origin: " + (req.headers.origin || 'Unknown'));
  }
  // Establecer headers CORS adicionales para todas las respuestas
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Middleware para opciones preflight
app.options('*', cors(corsOptions));

// Middleware para logs detallados
app.use((req, res, next) => {
  console.log("Request: " + req.method + " " + req.url);
  next();
});

// 🔃 Control de mensajes procesados para evitar duplicados
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
    console.error("🛑 Esta configuración causará problemas con la API. Por favor corrige el valor.");
} else if (CONTROL_PANEL_URL.includes('localhost') && PROD_ENV) {
    console.warn("⚠️ Advertencia: CONTROL_PANEL_URL está configurado a localhost en entorno de producción");
    // Actualizar una última vez para asegurar que está correcto
    if (PROD_ENV) {
        const correctProdUrl = 'https://whatsapp-bot-if6z.onrender.com/api/register-bot-response';
        console.log(`⚙️ Actualizando automáticamente CONTROL_PANEL_URL a: ${correctProdUrl}`);
        process.env.CONTROL_PANEL_URL = correctProdUrl;
        CONTROL_PANEL_URL = correctProdUrl;
    }
    console.warn("⚠️ Esto podría causar problemas al registrar respuestas");
}

// ❌ Si faltan claves, detener el servidor
if (!OPENAI_API_KEY || !GUPSHUP_API_KEY || !GUPSHUP_NUMBER) {
    console.error("⚠️ ERROR: Faltan claves de API. Verifica las variables de entorno.");
    process.exit(1);
}

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co';
// Intentar obtener la clave de Supabase de diferentes variables de entorno posibles
// Verificamos todas las posibles variables donde podría estar la clave de Supabase
const supabaseKey = process.env.SUPABASE_ANON_KEY || 
                   process.env.SUPABASE_KEY || 
                   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI';

console.log('🔑 DEBUG - Variables de entorno para Supabase:');
console.log('- SUPABASE_URL:', process.env.SUPABASE_URL || 'no definido');
console.log('- SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? process.env.SUPABASE_ANON_KEY.substring(0, 10) + '...' : 'no definido');
console.log('- SUPABASE_KEY:', process.env.SUPABASE_KEY ? process.env.SUPABASE_KEY.substring(0, 10) + '...' : 'no definido');
console.log('- NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 10) + '...' : 'no definido');

if (!supabaseUrl) {
    console.error('❌ ERROR: Falta la URL de Supabase');
    process.exit(1);
}

if (!supabaseKey) {
    console.error('❌ ERROR: Faltan credenciales de Supabase (ninguna variable de clave está definida)');
    process.exit(1);
}

console.log('✅ Credenciales de Supabase encontradas correctamente');
console.log(`🔑 Usando clave de Supabase (primeros 10 caracteres): ${supabaseKey.substring(0, 10)}...`);

const supabaseOptions = {
  auth: { persistSession: false },
  global: {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + supabaseKey
    }
  }
};

const supabase = createClient(supabaseUrl, supabaseKey, supabaseOptions);

// Función auxiliar para verificar la estructura de la tabla messages
async function getMessagesTableStructure() {
    try {
        // Intentamos usar el procedimiento RPC, pero puede no existir
        const { data: tableInfo, error: tableError } = await supabase
            .rpc('get_table_metadata', { table_name: 'messages' });
        
        if (tableError) {
            console.warn('⚠️ No se pudo obtener metadata de la tabla mediante RPC:', tableError.message);
            
            // Alternativa: obtener una fila para ver estructura
            const { data: sampleRow, error: sampleError } = await supabase
                .from('messages')
                .select('*')
                .limit(1);
            
            if (sampleError) {
                console.warn('⚠️ No se pudo obtener muestra de la tabla:', sampleError.message);
                return null;
            }
            
            // Si tenemos una fila, podemos ver sus propiedades
            if (sampleRow && sampleRow.length > 0) {
                return Object.keys(sampleRow[0]);
            }
            
            // Si no hay datos, asumimos estructura básica
            return ['conversation_id', 'content', 'sender_type', 'created_at'];
        }
        
        // Si obtuvimos datos del RPC, extraer nombres de columnas
        if (tableInfo && Array.isArray(tableInfo)) {
            return tableInfo.map(col => col.column_name);
        }
        
        return null;
    } catch (error) {
        console.error('❌ Error verificando estructura de tabla:', error);
        return null;
    }
}

// Formato de fecha seguro para cualquier tipo de entrada
function safeISODate(timestamp) {
  if (!timestamp) {
    return new Date().toISOString();
  }
  
  try {
    // Si es número directo (segundos desde epoch)
    if (typeof timestamp === 'number') {
      return new Date(timestamp * 1000).toISOString();
    }
    
    // Si es string que parece número
    if (typeof timestamp === 'string' && /^\d+$/.test(timestamp)) {
      return new Date(parseInt(timestamp) * 1000).toISOString();
    }
    
    // Si ya es un objeto Date
    if (timestamp instanceof Date) {
      return timestamp.toISOString();
    }
    
    // Si es un string de fecha ISO
    if (typeof timestamp === 'string' && /^\d{4}-\d{2}-\d{2}/.test(timestamp)) {
      return new Date(timestamp).toISOString();
    }
    
    // Caso por defecto
    return new Date().toISOString();
    } catch (error) {
    console.warn(`⚠️ Error al formatear fecha ${timestamp}:`, error);
    return new Date().toISOString();
  }
}

// Función para guardar mensaje en Supabase
async function saveMessageToSupabase({ sender, message, messageId, timestamp, conversationId, isBotActive }) {
    try {
        if (!sender || !message) {
            console.warn('❌ Datos incompletos para guardar mensaje en Supabase');
            return null;
        }

        console.log(`💾 Guardando mensaje de tipo 'user' para: ${sender}`);
        
        // Si no tenemos conversation_id, intentar encontrarlo
        let existingConversationId = conversationId;
        
        if (!existingConversationId) {
            // Verificar si ya existe una conversación para este remitente
            console.log(`🔍 Buscando conversación para: ${sender}`);
            
            const { data: existingConv, error: convError } = await supabase
                .from('conversations')
                .select('id, is_bot_active')
                .eq('user_id', sender)
                .eq('business_id', BUSINESS_ID);
            
            if (convError) {
                console.error('❌ Error buscando conversación:', convError);
            } else if (existingConv && existingConv.length > 0) {
                existingConversationId = existingConv[0].id;
                // Actualizar el estado del bot si lo recibimos
                if (typeof isBotActive !== 'undefined') {
                    // Forzar la actualización del estado en caché
                    senderBotStatusMap[sender] = isBotActive === true;
                } else {
                    // Usar el estado de la DB
                    isBotActive = existingConv[0].is_bot_active === true;
                    senderBotStatusMap[sender] = isBotActive;
                }
                
                console.log(`ℹ️ Usando conversación existente con ID: ${existingConversationId} (bot activo: ${isBotActive ? 'SÍ' : 'NO'})`);
            } else {
                // Crear nueva conversación
                console.log(`📝 Creando nueva conversación para ${sender}`);
                const { data: newConv, error: createError } = await supabase
                    .from('conversations')
                    .insert([
                        { 
                            user_id: sender,
                            business_id: BUSINESS_ID,
                            is_bot_active: false, // Por defecto inactivo
                            sender_name: sender
                        }
                    ])
                    .select();
                
                if (createError) {
                    console.error('❌ Error creando conversación:', createError);
                    return null;
                }
                
                if (newConv && newConv.length > 0) {
                    existingConversationId = newConv[0].id;
                    isBotActive = false; // Nueva conversación, bot inactivo por defecto
                    
                    // Actualizar mapeos
                    phoneToConversationMap[sender] = existingConversationId;
                    conversationIdToPhoneMap[existingConversationId] = sender;
                    
                    // Actualizar estado en caché
                    senderBotStatusMap[sender] = false;
                    
                    console.log(`Nueva conversación creada: ${existingConversationId} para ${sender} (bot inactivo por defecto)`);
                }
            }
        }
        
        if (!existingConversationId) {
            console.error('❌ No se pudo crear o encontrar conversación');
            return null;
        }

        // Guardar el mensaje en la tabla messages
        const tableColumns = await getMessagesTableStructure();
        
        // Usar la función segura para formatear la fecha
        const safeTimestamp = safeISODate(timestamp);
        console.log(`📅 Timestamp formateado: ${safeTimestamp}`);
        
        let messageData = {
            conversation_id: existingConversationId,
            content: message,
            sender_type: 'user',
            created_at: safeTimestamp
        };
        
        // Solo añadir business_id si existe en la tabla
        if (tableColumns && tableColumns.includes('business_id')) {
            messageData.business_id = BUSINESS_ID;
        }
        
        const { error: saveError } = await supabase
            .from('messages')
            .insert([messageData]);
        
        if (saveError) {
            console.error('❌ Error guardando mensaje:', saveError);
            
            // Si el error es sobre business_id, intentar sin él
            if (saveError.message && saveError.message.includes('business_id')) {
                console.log('ℹ️ Intentando guardar mensaje sin business_id...');
                
                delete messageData.business_id;
                
                const { error: retryError } = await supabase
                    .from('messages')
                    .insert([messageData]);
                
                if (retryError) {
                    console.error('❌ Error en segundo intento para guardar mensaje:', retryError);
                    return null;
                }
            } else {
                return null;
            }
        }
        
        // Actualizar la conversación con el último mensaje
        await updateConversationLastActivity(existingConversationId, message);
        
        console.log('✅ Mensaje guardado en Supabase correctamente');
        return existingConversationId;
        
    } catch (error) {
        console.error('❌ Error general guardando mensaje en Supabase:', error);
        return null;
    }
}

// Función para actualizar última actividad de conversación
async function updateConversationLastActivity(conversationId, lastMessage) {
    try {
        console.log('🔄 Actualizando última actividad de conversación:', conversationId);
        
        const { data, error } = await supabase
            .from('conversations')
            .update({
                last_message: lastMessage,
                last_message_time: new Date().toISOString()
            })
            .eq('id', conversationId)
            .select();
            
        if (error) {
            console.error('❌ Error al actualizar conversación:', error);
            throw error;
        }
        
        console.log('✅ Conversación actualizada:', data);
        return data;
    } catch (error) {
        console.error('❌ Error en updateConversationLastActivity:', error);
        throw error;
    }
}

/**
 * Registra una respuesta del bot (o agente) en Supabase y actualiza la actividad de la conversación
 * @param {string} conversationId - ID de la conversación (puede ser un número telefónico o un UUID)
 * @param {string} message - Contenido del mensaje
 * @param {string} business_id - ID del negocio
 * @param {string} sender_type - Tipo de remitente ('bot', 'user', 'agent')
 * @returns {Promise<object>} - Resultado de la operación
 */
async function registerBotResponse(conversationId, botMessage) {
  console.log(`\n🤖 ===== INICIO DE REGISTER_BOT_RESPONSE =====`);
  console.log(`🤖 Registrando respuesta del bot para conversación: ${conversationId}`);
  console.log(`🤖 Mensaje completo del bot: "${botMessage}"`);
  
  try {
    // Verificar si el mensaje contiene frases que requieren notificación
    console.log(`\n🔍 VERIFICANDO FRASES DE NOTIFICACIÓN EN REGISTER_BOT_RESPONSE`);
    
    // Depuración: Verificar cuáles son las implementaciones de detección activas
    console.log(`🔧 DIAGNÓSTICO: checkForNotificationPhrases es de tipo: ${typeof checkForNotificationPhrases}`);
    console.log(`🔧 DIAGNÓSTICO: ¿Existe función en helpers? ${typeof require('./helpers/notificationHelpers').checkForNotificationPhrases === 'function' ? 'SÍ' : 'NO'}`);
    
    // Detección básica de texto crítico para depuración
    console.log(`🔧 VERIFICACIÓN MANUAL: ¿Contiene "Perfecto"? ${botMessage.includes("Perfecto") ? 'SÍ' : 'NO'}`);
    console.log(`🔧 VERIFICACIÓN MANUAL: ¿Contiene "cita"? ${botMessage.includes("cita") ? 'SÍ' : 'NO'}`);
    console.log(`🔧 VERIFICACIÓN MANUAL: ¿Contiene "confirmada"? ${botMessage.includes("confirmada") ? 'SÍ' : 'NO'}`);
    
    // Verificación exacta conocida
    if (botMessage.includes("Perfecto") && botMessage.includes("cita") && botMessage.includes("confirmada")) {
      console.log(`⚠️ ALERTA MANUAL: Mensaje contiene combinación crítica de palabras que debería activar notificación`);
    }
    
    // Verificación completa con la función 
    const requiresNotification = checkForNotificationPhrases(botMessage);
    console.log(`🔍 ¿Requiere notificación según checkForNotificationPhrases?: ${requiresNotification ? 'SÍ ✅' : 'NO ❌'}`);
    
    if (requiresNotification) {
      console.log(`\n🔔 🔔 🔔 CONFIRMADO: MENSAJE REQUIERE NOTIFICACIÓN 🔔 🔔 🔔`);
      
      // Obtener número de teléfono del cliente
      let clientPhoneNumber = conversationIdToPhoneMap[conversationId];
      console.log(`📱 Buscando número telefónico para conversación ${conversationId}...`);
      
      // Si no está en el mapa, intentar obtenerlo de la base de datos
      if (!clientPhoneNumber) {
        console.log(`📱 No se encontró en mapa, buscando en base de datos...`);
        try {
          console.log(`🔍 Consultando tabla 'conversations', buscando 'user_id' para conversación ID: ${conversationId}`);
          const { data: conversation, error } = await supabase
            .from('conversations')
            .select('user_id')
            .eq('id', conversationId)
            .single();
            
          if (error) {
    console.error(`Error en consulta a Supabase: ${error.message}`);
            console.error(`Detalles: ${JSON.stringify(error)}`);
          }
            
          if (conversation && conversation.user_id) {
            clientPhoneNumber = conversation.user_id;
            // Guardar para futuras consultas
            conversationIdToPhoneMap[conversationId] = clientPhoneNumber;
            console.log(`📱 ¡Número encontrado!: ${clientPhoneNumber}`);
          } else {
            console.error(`No se encontró conversación o no tiene user_id para ${conversationId}`);
            console.log(`💾 Datos retornados: ${JSON.stringify(conversation)}`);
          }
        } catch (dbError) {
    console.error(`Error al consultar base de datos: ${dbError.message}`);
          console.error(`Stack: ${dbError.stack}`);
        }
      } else {
        console.log(`📱 Número encontrado en mapa: ${clientPhoneNumber}`);
      }
      
      if (clientPhoneNumber) {
        console.log(`\n📧 === ENVIANDO NOTIFICACIÓN DESDE REGISTER_BOT_RESPONSE ===`);
        
        // PRUEBA DIRECTA DE ENVÍO DE CORREO DESDE REGISTER_BOT_RESPONSE
        try {
          console.log(`ENVIANDO CORREO DE PRUEBA DIRECTAMENTE DESDE REGISTER_BOT_RESPONSE`);
          
          // Crear un transporter específico para esta prueba
          const testTransporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.EMAIL_USER || 'bexorai@gmail.com',
              pass: process.env.EMAIL_PASSWORD || 'gqwi aker jgrn kylf'
            },
            debug: true
          });
          
          // Enviar un correo de prueba básico
          const testResult = await testTransporter.sendMail({
            from: '"Bot WhatsApp - REGISTER_BOT_RESPONSE" <bexorai@gmail.com>',
            to: 'bexorai@gmail.com',
            subject: "REGISTER TEST - Message: " + botMessage.substring(0, 30) + "...",
            html: `<p>Este es un correo de prueba directo desde registerBotResponse.</p>
                   <p><strong>Mensaje:</strong> ${botMessage}</p>
                   <p><strong>Conversación ID:</strong> ${conversationId}</p>
                   <p><strong>Teléfono:</strong> ${clientPhoneNumber}</p>
                   <p><strong>Fecha:</strong> ${new Date().toISOString()}</p>`
          });
          
          console.log(`RESULTADO DE CORREO DE PRUEBA: ${testResult.messageId}`);
          
          // Llamar a la función de notificación completa
          console.log(`Ejecutando sendBusinessNotification...`);
          const result = await sendBusinessNotification(conversationId, botMessage, clientPhoneNumber);
          console.log(`RESULTADO de envío de notificación: ${result ? 'ÉXITO ✅' : 'FALLIDO ❌'}`);
        } catch (emailError) {
    console.error(`Error en envío de prueba de correo: ${emailError.message}`);
          console.error(`Stack: ${emailError.stack}`);
        }
      } else {
        console.error(`No se pudo obtener número de teléfono para enviar notificación`);
      }
    } else {
      // FORZAR VERIFICACIÓN ADICIONAL
      console.log(`🔍 FORZANDO VERIFICACIÓN ADICIONAL con patrones explícitos...`);
      
      // Verificación manual con patrones específicos de confirmación de cita
      if (botMessage.match(/cita.*confirmada/i) || 
          botMessage.match(/¡Perfecto.*cita/i) || 
          botMessage.match(/tu cita ha sido/i)) {
        console.log(`⚠️ ALERTA: Patrón de confirmación de cita detectado manualmente`);
        console.log(`⚠️ El mensaje DEBERÍA haber activado una notificación pero no lo hizo.`);
      
        // Obtener número de teléfono del cliente para prueba
        let clientPhoneNumber = conversationIdToPhoneMap[conversationId];
        console.log(`📱 Buscando número telefónico para verificación adicional: ${clientPhoneNumber || 'No disponible'}`);
      }
      
      console.log(`ℹ️ El mensaje no contiene frases que requieran notificación según la función principal.`);
    }
    
    // Registrar el mensaje en la base de datos
    console.log(`📊 Registrando mensaje en la base de datos (tabla messages)...`);
    const { data: messageData, error: messageError } = await supabase
      .from('messages')
      .insert([
        {
          conversation_id: conversationId,
          content: botMessage,
          sender_type: 'bot'
        }
      ])
      .select();
      
    if (messageError) {
    console.error(`Error al registrar mensaje en DB: ${messageError.message}`);
    } else {
      console.log(`Mensaje registrado correctamente con ID: ${messageData[0]?.id || 'N/A'}`);
    }
    
    // Insertar el mensaje en el mapa
    if (!conversationMessagesMap[conversationId]) {
      conversationMessagesMap[conversationId] = [];
    }
    
    conversationMessagesMap[conversationId].push({
      id: messageData?.[0]?.id || `temp-${Date.now()}`,
      conversation_id: conversationId,
      content: botMessage,
      sender_type: 'bot',
      created_at: new Date().toISOString()
    });
    
    console.log(`🤖 ===== FIN DE REGISTER_BOT_RESPONSE =====\n`);
    return messageData?.[0]?.id;
  } catch (error) {
    console.error(`ERROR EN REGISTER_BOT_RESPONSE: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    throw error;
  }
}

// Procesar mensaje con OpenAI y generar respuesta
async function processMessageWithOpenAI(sender, message, conversationId) {
    try {
        if (!sender || !message) {
            logDebug('❌ Datos incompletos para procesar mensaje con OpenAI');
            return null;
        }

        logDebug(`🔍 VERIFICACIÓN CRÍTICA: Comprobando si el bot debe estar ACTIVO para ${sender}`);
        
        // ⚠️ VERIFICACIÓN INICIAL - Comprobar que NO esté desactivado en caché
        if (sender in senderBotStatusMap && senderBotStatusMap[sender] === false) {
            logDebug(`🚫 PROTECCIÓN INICIAL: Bot marcado como INACTIVO en caché para ${sender}, CANCELANDO procesamiento`);
            return null;
        }

        // ⚠️ VERIFICACIÓN EN BASE DE DATOS - Forzar consulta a DB
        let isBotActive = false;
        let actualConversationId = conversationId;
        
        // Si no tenemos ID, intentar buscarlo por número
        if (!actualConversationId) {
            logDebug(`🔍 Buscando conversación para ${sender}...`);
            const { data: convById, error: errorById } = await supabase
                .from('conversations')
                .select('id, is_bot_active')
                .eq('user_id', sender)
                .eq('business_id', BUSINESS_ID);
                
            if (errorById) {
                logDebug('❌ ERROR CRÍTICO buscando conversación: ' + JSON.stringify(errorById));
                return null; // Salir por seguridad
            }
            
            if (convById && convById.length > 0) {
                actualConversationId = convById[0].id;
                isBotActive = convById[0].is_bot_active === true; // Comparación estricta
                logDebug(`🔎 Encontrada conversación: ${actualConversationId}, bot_active=${isBotActive}`);
            } else {
                logDebug(`⚠️ No se encontró conversación para ${sender}`);
                return null; // No hay conversación, no procesar
            }
        } else {
            // Tenemos ID, verificamos directamente
            logDebug(`🔍 Verificando estado para conversación ${actualConversationId}...`);
            const { data: convData, error: convError } = await supabase
                .from('conversations')
                .select('is_bot_active')
                .eq('id', actualConversationId)
                .single();
                
            if (convError) {
                logDebug(`❌ Error consultando estado del bot: ${convError.message}`);
                return null; // Salir por seguridad
            }
            
            if (!convData) {
                logDebug(`❌ No se encontró datos para la conversación ${actualConversationId}`);
                return null; // No hay datos, no procesar
            }
            
            isBotActive = convData.is_bot_active === true; // Estricto
            logDebug(`🔎 Estado de conversación ${actualConversationId}: bot_active=${isBotActive}`);
            
            // Verificación final - consultar de nuevo como último recurso
            try {
                const { data: finalCheck, error: finalError } = await supabase
                    .from('conversations')
                    .select('is_bot_active')
                    .eq('id', actualConversationId)
                    .single();
                    
                if (!finalError && finalCheck) {
                    logDebug(`🔎 VERIFICACIÓN FINAL: Consultando nuevamente estado para ${actualConversationId}...`);
                    logDebug(`🔎 ESTADO FINAL: is_bot_active=${finalCheck.is_bot_active}`);
                    isBotActive = finalCheck.is_bot_active === true;
                    
                    // Actualizar caché
                    const userId = conversationIdToPhoneMap[actualConversationId] || sender;
                    if (userId) {
                        senderBotStatusMap[userId] = isBotActive;
                        logDebug(`📝 Caché FINAL actualizada: senderBotStatusMap[${userId}] = ${isBotActive}`);
                    }
                }
            } catch (finalCheckError) {
                logDebug(`⚠️ Error en verificación final: ${finalCheckError.message}`);
                // Continuar con el valor que ya teníamos
            }
        }
        
        // Verificación final: Si el bot está desactivado, no procesar
        if (!isBotActive) {
            logDebug(`🚫 Bot DESACTIVADO para ${sender}, cancelando procesamiento`);
            return null;
        }
        
        logDebug(`✅ VERIFICACIONES COMPLETAS: Bot confirmado como ACTIVO para ${sender}, procediendo con OpenAI`);
        
        // 🤖 Procesamiento con OpenAI Assistants API
        logDebug(`🔑 Usando OpenAI API Key: ${OPENAI_API_KEY.substring(0, 10)}...`);
        logDebug(`🤖 Usando Assistant ID: ${ASSISTANT_ID}`);
        
        // Verificar si el usuario tiene un thread existente o crear uno nuevo
        if (!userThreads[sender]) {
            try {
                logDebug(`🧵 Creando nuevo thread para usuario ${sender}`);
                const thread = await openai.beta.threads.create();
                userThreads[sender] = thread.id;
                logDebug(`✅ Thread creado con ID: ${thread.id} para usuario ${sender}`);
            } catch (threadError) {
                logDebug(`❌ Error creando thread: ${JSON.stringify(threadError)}`);
                return "Lo siento, ha ocurrido un error al procesar tu mensaje. Por favor, intenta de nuevo más tarde.";
            }
        }
        
        const threadId = userThreads[sender];
        logDebug(`🧵 Usando thread ${threadId} para usuario ${sender}`);
        
        // Añadir el mensaje al thread
        try {
            logDebug(`📝 Añadiendo mensaje al thread: "${message}"`);
            await openai.beta.threads.messages.create(threadId, {
                role: "user",
                content: message
            });
            logDebug(`✅ Mensaje añadido al thread ${threadId}`);
        } catch (messageError) {
            logDebug(`❌ Error añadiendo mensaje al thread: ${JSON.stringify(messageError)}`);
            return "Lo siento, ha ocurrido un error al procesar tu mensaje. Por favor, intenta de nuevo más tarde.";
        }
        
        // Ejecutar el assistant con el thread
        try {
            logDebug(`🤖 Procesando con asistente específico: ${ASSISTANT_ID}`);
            const run = await openai.beta.threads.runs.create(threadId, {
                assistant_id: ASSISTANT_ID
            });
            
            const runId = run.id;
            logDebug(`🏃 Run iniciado con ID: ${runId}`);
            
            // Esperar a que termine el procesamiento
            let runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
            let attempts = 1;
            
            while (runStatus.status !== 'completed' && runStatus.status !== 'failed' && attempts <= 10) {
                logDebug(`🔄 Estado del run: ${runStatus.status} (intento ${attempts})`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo
                runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
                attempts++;
            }
            
            if (runStatus.status !== 'completed') {
                logDebug(`❌ El run no se completó correctamente: ${runStatus.status}`);
                return "Lo siento, no pude procesar tu mensaje en este momento. Por favor, intenta de nuevo más tarde.";
            }
            
            // Obtener respuesta del asistente
            const messages = await openai.beta.threads.messages.list(threadId);
            const assistantMessages = messages.data.filter(msg => 
                msg.role === "assistant" && msg.run_id === runId
            );
            
            if (assistantMessages.length === 0) {
                logDebug('❌ No se encontraron respuestas del asistente');
                return "Lo siento, no pude generar una respuesta adecuada. Por favor, intenta de nuevo.";
            }
            
            // Obtener la respuesta más reciente del asistente
            const response = assistantMessages[0].content[0].text.value;
            logDebug(`✅ Respuesta del asistente: "${response.substring(0, 100)}${response.length > 100 ? '...' : ''}"`);
            
            return response;
            
        } catch (runError) {
            logDebug(`❌ Error en la ejecución del asistente: ${JSON.stringify(runError)}`);
            return "Lo siento, ha ocurrido un error al procesar tu mensaje. Por favor, intenta de nuevo más tarde.";
        }
        
    } catch (error) {
        logDebug(`❌ Error general en processMessageWithOpenAI: ${JSON.stringify(error)}`);
        return "Lo siento, ha ocurrido un error inesperado. Por favor, intenta de nuevo más tarde.";
    }
}

// Función para enviar respuesta a WhatsApp
async function sendWhatsAppResponse(recipient, message) {
    try {
        console.log("Enviando respuesta a " + recipient + ": \"" + message.substring(0, 150) + (message.length > 150 ? '...' : '') + "\"");

        // VERIFICACIÓN DE NOTIFICACIÓN PARA MENSAJES BOT
        try {
            console.log("=== VERIFICACIÓN DE NOTIFICACIÓN EN SENDWHATSAPPRESPONSE ===");
            console.log("Mensaje completo a verificar: \"" + message + "\"");

            // Verificación principal utilizando la función mejorada
            console.log("Ejecutando verificación con función actualizada checkForNotificationPhrases");
            const requiresNotification = checkForNotificationPhrases(message);
            console.log("Resultado: " + (requiresNotification ? 'REQUIERE NOTIFICACIÓN' : 'NO REQUIERE NOTIFICACIÓN'));
            
            if (requiresNotification) {
                console.log("NOTIFICACIÓN REQUERIDA - Procesando envío de correo");
                
                // Buscar la conversación para este número
                let conversationId = phoneToConversationMap[recipient];

                if (!conversationId) {
                    try {
                        console.log("Buscando conversación para número: " + recipient);
                        const { data: convData, error: convError } = await supabase
                            .from('conversations')
                            .select('id')
                            .eq('user_id', recipient)
                            .single();

                        if (convError) {
                            console.error("Error al buscar conversación: " + convError.message);
                        } else if (convData) {
                            conversationId = convData.id;
                            console.log("Conversación encontrada: " + conversationId);

                            // Actualizar mapeo en memoria
                            phoneToConversationMap[recipient] = conversationId;
                        }
                    } catch (dbError) {
                        console.error("Error en consulta: " + dbError.message);
                    }
                }

                // Enviar notificación si corresponde
                if (conversationId) {
                    console.log("ENVIANDO NOTIFICACIÓN DESDE SENDWHATSAPPRESPONSE");
                    console.log("Conversación: " + conversationId);
                    console.log("Teléfono: " + recipient);
                    console.log("Mensaje que activó la notificación: \"" + message + "\"");

                    try {
                        console.log("PRIMER INTENTO de envío de notificación");
                        const result = await sendBusinessNotification(conversationId, message, recipient);
                        console.log("RESULTADO de notificación: " + (result ? 'ÉXITO' : 'FALLIDO'));
                        
                        if (!result) {
                            console.log("Primer intento fallido, reintentando...");
                            const result2 = await sendBusinessNotification(conversationId, message, recipient);
                            console.log("RESULTADO de segundo intento: " + (result2 ? 'ÉXITO' : 'FALLIDO'));
                        }
                    } catch (emailError) {
                        console.error("Error al enviar notificación: " + emailError.message);
                        console.error(emailError.stack);
                    }
                } else {
                    console.error("No se pudo obtener ID de conversación para " + recipient + ", notificación no enviada");
                }
            } else {
                console.log("Mensaje no requiere notificación según las reglas configuradas");
            }
        } catch (notifError) {
            console.error("Error en verificación de notificación: " + notifError.message);
            console.error(notifError.stack);
        }
        
        // Continuar con el envío del mensaje independientemente
        // Formato del número telefónico - quitar el + si existe
        let formattedNumber = recipient.replace(/^\+/, '');
        
        // Verificar credenciales
        const apiKey = GUPSHUP_API_KEY;
        if (!apiKey) {
            console.error('Error: API Key de GupShup no configurada');
            return false;
        }
        
        // Verificar que el número contenga solo dígitos
        if (!/^\d+$/.test(formattedNumber)) {
            console.log("Número inválido: " + formattedNumber);
            return false;
        }
        
        // Enviar mensaje a través de Gupshup
        const source = GUPSHUP_NUMBER;
        
        console.log('Variables de entorno para GupShup:');
        console.log("- GUPSHUP_API_KEY: " + (GUPSHUP_API_KEY ? 'DEFINIDA' : 'NO DEFINIDA'));
        console.log("- GUPSHUP_NUMBER: " + (GUPSHUP_NUMBER ? GUPSHUP_NUMBER : 'NO DEFINIDA'));
        console.log("- GUPSHUP_USERID: " + (GUPSHUP_USERID ? 'DEFINIDA' : 'NO DEFINIDA'));
        
        if (!GUPSHUP_API_KEY || !GUPSHUP_NUMBER) {
            console.error('Error: credenciales de GupShup faltantes');
            return false;
        }
        
        const apiUrl = 'https://api.gupshup.io/sm/api/v1/msg';
        
        console.log("URL de API: " + apiUrl);
        console.log("Número de origen: " + GUPSHUP_NUMBER);
        console.log("Número de destino: " + formattedNumber);
        
        const formData = new URLSearchParams();
        formData.append('channel', 'whatsapp');
        formData.append('source', source);
        formData.append('destination', formattedNumber);
        formData.append('message', message);
        formData.append('src.name', source);
        
        const headers = {
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Bearer ' + apiKey
        , 'Content-Type': 'application/json'};
        
        if (GUPSHUP_USERID) {
            headers['userid'] = GUPSHUP_USERID;
            console.log("Añadiendo userid: " + GUPSHUP_USERID);
        }
        
        console.log('Enviando mensaje a WhatsApp...');
        console.log('Formulario:', Object.fromEntries(formData));
        console.log('Headers:', headers);
        
        try {
            const response = await axios.post(apiUrl, formData, { headers });
            
            console.log('Respuesta de GupShup:', JSON.stringify(response.data));
            
            if (response.status >= 200 && response.status < 300) {
                console.log('Mensaje enviado exitosamente a WhatsApp');
                
                // Guardar mensaje en la base de datos
                try {
                    await global.registerBotResponse(
                        recipient,
                        message,
                        BUSINESS_ID, 
                        'bot'
                    );
                    console.log('Mensaje del bot guardado en Supabase');
                } catch (dbError) {
                    console.log("Error guardando mensaje en Supabase: " + dbError.message);
                }
                
                return true;
            } else {
                console.error("Error: Código de respuesta " + response.status);
                return false;
            }
        } catch (apiError) {
            console.error("Error en solicitud a GupShup:", apiError.message);
            
            if (apiError.response) {
                console.error("- Status: " + apiError.response.status);
                console.error("- Datos: ", JSON.stringify(apiError.response.data, null, 2));
                console.error("- Headers: ", JSON.stringify(apiError.response.headers, null, 2));
            } else if (apiError.request) {
                console.error("- No hubo respuesta del servidor");
            } else {
                console.error("- Error al configurar la solicitud:", apiError.message);
            }
            
            return false;
        }
    } catch (error) {
        console.error("Error general en sendWhatsAppResponse:", error.message);
        console.error(error.stack);
        return false;
    }
}

// Función para extraer datos del mensaje de la solicitud de webhook
function extractMessageData(body) {
  try {
    console.log(`🔍 Extrayendo datos de mensaje de webhook: ${JSON.stringify(body).substring(0, 200)}...`);
    logDebug(`🔍 Extrayendo datos de mensaje de webhook: ${JSON.stringify(body).substring(0, 200)}...`);
    
    // Valores por defecto
    const result = {
      isStatusUpdate: false,
      sender: null,
      message: null,
      messageId: null,
      timestamp: null
    };
    
    // Imprimir la estructura completa para depuración
    console.log('📝 Estructura completa del webhook:');
    console.log(JSON.stringify(body, null, 2));
    
    // Verificar si es un mensaje o una actualización de estado
    if (body && body.entry && body.entry.length > 0) {
      const entry = body.entry[0];
      
      if (entry.changes && entry.changes.length > 0) {
        const change = entry.changes[0];
        
        // Para mensajes entrantes normales
        if (change.value && change.value.messages && change.value.messages.length > 0) {
          const messageData = change.value.messages[0];
          const contact = change.value.contacts && change.value.contacts.length > 0 
            ? change.value.contacts[0] 
            : null;
          
          result.sender = contact && contact.wa_id ? contact.wa_id : null;
          result.messageId = messageData.id || null;
          
          console.log(`📨 Datos del mensaje: ${JSON.stringify(messageData)}`);
          
          // Extraer contenido según el tipo de mensaje
          if (messageData.text && messageData.text.body) {
            result.message = messageData.text.body;
            console.log(`💬 Mensaje de texto encontrado: "${result.message}"`);
          } else if (messageData.type === 'text' && messageData.text) {
            result.message = messageData.text.body;
            console.log(`💬 Mensaje de texto (tipo): "${result.message}"`);
          } else if (messageData.type === 'button' && messageData.button) {
            result.message = messageData.button.text;
            console.log(`🔘 Mensaje de botón: "${result.message}"`);
          } else if (messageData.type === 'interactive' && messageData.interactive) {
            // Manejar mensajes interactivos (botones, listas, etc.)
            if (messageData.interactive.button_reply) {
              result.message = messageData.interactive.button_reply.title;
              console.log(`🔘 Respuesta interactiva (botón): "${result.message}"`);
            } else if (messageData.interactive.list_reply) {
              result.message = messageData.interactive.list_reply.title;
              console.log(`📋 Respuesta interactiva (lista): "${result.message}"`);
            }
          }
          
          // Si no pudimos extraer el mensaje, intentar con la estructura completa
          if (!result.message && messageData) {
            console.log('⚠️ No se pudo extraer mensaje con métodos conocidos, intentando alternativas...');
            // Intentar extraer de cualquier propiedad que tenga "body" o "text"
            if (messageData.body) {
              result.message = messageData.body;
              console.log(`🔄 Mensaje alternativo (body): "${result.message}"`);
            } else {
              // Buscar en todas las propiedades de primer nivel
              for (const key in messageData) {
                if (typeof messageData[key] === 'object' && messageData[key] !== null) {
                  if (messageData[key].body) {
                    result.message = messageData[key].body;
                    console.log(`🔄 Mensaje alternativo (${key}.body): "${result.message}"`);
                    break;
                  } else if (messageData[key].text) {
                    result.message = messageData[key].text;
                    console.log(`🔄 Mensaje alternativo (${key}.text): "${result.message}"`);
                    break;
                  }
                } else if (key === 'text' || key === 'body') {
                  result.message = messageData[key];
                  console.log(`🔄 Mensaje alternativo (${key}): "${result.message}"`);
                  break;
                }
              }
            }
          }
          
          // Capturar timestamp si está disponible
          result.timestamp = messageData.timestamp
            ? new Date(parseInt(messageData.timestamp) * 1000) 
            : new Date();
          
          console.log(`⏰ Timestamp: ${result.timestamp}`);
        } 
        // Para actualizaciones de estado de mensajes
        else if (change.value && change.value.statuses && change.value.statuses.length > 0) {
          result.isStatusUpdate = true;
          const status = change.value.statuses[0];
          result.messageId = status.id;
          result.status = status.status;
          result.timestamp = status.timestamp 
            ? new Date(parseInt(status.timestamp) * 1000) 
            : new Date();
          result.recipient = status.recipient_id;
          console.log(`📊 Actualización de estado: ${result.status} para mensaje ${result.messageId}`);
        }
      }
    }
    
    // Verificar si pudimos extraer los datos necesarios
    if (!result.isStatusUpdate && (!result.sender || !result.message)) {
      console.log(`⚠️ No se pudieron extraer datos completos del mensaje: sender=${result.sender}, message=${result.message}`);
      logDebug(`⚠️ No se pudieron extraer datos completos del mensaje: sender=${result.sender}, message=${result.message}`);
    } else {
      console.log(`Datos extraídos correctamente: ${result.isStatusUpdate ? 'actualización de estado' : `mensaje de ${result.sender}: "${result.message}"`}`);
      logDebug(`✅ Datos extraídos correctamente: ${result.isStatusUpdate ? 'actualización de estado' : `mensaje de ${result.sender}`}`);
    }
    
    return result;
  } catch (error) {
    console.log(`❌ Error extrayendo datos del mensaje: ${error.message}`);
    console.log(`❌ Stack: ${error.stack}`);
    logDebug(`❌ Error extrayendo datos del mensaje: ${error.message}`);
    return {
      isStatusUpdate: false,
      sender: null,
      message: null,
      messageId: null,
      timestamp: new Date()
    };
  }
}

// Exportar funciones para testing
module.exports = {
  app,
  extractMessageData,
  processMessageWithOpenAI,
  sendWhatsAppResponse
};

// Iniciar el servidor en el puerto especificado
app.listen(PORT, async () => {
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
  console.log(`🤖 Bot conectado al panel: ${CONTROL_PANEL_URL}`);
  
  // Verificar credenciales de GupShup
  console.log('🔍 Verificando credenciales de integración...');
  if (!GUPSHUP_API_KEY || !GUPSHUP_NUMBER || !GUPSHUP_USERID) {
    console.warn('⚠️ ADVERTENCIA: Falta alguna credencial de GupShup:');
    console.warn(`  - API Key: ${GUPSHUP_API_KEY ? '✅ Configurada' : '❌ Falta'}`);
    console.warn(`  - Número: ${GUPSHUP_NUMBER ? '✅ Configurado' : '❌ Falta'}`);
    console.warn(`  - User ID: ${GUPSHUP_USERID ? '✅ Configurado' : '❌ Falta'}`);
    console.warn('⚠️ La integración con WhatsApp no funcionará sin estas credenciales.');
  } else {
    console.log('✅ Credenciales de GupShup presentes:');
    console.log(`  - API Key: ${GUPSHUP_API_KEY.substring(0, 8)}...`);
    console.log(`  - Número de origen: ${GUPSHUP_NUMBER}`);
    console.log(`  - User ID: ${GUPSHUP_USERID.substring(0, 8)}...`);
  }
  
  // Verificar credenciales de OpenAI
  if (!OPENAI_API_KEY) {
    console.warn('⚠️ ADVERTENCIA: Falta la clave API de OpenAI. El bot no podrá responder.');
  } else {
    console.log(`Clave API de OpenAI configurada: ${OPENAI_API_KEY.substring(0, 8)}...`);
    if (OPENAI_API_KEY.startsWith('sk-proj-') && process.env.NODE_ENV === 'production') {
      console.warn('⚠️ ADVERTENCIA: Parece que estás usando una clave de API de prueba en producción.');
    }
  }
  
  // Cargar mapeos iniciales
  console.log('🔄 Inicializando mapeos y estados...');
  try {
    // Cargar todos los mapeos de números telefónicos a conversaciones
    await updateConversationMappings();
    
    // Actualizar estado de bots activos para tener una caché inicial
    console.log('🔄 Cargando estados de bot activo...');
    const { data, error } = await supabase
      .from('conversations')
      .select('id, user_id, is_bot_active')
      .eq('business_id', BUSINESS_ID);
    
    if (!error && data && data.length > 0) {
      data.forEach(conv => {
        if (conv.user_id) {
          senderBotStatusMap[conv.user_id] = conv.is_bot_active;
          console.log(`ℹ️ Bot para ${conv.user_id}: ${conv.is_bot_active ? 'ACTIVO' : 'INACTIVO'}`);
        }
      });
      console.log(`Estados de bot cargados para ${Object.keys(senderBotStatusMap).length} conversaciones`);
    } else if (error) {
      console.warn('⚠️ Error al cargar estados iniciales de bots:', error.message);
    }
  } catch (e) {
    console.error('❌ Error en inicialización de mapeos:', e.message);
  }
});

// Webhook para recibir mensajes de WhatsApp
app.post('/webhook', async (req, res) => {
    console.log('📲 Webhook recibido:', req.body.type);
    
    // Verificar el tipo de webhook
    if (req.body.type === 'message' && req.body.payload) {
        // Detectar si es un mensaje de imagen
        if (req.body.payload.type === 'image') {
            await handleMediaMessage(req, res);
            return;
        }
        
        // Proceso normal para mensajes de texto
        await handleIncomingMessage(req, res);
        return;
    }
    
    // Para otros tipos de webhooks
    res.status(200).json({ success: true, message: 'Webhook recibido' });
});

// Endpoint para enviar un mensaje a WhatsApp
app.post('/api/messages', async (req, res) => {
  console.log('📩 Mensaje manual recibido del dashboard:', JSON.stringify(req.body));
  
  try {
    const { conversationId, message, senderType = 'agent', businessId } = req.body;
    
    // Validar parámetros requeridos
    if (!conversationId) {
      return res.status(400).json({ error: 'Se requiere conversationId' });
    }
    
    if (!message) {
      return res.status(400).json({ error: 'Se requiere message (contenido del mensaje)' });
    }
    
    if (!businessId) {
      return res.status(400).json({ error: 'Se requiere businessId' });
    }
    
    // Normalizar el ID de conversación para manejar números de teléfono
    const normalizedId = /^\d+$/.test(conversationId.trim()) 
      ? conversationId.trim().replace(/^\+/, '') // Quitar el + si existe
      : conversationId;
    
    console.log(`Enviando mensaje a conversación ${normalizedId}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
    
    // IMPORTANTE: Primero desactivar el bot ANTES de enviar el mensaje
    // para evitar que responda automáticamente - GARANTIZAR QUE ESTO FUNCIONE
    console.log('🔄 PASO 1: Desactivando el bot antes de enviar mensaje desde panel...');
    let botWasDeactivated = false;
    
    try {
      // IMPORTANTE: Intentar MÚLTIPLES estrategias para desactivar el bot
      // Estrategia 1: Actualizar directamente en la base de datos
      const { data: botData, error: botError } = await supabase
        .from('conversations')
        .update({ is_bot_active: false })
        .eq('id', normalizedId)
        .select();
      
      if (botError) {
        console.warn('⚠️ Estrategia 1 falló: No se pudo desactivar bot por ID directo:', botError.message);
        
        // Estrategia 2: Buscar por user_id si el ID parece ser un número de teléfono
        if (/^\d+$/.test(normalizedId)) {
          console.log('🔄 Intentando Estrategia 2: Desactivar por user_id (número telefónico)');
          const { data: phoneUpdate, error: phoneError } = await supabase
            .from('conversations')
            .update({ is_bot_active: false })
            .eq('user_id', normalizedId)
            .eq('business_id', businessId)
            .select();
          
          if (phoneError) {
            console.warn('⚠️ Estrategia 2 falló:', phoneError.message);
          } else if (phoneUpdate && phoneUpdate.length > 0) {
            console.log('✅ Bot desactivado exitosamente con Estrategia 2 (actualización por user_id)');
            botWasDeactivated = true;
          }
        }
      } else if (botData && botData.length > 0) {
        console.log('✅ Bot desactivado exitosamente con Estrategia 1 (actualización directa por ID)');
        botWasDeactivated = true;
      }
      
      // Estrategia 3: Usar SQL directo si las anteriores fallan
      if (!botWasDeactivated) {
        console.log('🔄 Intentando Estrategia 3: Desactivar con SQL directo');
        // Crear consulta SQL que maneje ambos casos (por ID o por user_id)
        let sqlQuery = '';
        let params = {};
        
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedId)) {
          // Es un UUID
          sqlQuery = 'UPDATE conversations SET is_bot_active = false WHERE id = $1 RETURNING *';
          params = [normalizedId];
      } else {
          // Es un número telefónico
          sqlQuery = 'UPDATE conversations SET is_bot_active = false WHERE user_id = $1 AND business_id = $2 RETURNING *';
          params = [normalizedId, businessId];
        }
        
        const { data: sqlUpdate, error: sqlError } = await supabase.rpc('execute_sql', { 
          query_text: sqlQuery, 
          params_array: params 
        });
        
        if (sqlError) {
          console.warn('⚠️ Estrategia 3 falló:', sqlError.message);
        } else if (sqlUpdate && sqlUpdate.length > 0) {
          console.log('✅ Bot desactivado exitosamente con Estrategia 3 (SQL directo)');
          botWasDeactivated = true;
        }
      }
    } catch (botToggleError) {
      console.error('❌ Error al intentar desactivar el bot:', botToggleError.message);
      // No interrumpir el flujo si falla la desactivación
    }
    
    // PASO 2: Enviar el mensaje (asegurándonos que sender_type es 'bot' para cumplir con restricciones de DB)
    console.log('🔄 PASO 2: Enviando mensaje...');
    const validSenderType = senderType === 'agent' ? 'bot' : senderType;
    
    let messageResult;
    try {
      // Usar registerBotResponse que ya tiene toda la lógica para manejo de mensajes
      messageResult = await global.registerBotResponse(
        normalizedId,
        message,
        businessId,
        validSenderType
      );
      
      if (!messageResult || !messageResult.success) {
        throw new Error(messageResult?.error || 'Error desconocido al registrar mensaje');
      }
      
      console.log('✅ Mensaje registrado exitosamente:', messageResult.id);
    } catch (registerError) {
      console.error('❌ Error al registrar mensaje:', registerError.message);
      return res.status(500).json({ 
        error: 'Error al registrar mensaje', 
        details: registerError.message 
      });
    }
    
    // PASO 3: VERIFICAR nuevamente que el bot sigue desactivado
    console.log('🔄 PASO 3: Verificando que el bot permanece desactivado...');
    try {
      const { data: verifyData, error: verifyError } = await supabase
        .from('conversations')
        .select('id, is_bot_active')
        .or(`id.eq.${normalizedId},user_id.eq.${normalizedId}`)
        .eq('business_id', businessId)
        .single();
      
      if (verifyError) {
        console.warn('⚠️ No se pudo verificar estado del bot:', verifyError.message);
      } else if (verifyData && verifyData.is_bot_active === true) {
        console.warn('⚠️ Bot sigue activo después del mensaje, intentando desactivar nuevamente...');
        
        // Forzar desactivación una vez más
        const { error: updateError } = await supabase
          .from('conversations')
          .update({ is_bot_active: false })
          .eq('id', verifyData.id);
        
        if (updateError) {
          console.error('❌ No se pudo desactivar el bot después de verificación:', updateError.message);
        } else {
          console.log('✅ Bot desactivado nuevamente con éxito');
        }
      } else {
        console.log('✅ Verificado: El bot está correctamente desactivado');
      }
    } catch (verifyError) {
      console.warn('⚠️ Error al verificar estado final del bot:', verifyError.message);
    }
    
    // PASO 4: Enviar mensaje a WhatsApp si es necesario
    let whatsappSuccess = false;
    let whatsappError = null;
    
    try {
      console.log('📲 PASO 4: Enviando mensaje a WhatsApp...');
      
      // Obtener número telefónico si es un conversationId
      let phoneNumber = normalizedId;
      
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedId)) {
        // Es un UUID, buscar el número de teléfono asociado
        console.log(`🔍 Buscando número de teléfono para conversación ${normalizedId}`);
        
        // Verificar primero en caché
        if (conversationIdToPhoneMap[normalizedId]) {
          phoneNumber = conversationIdToPhoneMap[normalizedId];
          console.log(`Número encontrado en caché para conversación: ${phoneNumber}`);
        } else {
          // Buscar en base de datos
          try {
            const { data, error } = await supabase
              .from('conversations')
              .select('user_id')
              .eq('id', normalizedId)
              .single();
            
            if (error) {
    console.error(`Error buscando número para conversación: ${error.message}`);
              throw new Error(`No se pudo obtener el número de teléfono: ${error.message}`);
            }
            
            if (data && data.user_id) {
              phoneNumber = data.user_id;
              console.log(`Número encontrado en DB para conversación: ${phoneNumber}`);
              
              // Actualizar caché
              conversationIdToPhoneMap[normalizedId] = phoneNumber;
              phoneToConversationMap[phoneNumber] = normalizedId;
            } else {
              console.error(`No se encontró un número de teléfono para la conversación ${normalizedId}`);
              throw new Error('No se encontró un número de teléfono asociado a esta conversación');
            }
          } catch (dbError) {
    console.error(`Error al buscar número en DB: ${dbError.message}`);
            throw dbError;
          }
        }
      }
      
      // Verificar que tenemos un número válido
      if (!phoneNumber || !/^\d+$/.test(phoneNumber.toString().replace(/^\+/, ''))) {
    console.error(`Número de teléfono inválido: ${phoneNumber}`);
        throw new Error(`Formato de número inválido: ${phoneNumber}`);
      }
      
      // Asegurar formato correcto del número
      const formattedNumber = phoneNumber.toString().replace(/^\+/, '');
      console.log(`📱 Número final para envío: ${formattedNumber}`);
      
      // Enviar mensaje a WhatsApp directamente
      const apiUrl = 'https://api.gupshup.io/wa/api/v1/msg';
      
      const formData = new URLSearchParams();
      formData.append('channel', 'whatsapp');
      formData.append('source', GUPSHUP_NUMBER);
      formData.append('destination', formattedNumber);
      formData.append('src.name', GUPSHUP_NUMBER);
      formData.append('message', JSON.stringify({
          type: 'text',
          text: message
      }));
      
      const headers = {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Bearer ' + GUPSHUP_API_KEY, 'Content-Type': 'application/json',
        'userid': GUPSHUP_USERID  // Añadimos el userid para mejorar la autenticación
      };
      
      console.log('🔄 Enviando mensaje directamente a la API de GupShup...');
      console.log(`📊 Parámetros de envío: destination=${formattedNumber}, text="${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`);
      
      try {
        const response = await axios.post(apiUrl, formData, { headers });
        
        if (response.status >= 200 && response.status < 300) {
          console.log('✅ Mensaje enviado exitosamente a WhatsApp');
          console.log('📊 Respuesta de GupShup:', JSON.stringify(response.data));
          whatsappSuccess = true;
        } else {
          console.error(`Error en la respuesta de GupShup: ${response.status}`);
          whatsappError = `Error HTTP: ${response.status}`;
        }
      } catch (apiError) {
        console.error('❌ Error en la llamada a la API de GupShup:', apiError.message);
        
        if (apiError.response) {
          console.error('📊 Detalles del error:', apiError.response.status, JSON.stringify(apiError.response.data || {}));
          whatsappError = `Error HTTP ${apiError.response.status}: ${JSON.stringify(apiError.response.data || {})}`;
        } else if (apiError.request) {
          console.error('📊 No se recibió respuesta:', apiError.request);
          whatsappError = 'No se recibió respuesta del servidor de GupShup';
        } else {
          console.error('📊 Error en la configuración:', apiError.message);
          whatsappError = apiError.message;
        }
      }
  } catch (error) {
      console.error('❌ Error general al enviar mensaje a WhatsApp:', error.message);
      whatsappError = error.message;
      // No fallamos la petición principal por un error en el envío a WhatsApp
    }
    
    return res.status(200).json({
      success: true,
      id: messageResult.id,
      message: 'Mensaje enviado y bot desactivado correctamente',
      bot_status: 'deactivated',
      sent_to_whatsapp: whatsappSuccess,
      whatsapp_error: whatsappError
    });
  } catch (error) {
    console.error('❌ Error general al procesar mensaje:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Endpoint para verificar que el servidor está activo y configurado
app.get('/api/status', (req, res) => {
  res.status(200).json({
    status: 'online',
    version: '1.0',
    gupshupConfigured: !!GUPSHUP_API_KEY && !!GUPSHUP_NUMBER,
    openaiConfigured: !!OPENAI_API_KEY && !!ASSISTANT_ID
  });
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
        console.log(`Respuesta del bot guardada correctamente en Supabase`);
      } else {
        console.error(`Error al guardar respuesta del bot en Supabase: ${result?.error || 'Error desconocido'}`);
      }
    } catch (controlPanelError) {
    console.error(`Error al registrar respuesta del bot en Supabase:`, controlPanelError.message);
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

// Endpoint para obtener conversaciones por ID de negocio
app.get('/api/conversations/business/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    console.log(`🔍 Buscando conversaciones para el negocio: ${businessId}`);
    
    // Cargar directamente la configuración de Supabase para asegurar que siempre use valores correctos
    const supabaseConfig = require('./supabase-config');
    const supabaseUrl = process.env.SUPABASE_URL || supabaseConfig.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || supabaseConfig.SUPABASE_KEY;
    
    // Construir la URL para consultar las conversaciones
    const url = `${supabaseUrl}/rest/v1/conversations?business_id=eq.${businessId}&order=last_message_time.desc`;
    
    // Realizar la consulta a Supabase
    const response = await axios.get(url, {
      headers: {
        'Authorization': 'Bearer ' + supabaseKey, 'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    const conversations = response.data;
    console.log(`Se encontraron ${conversations.length} conversaciones para el negocio ${businessId}`);
    
    return res.status(200).json(conversations);
  } catch (error) {
    console.error('❌ Error al obtener conversaciones:', error.message);
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', error.response.data);
    }
    return res.status(500).json({ error: 'Error al obtener conversaciones' });
  }
});

// Endpoint para obtener mensajes de una conversación específica
app.get('/api/messages/:conversationId', async (req, res) => {
    try {
    const conversationId = req.params.conversationId;
    console.log(`🔍 Solicitando mensajes para conversación/número: ${conversationId}`);
    
    if (!conversationId) {
      return res.status(400).json({ error: 'Se requiere ID de conversación o número de teléfono' });
    }
    
    // Determinar si es un UUID (ID de conversación) o un número de teléfono
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId);
    const isPhoneNumber = /^\+?\d+$/.test(conversationId);
    
    console.log(`🔍 Tipo de ID proporcionado: ${isUUID ? 'UUID' : isPhoneNumber ? 'Número de teléfono' : 'Desconocido'}`);
    
    // Cargar directamente la configuración de Supabase para asegurar que siempre use valores correctos
    const supabaseConfig = require('./supabase-config');

// Importar sistema de notificaciones - agregado para el deployment en Render
global.notificationModule = require('./notification-patch');
// Exponer funciones del módulo de notificaciones a variables globales
global.processMessageForNotification = global.notificationModule.processMessageForNotification;
global.sendWhatsAppResponseWithNotification = global.notificationModule.sendWhatsAppResponseWithNotification;
global.checkForNotificationPhrases = global.notificationModule.checkForNotificationPhrases;
global.sendBusinessNotification = global.notificationModule.sendBusinessNotification;

// Fin de importación del sistema de notificaciones

    const supabaseUrl = process.env.SUPABASE_URL || supabaseConfig.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || supabaseConfig.SUPABASE_KEY;
    
    // Variable para almacenar el ID real de la conversación
    let actualConversationId = conversationId;
    
    // Si es un número de teléfono, necesitamos encontrar el ID de conversación
    if (isPhoneNumber) {
      console.log(`🔍 Buscando ID de conversación para el número de teléfono: ${conversationId}`);
      
      // Normalizar el número (eliminar el símbolo + si existe)
      const normalizedPhone = conversationId.replace(/^\+/, '');
      
      // Primero verificar en la caché
      if (phoneToConversationMap[normalizedPhone]) {
        actualConversationId = phoneToConversationMap[normalizedPhone];
        console.log(`ID de conversación encontrado en caché: ${actualConversationId}`);
      } else {
        // Buscar en la base de datos
        try {
          // Consultar Supabase para encontrar la conversación asociada al número
          const conversationUrl = `${supabaseUrl}/rest/v1/conversations?user_id=eq.${normalizedPhone}&business_id=eq.${BUSINESS_ID}&order=created_at.desc&limit=1`;
          
          const conversationResponse = await axios.get(conversationUrl, {
          headers: {
              'Authorization': 'Bearer ' + supabaseKey, 'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (conversationResponse.data && conversationResponse.data.length > 0) {
            actualConversationId = conversationResponse.data[0].id;
            console.log(`ID de conversación encontrado en DB: ${actualConversationId}`);
            
            // Actualizar caché para futuras referencias
            phoneToConversationMap[normalizedPhone] = actualConversationId;
            conversationIdToPhoneMap[actualConversationId] = normalizedPhone;
            console.log(`📝 Caché actualizada para futuras referencias`);
          } else {
            console.log(`⚠️ No se encontró ninguna conversación para el número: ${normalizedPhone}`);
            return res.status(404).json({
              error: "No se encontró ninguna conversación asociada al número " + conversationId,
              conversationId: conversationId,
              isPhoneNumber: true
            });
          }
        } catch (dbError) {
          console.error('❌ Error buscando conversación:', dbError.message);
          return res.status(500).json({ error: 'Error buscando conversación' });
        }
      }
    }
    
    // Ahora tenemos el ID real de la conversación, podemos obtener los mensajes
    console.log(`🔍 Obteniendo mensajes para ID de conversación: ${actualConversationId}`);
    
    // Construir la URL para consultar los mensajes
    const url = `${supabaseUrl}/rest/v1/messages?conversation_id=eq.${actualConversationId}&order=created_at.asc`;
    
    // Realizar la consulta a Supabase
    const response = await axios.get(url, {
        headers: {
        'Authorization': 'Bearer ' + supabaseKey, 'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    const messages = response.data;
    console.log(`Encontrados ${messages.length} mensajes para la conversación ${actualConversationId}`);
    
    // Añadir información adicional para ayudar en la depuración
    return res.status(200).json({
      messages: messages,
      conversationId: conversationId,
      actualConversationId: actualConversationId,
      isPhoneNumber: isPhoneNumber,
      isUUID: isUUID
        });
    } catch (error) {
    console.error('❌ Error al obtener mensajes:', error.message);
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', error.response.data);
    }
    return res.status(500).json({ error: 'Error al obtener mensajes' });
    }
});

// Nueva ruta para buscar conversación por número de teléfono
app.get('/api/conversation/phone/:phoneNumber', async (req, res) => {
    try {
        console.log(`🔍 Buscando conversación para número: ${req.params.phoneNumber}`);
        
        const { data, error } = await supabase
            .from('conversations')
            .select('*')
            .eq('user_id', req.params.phoneNumber)
            .single();
        
        if (error) {
            console.log(`❌ Error buscando conversación: ${error.message}`);
            return res.status(400).json({
                error: 'Error buscando conversación',
                details: error.message
            });
        }
        
        if (!data) {
            return res.status(404).json({
                error: 'Conversación no encontrada',
                details: `No se encontró conversación para el número ${req.params.phoneNumber}`
            });
        }
        
        console.log(`Conversación encontrada: ${data.id}`);
        return res.json({
            success: true,
            conversation: data
        });
    } catch (error) {
        console.log(`❌ Error general: ${error.message}`);
        return res.status(500).json({
            error: 'Error del servidor',
            details: error.message
        });
    }
});

// Endpoint para activar/desactivar el bot para una conversación específica (acepta PUT y POST)
app.put('/api/conversations/:id/toggle-bot', handleToggleBot);
app.post('/api/conversations/:id/toggle-bot', handleToggleBot);

// Función de manejo para toggle-bot
async function handleToggleBot(req, res) {
    try {
        logDebug(`🤖 TOGGLE BOT - Iniciando cambio de estado para conversación ${req.params.id}`);
        
        const { id } = req.params;
        const { active } = req.body;
        
        if (!id) {
            logDebug(`❌ TOGGLE BOT - ID de conversación faltante`);
            return res.status(400).json({ error: 'Se requiere ID de conversación' });
        }
        
        logDebug(`🔄 TOGGLE BOT - Solicitando cambio a: ${active ? 'ACTIVO' : 'INACTIVO'} para conversación ${id}`);
        
        // Obtener datos de la conversación para verificar que existe
        const { data: convData, error: convError } = await supabase
            .from('conversations')
            .select('id, user_id, business_id')
            .eq('id', id)
            .single();
            
        if (convError) {
            logDebug(`❌ TOGGLE BOT - Error obteniendo datos de conversación: ${convError.message}`);
            return res.status(404).json({ error: 'Conversación no encontrada', details: convError.message });
        }
        
        if (!convData) {
            logDebug(`❌ TOGGLE BOT - Conversación ${id} no existe en la base de datos`);
            return res.status(404).json({ error: 'Conversación no encontrada' });
        }
        
        // Actualizar estado del bot en la base de datos
        const { data, error } = await supabase
            .from('conversations')
            .update({ is_bot_active: active })
            .eq('id', id)
            .select('id, user_id, is_bot_active')
            .single();
            
        if (error) {
            logDebug(`❌ TOGGLE BOT - Error actualizando estado: ${error.message}`);
            return res.status(500).json({ 
                error: 'Error al actualizar estado del bot', 
                details: error.message 
            });
        }
        
        logDebug(`✅ TOGGLE BOT - Estado actualizado en DB: is_bot_active=${active} para conversación ${id}`);
        
        // Actualizar caché
        if (data && data.user_id) {
            senderBotStatusMap[data.user_id] = active;
            logDebug(`📝 TOGGLE BOT - Caché actualizada: senderBotStatusMap[${data.user_id}] = ${active}`);
        }
        
        // En desarrollo, mostrar todos los mapeos actualizados
        if (process.env.NODE_ENV !== 'production') {
            logDebug('📊 TOGGLE BOT - Estado actual de cache:');
            Object.keys(senderBotStatusMap).forEach(key => {
                logDebug(`   - ${key}: ${senderBotStatusMap[key] ? 'ACTIVO' : 'INACTIVO'}`);
            });
        }
        
        return res.status(200).json({ 
            success: true, 
            is_bot_active: active, 
            message: `Bot ${active ? 'activado' : 'desactivado'} exitosamente`,
            conversation_id: id,
            user_id: data.user_id
        });
    } catch (error) {
        logDebug(`❌ TOGGLE BOT - Error general: ${error.message}`);
        return res.status(500).json({ 
            error: 'Error al procesar la solicitud', 
            message: error.message 
        });
    }
}

// Endpoint para verificar el estado actual del bot
app.get('/api/bot-status/:id', handleBotStatus);

// Función para manejar la verificación del estado del bot
async function handleBotStatus(req, res) {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({ error: 'Se requiere ID de conversación o número de teléfono' });
        }
        
        logDebug(`🔍 Verificando estado del bot para: ${id}`);
        
        // Verificar si es un UUID o un número de teléfono
        const isUUID = id.includes('-');
        
        let query;
        if (isUUID) {
            // Es un ID de conversación
            query = supabase
                .from('conversations')
                .select('id, user_id, is_bot_active, last_message_time')
                .eq('id', id);
        } else {
            // Es un número de teléfono
            query = supabase
                .from('conversations')
                .select('id, user_id, is_bot_active, last_message_time')
                .eq('user_id', id);
        }
        
        const { data, error } = await query;
        
        if (error) {
            logDebug(`❌ Error consultando estado del bot: ${error.message}`);
            return res.status(500).json({ 
                error: 'Error al consultar estado', 
                details: error.message 
            });
        }
        
        if (!data || data.length === 0) {
            logDebug(`⚠️ No se encontró conversación para: ${id}`);
            return res.status(404).json({ 
                error: 'Conversación no encontrada', 
                id 
            });
        }
        
        // Obtener el estado del cache también
        const cacheStatus = isUUID 
            ? (data[0].user_id ? senderBotStatusMap[data[0].user_id] : undefined)
            : senderBotStatusMap[id];
        
        logDebug(`✅ Estado encontrado para ${id}:`);
        logDebug(`   - DB: ${data.map(c => `${c.id}=${c.is_bot_active}`).join(', ')}`);
        logDebug(`   - Cache: ${cacheStatus !== undefined ? cacheStatus : 'no en caché'}`);
        
        return res.status(200).json({
            success: true,
            conversations: data.map(conv => ({
                id: conv.id,
                user_id: conv.user_id,
                is_bot_active: conv.is_bot_active,
                last_message_time: conv.last_message_time,
                cache_status: conv.user_id ? senderBotStatusMap[conv.user_id] : undefined
            })),
            cache_status: cacheStatus
        });
  } catch (error) {
        logDebug(`❌ Error general en bot-status: ${error.message}`);
        return res.status(500).json({ 
            error: 'Error al procesar la solicitud', 
            message: error.message 
        });
    }
}

// Endpoint para simular el procesamiento con OpenAI sin enviar a WhatsApp
app.post('/api/simulate-openai/:id', handleSimulateOpenAI);

// Función para manejar la simulación
async function handleSimulateOpenAI(req, res) {
    try {
        const { id } = req.params;
        const { message } = req.body;
        
        if (!id) {
            return res.status(400).json({ error: 'Se requiere ID de conversación o número de teléfono' });
        }
        
        if (!message) {
            return res.status(400).json({ error: 'Se requiere un mensaje para procesar' });
        }
        
        logDebug(`🔬 SIMULACIÓN - Procesando mensaje para ${id}: "${message}"`);
        
        // Sobreescribir temporalmente sendWhatsAppResponse para capturar respuesta
        const originalSendWhatsApp = sendWhatsAppResponse;
        let capturedResponse = null;
        
        sendWhatsAppResponse = async (recipient, response) => {
            logDebug(`📝 SIMULACIÓN - Capturando respuesta: "${response.substring(0, 100)}${response.length > 100 ? '...' : ''}"`);
            capturedResponse = response;
            return true; // Simular éxito
        };
        
        try {
            // Si es un UUID (ID de conversación)
            const isUUID = id.includes('-');
            let userId = id;
            let conversationId = isUUID ? id : null;
            
            // Si es un ID de conversación, obtener el user_id
            if (isUUID) {
                const { data, error } = await supabase
                    .from('conversations')
                    .select('user_id')
                    .eq('id', id)
                    .single();
                    
                if (error || !data) {
                    return res.status(404).json({ error: 'Conversación no encontrada' });
                }
                
                userId = data.user_id;
            } 
            // Si es un número de teléfono, buscar la conversación correspondiente
            else {
                const { data, error } = await supabase
                    .from('conversations')
                    .select('id')
                    .eq('user_id', id)
                    .order('created_at', { ascending: false })
                    .limit(1);
                    
                if (!error && data && data.length > 0) {
                    conversationId = data[0].id;
                }
            }
            
            // Guardar estado original del bot para este usuario
            const originalBotStatus = senderBotStatusMap[userId];
            
            // Forzar estado activo para la simulación
            senderBotStatusMap[userId] = true;
            logDebug(`🤖 SIMULACIÓN - Forzando bot ACTIVO temporalmente para ${userId}`);
            
            // Procesar con OpenAI
            const response = await processMessageWithOpenAI(userId, message, conversationId);
            
            // Restaurar estado original
            senderBotStatusMap[userId] = originalBotStatus;
            logDebug(`🔄 SIMULACIÓN - Restaurando estado original del bot: ${originalBotStatus ? 'ACTIVO' : 'INACTIVO'}`);
            
            // Restaurar función original
            sendWhatsAppResponse = originalSendWhatsApp;
            
            if (capturedResponse) {
                return res.status(200).json({
                    success: true,
                    message: 'Simulación exitosa',
                    response: capturedResponse,
                    user_id: userId,
                    conversation_id: conversationId
                });
    } else {
                return res.status(500).json({
                    success: false,
                    message: 'No se pudo generar una respuesta'
                });
            }
        } finally {
            // Asegurar que la función original se restaure incluso si hay error
            sendWhatsAppResponse = originalSendWhatsApp;
    }
  } catch (error) {
        logDebug(`❌ SIMULACIÓN - Error: ${error.message}`);
        return res.status(500).json({
            error: 'Error al procesar la simulación',
            message: error.message
        });
    }
}

// Configurar el registro en archivo de depuración
const debugLogFile = path.join(__dirname, 'debug.log');
const logDebug = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}\n`;
  fs.appendFileSync(debugLogFile, logMessage);
  console.log(message); // También mantener los logs en la consola
};

// También reemplazar algunas instancias clave de console.log con logDebug
// ... existing code ...

// Endpoint para pruebas de GupShup API
app.get('/api/test-gupshup', async (req, res) => {
  try {
    console.log('🔍 Probando credenciales de GupShup...');
    
    // Mostrar información de configuración
    console.log(`🔑 API Key: ${GUPSHUP_API_KEY ? 'Configurada (primeros 10 caracteres: ' + GUPSHUP_API_KEY.substring(0, 10) + '...)' : 'No configurada'}`);
    console.log(`📱 Número: ${GUPSHUP_NUMBER || 'No configurado'}`);
    console.log(`👤 User ID: ${GUPSHUP_USERID ? 'Configurado (primeros 10 caracteres: ' + GUPSHUP_USERID.substring(0, 10) + '...)' : 'No configurado'}`);
    
    // Probar conexión a GupShup - Verificar estado de la cuenta
    const apiUrl = 'https://api.gupshup.io/wa/api/v1/users/info';
    
    const headers = {
      'Authorization': 'Bearer ' + GUPSHUP_API_KEY, 'Content-Type': 'application/json',
      'Content-Type': 'application/json'
    };
    
    console.log('🔄 Realizando solicitud a GupShup...');
    
    try {
      const response = await axios.get(apiUrl, { headers });
      
      console.log(`Conexión exitosa a GupShup: ${response.status}`);
      console.log(`📊 Datos recibidos: ${JSON.stringify(response.data)}`);
      
      return res.json({
        success: true,
        status: 'Conexión exitosa',
        message: 'Las credenciales de GupShup son válidas',
        apiResponse: response.data
      });
    } catch (apiError) {
      console.log(`❌ Error al conectar con GupShup: ${apiError.message}`);
      
      let errorDetails = {
        message: apiError.message
      };
      
      if (apiError.response) {
        errorDetails.status = apiError.response.status;
        errorDetails.data = apiError.response.data;
        console.log(`❌ Respuesta de error: ${apiError.response.status} - ${JSON.stringify(apiError.response.data)}`);
      }
      
      return res.status(500).json({
        success: false,
        status: 'Error de conexión',
        message: 'Falló la conexión con GupShup',
        error: errorDetails
      });
    }
  } catch (error) {
    console.error(`Error general: ${error.message}`);
    return res.status(500).json({
      success: false,
      status: 'Error',
      message: error.message
    });
  }
});

// ... existing code ...

// Endpoint para actualizar credenciales de GupShup
app.post('/api/update-gupshup-credentials', async (req, res) => {
  try {
    const { apiKey, number, userId } = req.body;
    
    console.log('🔄 Actualizando credenciales de GupShup...');
    
    // Comprobar que se proporcionaron los datos necesarios
    if (!apiKey && !number && !userId) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar al menos una credencial para actualizar (apiKey, number o userId)'
      });
    }
    
    // Guardar valores anteriores para poder restaurarlos en caso de error
    const previousApiKey = GUPSHUP_API_KEY;
    const previousNumber = GUPSHUP_NUMBER;
    const previousUserId = GUPSHUP_USERID;
    
    // Actualizar las variables globales con los nuevos valores
    if (apiKey) {
      console.log(`🔑 Actualizando API Key: ${apiKey.substring(0, 8)}...`);
      GUPSHUP_API_KEY = apiKey;
    }
    
    if (number) {
      console.log(`📱 Actualizando número: ${number}`);
      GUPSHUP_NUMBER = number;
    }
    
    if (userId) {
      console.log(`👤 Actualizando User ID: ${userId.substring(0, 8)}...`);
      GUPSHUP_USERID = userId;
    }
    
    // Probar conexión a GupShup con las nuevas credenciales
    const apiUrl = 'https://api.gupshup.io/wa/api/v1/users/info';
    
    const headers = {
      'Authorization': 'Bearer ' + GUPSHUP_API_KEY, 'Content-Type': 'application/json',
      'Content-Type': 'application/json'
    };
    
    console.log('🔄 Probando conexión con nuevas credenciales...');
    
    try {
      const response = await axios.get(apiUrl, { headers });
      
      console.log(`Conexión exitosa con nuevas credenciales: ${response.status}`);
      console.log(`📊 Datos recibidos: ${JSON.stringify(response.data)}`);
      
      return res.json({
        success: true,
        message: 'Credenciales actualizadas correctamente',
        updatedCredentials: {
          apiKey: apiKey ? `${apiKey.substring(0, 8)}...` : 'No actualizada',
          number: number || 'No actualizado',
          userId: userId ? `${userId.substring(0, 8)}...` : 'No actualizado'
        },
        apiResponse: response.data
      });
    } catch (apiError) {
      // Restaurar valores anteriores en caso de error
      console.log(`❌ Error al conectar con nuevas credenciales: ${apiError.message}`);
      console.log('🔄 Restaurando credenciales anteriores...');
      
      GUPSHUP_API_KEY = previousApiKey;
      GUPSHUP_NUMBER = previousNumber;
      GUPSHUP_USERID = previousUserId;
      
      let errorDetails = {
        message: apiError.message
      };
      
      if (apiError.response) {
        errorDetails.status = apiError.response.status;
        errorDetails.data = apiError.response.data;
        console.log(`❌ Respuesta de error: ${apiError.response.status} - ${JSON.stringify(apiError.response.data)}`);
      }
      
      return res.status(500).json({
        success: false,
        message: 'Error al conectar con GupShup usando las nuevas credenciales',
        error: errorDetails
      });
    }
  } catch (error) {
    console.error(`Error general: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// ... existing code ...

// Endpoint para enviar mensajes manuales desde el dashboard
app.post('/api/send-manual-message', async (req, res) => {
  console.log('📝 Recibida solicitud para enviar mensaje manual:', JSON.stringify(req.body));
  
  try {
    const { phoneNumber, message, mediaUrl, caption, content } = req.body;
    
    // Validar campos requeridos
    if (!phoneNumber || !phoneNumber.trim()) {
      console.error('❌ Error: No se proporcionó número de teléfono');
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere número de teléfono' 
      });
    }
    
    // Permitir que el mensaje venga en 'message' o 'content' para mayor compatibilidad
    const messageContent = message || content || '';
    if (!messageContent.trim() && !mediaUrl) {
      console.error('❌ Error: No se proporcionó mensaje ni media');
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere mensaje o URL de media' 
      });
    }
    
    // Formatear número de teléfono (eliminar espacios, guiones, etc.)
    let formattedPhone = phoneNumber.replace(/\D/g, '');
    
    // Asegurarse de que tenga el formato correcto para WhatsApp
    if (formattedPhone.endsWith('@c.us')) {
      // Si tiene @c.us al final, quitarlo para usar con GupShup
      formattedPhone = formattedPhone.replace('@c.us', '');
    }
    
    // Agregar código de país si no lo tiene
    if (formattedPhone.length <= 10) {
      formattedPhone = `521${formattedPhone}`;
    }
    
    console.log(`📱 Enviando mensaje a: ${formattedPhone}`);
    console.log(`💬 Mensaje: ${messageContent}`);
    
    // Si hay URL de media, enviar mensaje con media
    if (mediaUrl) {
      console.log(`🖼️ Enviando mensaje con imagen a ${formattedPhone}`);
      console.log(`🖼️ URL de imagen: ${mediaUrl}`);
      
      try {
        // Usar la función de envío de media GupShup
        const captionText = caption || messageContent || '';
        const result = await sendMediaMessageGupShup(formattedPhone, mediaUrl, captionText);
        
        console.log('✅ Mensaje con media enviado con éxito usando GupShup');
        return res.json({
          success: true,
          message: 'Mensaje con media enviado con éxito',
          details: result
        });
      } catch (mediaError) {
        console.error('❌ Error al enviar mensaje con media:', mediaError);
        
        // Si falla el envío con media, intentar enviar solo el texto
        if (messageContent.trim()) {
          try {
            const textResult = await sendTextMessageGupShup(formattedPhone, messageContent);
            console.log('✅ Se envió el mensaje de texto (sin la imagen)');
            
        return res.json({
          success: true,
              message: 'Mensaje de texto enviado (sin la imagen)', 
              warning: 'No se pudo enviar la imagen',
              details: textResult
        });
      } catch (textError) {
            throw new Error(`Error al enviar texto después de fallo de media: ${textError.message}`);
      }
    } else {
          throw new Error('No se pudo enviar el mensaje con media y no hay texto alternativo');
        }
      }
    } else {
      // Enviar mensaje de texto normal con GupShup
      try {
        const result = await sendTextMessageGupShup(formattedPhone, messageContent);
        console.log('✅ Mensaje de texto enviado con éxito');
        
        return res.json({ 
          success: true, 
          message: 'Mensaje enviado con éxito',
          details: result
        });
      } catch (textError) {
        throw new Error(`Error al enviar mensaje de texto: ${textError.message}`);
      }
    }
  } catch (error) {
    console.error('❌ Error al enviar mensaje manual:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Error interno del servidor' 
    });
  }
});

// Función para enviar mensajes de texto a WhatsApp
async function sendWhatsAppTextMessage(phoneNumber, message) {
  console.log(`Enviando mensaje de texto a ${phoneNumber}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
  
  try {
    const response = await axios.post(
      'https://api.gupshup.io/sm/api/v1/msg',
      `channel=whatsapp&source=${GUPSHUP_NUMBER}&destination=${phoneNumber}&message=${encodeURIComponent(message)}&disablePreview=false&source=${GUPSHUP_NUMBER}`,
      {
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Bearer ' + GUPSHUP_API_KEY, 'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );
    
    console.log('✅ Respuesta de GupShup al enviar texto:', JSON.stringify(response.data));
    return true;
  } catch (error) {
    console.error('❌ Error en sendWhatsAppTextMessage:', error.message);
    throw error;
  }
}

async function sendMediaMessage(recipient, mediaUrl, caption = '') {
    try {
        console.log(`Enviando media a ${recipient} - URL: ${mediaUrl}`);
        
        if (!recipient || !mediaUrl) {
            console.error('❌ Error: Destinatario o URL de media faltantes');
            return false;
        }
        
        // Formatear el número (eliminar + al principio si existe)
        const formattedNumber = recipient.startsWith('+') 
            ? recipient.substring(1) 
            : recipient;
        
        // Verificar que el número contenga solo dígitos
        if (!/^\d+$/.test(formattedNumber)) {
    console.error(`Número inválido: ${formattedNumber}`);
            return false;
        }
        
        // Verificar la URL
        if (!mediaUrl.startsWith('http')) {
    console.error(`URL de imagen inválida: ${mediaUrl}`);
            return false;
        }
        
        // Verificar credenciales de GupShup
        if (!GUPSHUP_API_KEY || !GUPSHUP_NUMBER || !GUPSHUP_USERID) {
            console.error('❌ CREDENCIALES FALTANTES:', {
                apiKey: GUPSHUP_API_KEY ? 'Configurada' : 'FALTA',
                number: GUPSHUP_NUMBER ? 'Configurado' : 'FALTA',
                userId: GUPSHUP_USERID ? 'Configurado' : 'FALTA'
            });
            return false;
        }
        
        // API v1 de GupShup
        const apiUrl = 'https://api.gupshup.io/wa/api/v1/msg';
        const apiKey = GUPSHUP_API_KEY;
        const source = GUPSHUP_NUMBER;
        
        console.log(`🔑 Usando API Key para media: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 5)}`);
        console.log(`📱 Usando número en GupShup: ${source}`);
        console.log(`📱 Hacia número: ${formattedNumber}`);
        
        // Crear el mensaje para imagen
        const mediaMessage = {
            type: "image",
            originalUrl: mediaUrl,
            previewUrl: mediaUrl,
            caption: caption || ""
        };
        
        const formData = new URLSearchParams();
        formData.append('channel', 'whatsapp');
        formData.append('source', source);
        formData.append('destination', formattedNumber);
        formData.append('src.name', source);
        formData.append('message', JSON.stringify(mediaMessage));
        
        const headers = {
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json',
            'userid': GUPSHUP_USERID
        };
        
        console.log('🔄 Enviando imagen a WhatsApp...');
        console.log('📦 Payload:', JSON.stringify({
            message: mediaMessage,
            destination: formattedNumber
        }, null, 2));
        
        try {
            const response = await axios.post(apiUrl, formData, { headers });
            
            console.log('📡 Respuesta de GupShup Media:', JSON.stringify(response.data));
            
            if (response.status >= 200 && response.status < 300) {
                console.log('✅ Imagen enviada exitosamente a WhatsApp');
                
                // Guardar mensaje en la base de datos
                try {
                    await global.registerBotResponse(
                        recipient,
                        caption || 'Imagen enviada',
                        BUSINESS_ID, 
                        'bot',
                        mediaUrl
                    );
                    console.log('✅ Mensaje media guardado en Supabase');
                } catch (dbError) {
                    console.error(`⚠️ Error guardando mensaje media en Supabase: ${dbError.message}`);
                }
                
                return true;
            } else {
                console.error(`Error: Código de respuesta ${response.status}`);
                return false;
            }
        } catch (apiError) {
    console.error(`Error en solicitud de media a GupShup:`, apiError.message);
            
            if (apiError.response) {
                console.error(`- Status: ${apiError.response.status}`);
                console.error(`- Datos: `, JSON.stringify(apiError.response.data, null, 2));
                console.error(`- Headers: `, JSON.stringify(apiError.response.headers, null, 2));
            } else if (apiError.request) {
                console.error(`- No hubo respuesta del servidor`);
            } else {
                console.error(`- Error al configurar la solicitud:`, apiError.message);
            }
            
            // Intentar enviando como texto con el link
            console.log('⚠️ Fallback: Intentando enviar el enlace de la imagen como texto');
            await sendWhatsAppResponse(recipient, `No se pudo enviar la imagen directamente. Aquí está el enlace: ${mediaUrl}\n\n${caption || ''}`);
            
            return false;
        }
    } catch (error) {
    console.error(`Error general en sendMediaMessage:`, error.message);
        console.error(error.stack);
        
        // Intentar enviando como texto con el link
        console.log('⚠️ Fallback: Enviando enlace como texto después de error general');
        await sendWhatsAppResponse(recipient, `No se pudo enviar la imagen. Aquí está el enlace: ${mediaUrl}\n\n${caption || ''}`);
        
        return false;
    }
}

// Función para manejar mensajes con imágenes
async function handleMediaMessage(req, res) {
    try {
        console.log('⚙️ Procesando webhook de imagen en WhatsApp');
        
        // Extraer datos del cuerpo del mensaje
        const webhookData = req.body;
        console.log('📦 Datos del webhook:', JSON.stringify(webhookData, null, 2));
        
        if (!webhookData || !webhookData.payload) {
            console.error('❌ Estructura de webhook no válida');
            return res.status(400).json({ error: 'Estructura de webhook no válida' });
        }
        
        // Extraer información del payload
        const { payload } = webhookData;
        const { sender, type } = payload;
        
        if (!sender || !sender.phone) {
            console.error('❌ No se encontró información del remitente');
            return res.status(400).json({ error: 'No se encontró información del remitente' });
        }
        
        // Obtener el número de teléfono del remitente
        const senderPhone = sender.phone;
        console.log(`📱 Número del remitente: ${senderPhone}`);
        
        // Guardar mensaje en la base de datos si es un mensaje de tipo imagen
        if (type === 'image' && payload.payload && payload.payload.url) {
            try {
                const imageUrl = payload.payload.url;
                const caption = payload.payload.caption || '';
                
                console.log(`🖼️ URL de la imagen recibida: ${imageUrl}`);
                console.log(`📝 Caption: ${caption}`);
                
                // Registramos el mensaje en la base de datos
                await global.registerMessage(
                    senderPhone,
                    caption || 'Imagen recibida',
                    BUSINESS_ID,
                    'customer',
                    imageUrl  // Incluimos la URL de la imagen
                );
                
                console.log('✅ Mensaje con imagen guardado en Supabase');
                
                // Respondemos al webhook
                res.status(200).json({ success: true });
                
                // Enviar a la API de procesamiento
                await processImage(senderPhone, imageUrl, caption);
                
                return;
            } catch (error) {
                console.error('❌ Error procesando imagen:', error.message);
                return res.status(500).json({ error: 'Error procesando imagen' });
            }
        } else {
            console.log('⚠️ No es un mensaje de tipo imagen o falta URL');
            return res.status(400).json({ error: 'No es un mensaje de imagen o falta URL' });
        }
    } catch (error) {
        console.error('❌ Error general en handleMediaMessage:', error.message);
        console.error(error.stack);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Función para procesar imágenes recibidas
async function processImage(senderPhone, imageUrl, caption = '') {
    try {
        console.log(`🔄 Procesando imagen de ${senderPhone}: ${imageUrl}`);
        
        // Aquí puedes implementar lógica para procesar la imagen
        // Por ejemplo, enviarla a un servicio de IA para análisis
        
        // Por ahora, simplemente enviamos un mensaje de confirmación
        await sendWhatsAppResponse(
            senderPhone,
            `✅ Hemos recibido tu imagen. La estamos procesando...`
        );
        
        // Simular respuesta después de "procesar" la imagen
        setTimeout(async () => {
            await sendWhatsAppResponse(
                senderPhone,
                `📸 Imagen procesada correctamente.\n${caption ? `Tu mensaje: "${caption}"` : ''}`
            );
        }, 2000);
        
        return true;
    } catch (error) {
        console.error('❌ Error en processImage:', error.message);
        
        // Intentar enviar mensaje de error al usuario
        try {
            await sendWhatsAppResponse(
                senderPhone,
                "❌ Lo sentimos, hubo un problema al procesar tu imagen. Por favor, intenta nuevamente más tarde."
            );
        } catch (sendError) {
            console.error('❌ Error enviando mensaje de error:', sendError.message);
        }
        
        return false;
    }
}

// Extraer datos de mensajes multimedia de WebHook
function extractMediaData(webhookBody) {
    try {
        console.log(`Extrayendo datos de mensaje multimedia`);
        
        if (!webhookBody || !webhookBody.payload) {
            return { error: 'Formato de webhook inválido' };
        }
        
        // Extraer información general
        const { payload } = webhookBody;
        
        // Verificar si es una actualización de estado
        const isStatusUpdate = payload.type === 'status' || 
            payload.type === 'message-event' || 
            (webhookBody.type && webhookBody.type === 'message-event');
        
        if (isStatusUpdate) {
            return { isStatusUpdate: true };
        }
        
        // Extraer datos según el tipo de mensaje
        if (payload.type === 'image') {
            // Extraer datos de la imagen
            const sender = payload.sender && payload.sender.phone;
            const imageUrl = payload.payload && payload.payload.url;
            const caption = payload.payload && payload.payload.caption || '';
            const messageId = payload.messageId || payload.id;
            
            return {
                sender,
                messageId,
                isImage: true,
                imageUrl,
                caption,
                message: caption || 'Imagen recibida'
            };
        } else {
            // Para otros tipos, usar el extractor normal
            return extractMessageData(webhookBody);
        }
    } catch (error) {
    console.error(`Error extrayendo datos multimedia: ${error.message}`);
        return { error: error.message };
    }
}

// Función para manejar mensajes entrantes de texto
async function handleIncomingMessage(req, res) {
    try {
        const body = req.body;
        console.log(`📩 Mensaje recibido en webhook: ${JSON.stringify(body).substring(0, 500)}...`);
        
        // Extraer datos del mensaje
        const messageData = extractMessageData(body);
        
        // Si es una actualización de estado, solo registrarla
        if (messageData.isStatusUpdate) {
            console.log(`📊 Notificación de estado recibida, no requiere respuesta`);
            console.log(`📊 Procesada notificación de estado`);
            return res.sendStatus(200);
        }
        
        const { sender, message, messageId } = messageData;
        
        if (!sender || !message) {
            console.log(`⚠️ Mensaje incompleto recibido, ignorando: ${JSON.stringify(messageData)}`);
            return res.sendStatus(200);
        }
        
        console.log(`👤 Mensaje recibido de ${sender}: ${message}`);
        
        // Verificar si este mensaje ya fue procesado recientemente
        const messageKey = `${messageId || sender}_${message}`;
        if (recentlyProcessedMessages.has(messageKey)) {
            console.log(`⚠️ Mensaje duplicado detectado, ignorando: ${messageKey}`);
            return res.sendStatus(200);
        }
        
        // Marcar este mensaje como procesado
        recentlyProcessedMessages.add(messageKey);
        setTimeout(() => recentlyProcessedMessages.delete(messageKey), 60000); // Eliminar después de 1 minuto
        
        // Guardar mensaje en Supabase
        console.log(`💾 Guardando mensaje entrante para ${sender}`);
        let conversationId = null;
        
        try {
            // Verificar si tenemos un ID de conversación mapeado para este número
            if (phoneToConversationMap[sender]) {
                conversationId = phoneToConversationMap[sender];
                console.log(`ID de conversación encontrado en caché: ${conversationId}`);
            }
            
            // Guardar mensaje del usuario en la base de datos usando registerBotResponse
            console.log(`💾 Guardando mensaje de tipo 'user' para: ${sender}`);
            
            const userMessageResult = await global.registerBotResponse(sender, message, BUSINESS_ID, 'user');
    
            if (userMessageResult && userMessageResult.success) {
                console.log('✅ Mensaje guardado en Supabase correctamente');
                
                // Actualizar el ID de conversación con el retornado por la función
                if (userMessageResult.conversationId) {
                conversationId = userMessageResult.conversationId;
                    console.log(`Usando ID de conversación obtenido: ${conversationId}`);
                
                // Actualizar mapeo de conversación
                if (conversationId && sender) {
                    phoneToConversationMap[sender] = conversationId;
                    conversationIdToPhoneMap[conversationId] = sender;
                        console.log(`Mapeo actualizado: ${sender} -> ${conversationId}`);
                    }
                }
            } else {
                console.error(`Error al guardar mensaje en Supabase: ${userMessageResult?.error || 'Error desconocido'}`);
            }
        } catch (supabaseError) {
    console.error(`Error al guardar mensaje en Supabase: ${supabaseError.message}`);
        }
        
        // 🔒 VERIFICACIÓN CRÍTICA: Verificar estado del bot para este remitente
        console.log(`🔒 FORZANDO CONSULTA A BASE DE DATOS para verificar estado actual del bot`);
        let botActive = true;
        
        if (conversationId) {
            // Verificar si el bot está activo para esta conversación
            try {
                const { data: convData, error: convError } = await supabase
                    .from('conversations')
                    .select('is_bot_active')
                    .eq('id', conversationId)
                    .single();
                    
                if (!convError && convData) {
                    botActive = convData.is_bot_active === true;
                    console.log(`🤖 Estado del bot para conversación ${conversationId}: ${botActive ? 'ACTIVO ✅' : 'INACTIVO ❌'}`);
                }
            } catch (error) {
    console.error(`Error al verificar estado del bot: ${error.message}`);
                // Asumir que el bot está activo por defecto
            }
        }
        
        // Procesar mensaje con OpenAI SOLO si el bot está ACTIVO
        if (botActive) {
            console.log(`⚙️ Procesando mensaje de ${sender} con OpenAI: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
            
            try {
                // Procesar con OpenAI y obtener respuesta
                const botResponse = await processMessageWithOpenAI(sender, message, conversationId);
                
                if (botResponse) {
                    console.log(`Respuesta generada por OpenAI: "${botResponse.substring(0, 50)}${botResponse.length > 50 ? '...' : ''}"`);
                    
                    // Verificar si la respuesta del bot contiene frases que requieren notificación
                    console.log(`🔔 ANALIZANDO RESPUESTA DEL BOT PARA DETECTAR FRASES DE NOTIFICACIÓN:`);
                    const requiresNotification = checkForNotificationPhrases(botResponse);
                    
                    if (requiresNotification) {
                        console.log(`🔔 DETECTADA FRASE QUE REQUIERE NOTIFICACIÓN en respuesta del bot`);
                        console.log(`Iniciando envío de notificación para conversación ${conversationId}`);
                        
                        // Enviar notificación
                        const notificationSent = await sendBusinessNotification(conversationId, botResponse, sender);
                        if (notificationSent) {
                            console.log(`Notificación enviada exitosamente`);
                        } else {
                            console.error(`Error al enviar notificación`);
                        }
                    } else {
                        console.log(`ℹ️ La respuesta del bot no contiene frases que requieran notificación`);
                    }
                    
                    // Guardar respuesta del bot en Supabase usando el ID de conversación correcto
                    if (conversationId) {
                        console.log(`💾 Guardando respuesta del bot en conversación ${conversationId}`);
                        
                        try {
                            const botMessageResult = await global.registerBotResponse(conversationId, botResponse, BUSINESS_ID, 'bot');
                            
                            if (botMessageResult && botMessageResult.success) {
                                console.log(`Respuesta del bot guardada correctamente con ID: ${botMessageResult.messageId || 'desconocido'}`);
                            } else {
                                console.error(`Error al guardar respuesta del bot: ${botMessageResult?.error || 'Error desconocido'}`);
                            }
                        } catch (saveError) {
    console.error(`Error al guardar respuesta del bot: ${saveError.message}`);
                        }
                    } else {
                        console.error(`No hay ID de conversación para guardar la respuesta del bot`);
                    }
                    
                    // Enviar respuesta a WhatsApp
                    const sendResult = await sendWhatsAppResponse(sender, botResponse);
                    
                    if (sendResult) {
                        console.log(`Respuesta enviada exitosamente a WhatsApp para ${sender}`);
                    } else {
                        console.log(`⚠️ No se pudo enviar la respuesta a WhatsApp, pero sí se guardó en la base de datos`);
                    }
                } else {
                    console.log(`⚠️ OpenAI no generó respuesta para el mensaje de ${sender}`);
                }
            } catch (error) {
    console.error(`Error al procesar mensaje con OpenAI:`, error);
                // Continuar con el flujo normal
            }
        } else {
            console.log(`🔒 Bot inactivo para esta conversación, no se generará respuesta automática`);
        }
        
        // Responder inmediatamente al webhook
        res.sendStatus(200);
    } catch (error) {
    console.error(`Error en handleIncomingMessage:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Ruta para enviar imágenes a través de WhatsApp desde el dashboard
app.post('/send-media', async (req, res) => {
    try {
        console.log('📸 Solicitud recibida para enviar imagen por WhatsApp');
        
        // Validar los datos de entrada
        const { phoneNumber, mediaUrl, caption, businessId } = req.body;
        
        if (!phoneNumber || !mediaUrl) {
            console.error('❌ Faltan datos requeridos para enviar media');
            return res.status(400).json({ 
                success: false, 
                error: 'Se requieren phoneNumber y mediaUrl' 
            });
        }
        
        console.log(`Enviando imagen a ${phoneNumber}. URL: ${mediaUrl}`);
        
        // Verificar el ID de negocio
        if (businessId && businessId !== BUSINESS_ID) {
            console.warn(`⚠️ ID de negocio no coincide: recibido ${businessId}, esperado ${BUSINESS_ID}`);
            // Continuamos de todas formas
        }
        
        // Enviar la imagen a WhatsApp
        const result = await sendMediaMessage(phoneNumber, mediaUrl, caption || '');
        
        if (result) {
            console.log('✅ Imagen enviada exitosamente por WhatsApp');
            return res.status(200).json({ 
                success: true, 
                message: 'Imagen enviada correctamente' 
            });
        } else {
            console.error('❌ Error al enviar la imagen por WhatsApp');
            return res.status(500).json({ 
                success: false, 
                error: 'Error al enviar la imagen por WhatsApp' 
            });
        }
    } catch (error) {
        console.error('❌ Error en la ruta /send-media:', error.message);
        console.error(error.stack);
        
        return res.status(500).json({ 
            success: false, 
            error: 'Error interno del servidor' 
        });
    }
});
// Funciones eliminadas debido a errores de sintaxis
// Función sendBusinessNotification
async function sendBusinessNotification(conversationId, botMessage, clientPhoneNumber) {
  try {
    console.log('Iniciando notificación por correo...');
    return true;
    } catch (error) {
    console.error('Error en notificación:', error);
    return false;
  }
}

// Test endpoint for notification detection
app.get('/test-notification-detection', (req, res) => {
  try {
    // Construir un mensaje de prueba
    const testBody = {
      app: "IPPBX",
      timestamp: Date.now(),
      type: "notification",
      payload: {
        type: "incoming",
        destination: "1588XXXXXXX",
        source: "15557033313",
        text: "Este es un mensaje de prueba de detección de notificaciones desde el servidor",
        notification_type: "test"
      }
    };
    
    // Procesar como si fuera un webhook
    const result = processWebhookData(testBody);
    
    res.status(200).json({
      success: true,
      message: "Prueba de detección de notificación ejecutada",
      result: result
    });
  } catch (error) {
    console.error("Error en prueba de notificación:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// ... existing code ...
// Línea aproximadamente 372
global.__openaiCache = {};
global.logMessage = function(message) {
  console.log(message);
};
// ... existing code ...

// Iniciar el servidor
function startServer(port) {
  const serverPort = port || PORT;
  
  try {
    console.log(`🚀 Intentando iniciar el servidor en puerto ${serverPort}...`);
    
    const server = app.listen(serverPort, () => {
      // En entorno de producción, mostrar un mensaje adecuado
      if (process.env.NODE_ENV === 'production' || process.env.RENDER === 'true') {
        console.log(`✅ Servidor WhatsApp Bot iniciado en puerto ${serverPort}`);
        console.log(`🌐 Ambiente de producción detectado en Render`);
      } else {
        console.log(`✅ Servidor WhatsApp Bot iniciado en http://localhost:${serverPort}`);
      }
      
      console.log(`📡 Endpoints disponibles:`);
      console.log(` - /status: Estado del servidor`);
      console.log(` - /diagnostico: Diagnóstico del sistema`);
      console.log(` - /api/send-manual-message: Envío manual de mensajes`);
      console.log(` - /test-message: Endpoint de prueba para mensajes`);
      console.log(` - /test-notification: Endpoint para probar notificaciones`);
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Error: Puerto ${serverPort} ya está en uso`);
        
        // Intentar con un puerto alternativo
        const alternativePort = parseInt(serverPort) + 1000;
        console.log(`🔄 Intentando con puerto alternativo: ${alternativePort}`);
        
        // Llamada recursiva con el nuevo puerto
        startServer(alternativePort);
      } else {
        console.error(`❌ Error fatal al iniciar servidor: ${err.message}`);
        console.error(err.stack);
        
        // En producción, registrar el error y intentar una vez más
        if (process.env.NODE_ENV === 'production' || process.env.RENDER === 'true') {
          const fallbackPort = 8080;
          console.log(`🆘 Último intento con puerto de emergencia: ${fallbackPort}`);
          
          try {
            app.listen(fallbackPort, () => {
              console.log(`✅ [RECUPERACIÓN] Servidor iniciado en puerto de emergencia ${fallbackPort}`);
            }).on('error', (finalError) => {
              console.error(`💥 Error fatal en intento de recuperación: ${finalError.message}`);
              process.exit(1); // Terminar si falla el último intento
            });
          } catch (finalError) {
            console.error(`💥 Error catastrófico: ${finalError.message}`);
            process.exit(1);
          }
        }
      }
    });
    
    return server;
  } catch (err) {
    console.error(`❌ Error inesperado al iniciar servidor: ${err.message}`);
    console.error(err.stack);
    
    // En producción, intentar una vez más
    if (process.env.NODE_ENV === 'production' || process.env.RENDER === 'true') {
      const emergencyPort = 9090;
      console.log(`🚨 Intento de emergencia en puerto: ${emergencyPort}`);
      
      try {
        return app.listen(emergencyPort, () => {
          console.log(`✅ [RECUPERACIÓN DE EMERGENCIA] Servidor iniciado en puerto ${emergencyPort}`);
        });
      } catch (emergencyError) {
        console.error(`💥 Error en recuperación de emergencia: ${emergencyError.message}`);
        process.exit(1);
      }
    }
  }
}

// Verificar si el servidor ya está escuchando en el puerto para evitar EADDRINUSE
let serverAlreadyStarted = false;

function startServerSafely(port) {
  if (serverAlreadyStarted) {
    console.log(`🔍 Servidor ya iniciado, evitando múltiples inicios en puerto ${port}`);
    return;
  }

  console.log(`🚀 Iniciando servidor en puerto ${port} (primera vez)`);
  try {
    serverAlreadyStarted = true;
    startServer(port);
  } catch (error) {
    console.error(`❌ Error al iniciar servidor: ${error.message}`);
    serverAlreadyStarted = false;
  }
}

// En Render, es posible que el servidor ya esté ejecutándose por el script render-start.js
// Verificamos esto para evitar iniciar el servidor dos veces
if (process.env.RENDER === 'true') {
  console.log('🔍 Ambiente Render detectado, verificando si el servidor ya está iniciado...');
  const http = require('http');
  const testServer = http.createServer();
  
  testServer.once('error', () => {
    console.log(`⚠️ Puerto ${PORT} ya está en uso, probablemente el servidor ya está iniciado`);
    console.log('✅ Evitando iniciar el servidor nuevamente para prevenir error EADDRINUSE');
  });
  
  testServer.once('listening', () => {
    console.log(`✅ Puerto ${PORT} disponible, iniciando servidor normalmente`);
    testServer.close(() => {
      startServerSafely(PORT);
    });
  });
  
  testServer.listen(PORT);
} else {
  // En desarrollo, iniciar normalmente
  startServerSafely(PORT);
}
