// Primero, cargar las variables de entorno (para que surtan efecto desde el inicio)
require('dotenv').config();

// SOLUCIÓN DEFINITIVA: Forzar URL en Render
// Detectar ambiente Render
const RENDER_ENV = process.env.RENDER === 'true' || process.env.RENDER_EXTERNAL_URL !== undefined;
const PROD_ENV = process.env.NODE_ENV === 'production';

// En Render, siempre usar la URL correcta (antes de cualquier otro código)
if (RENDER_ENV || PROD_ENV) {
  const correctUrl = 'https://whatsapp-bot-if6z.onrender.com/api/register-bot-response';
  process.env.CONTROL_PANEL_URL = correctUrl;
  console.log(`🛠️ CONFIGURACIÓN TEMPRANA: URL forzada a ${correctUrl}`);
  
  // Guardar también variables para Supabase para asegurar que estén disponibles
  if (!process.env.SUPABASE_KEY && process.env.SUPABASE_ANON_KEY) {
    process.env.SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
    console.log('🔑 CONFIGURACIÓN TEMPRANA: Copiando SUPABASE_ANON_KEY a SUPABASE_KEY');
  }
}

// Cargar el parche global que define registerBotResponse
require('./global-patch');

// Importaciones principales
const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const OpenAI = require('openai');

// Importar Supabase
const { createClient } = require('@supabase/supabase-js');

// Variables globales para el servidor
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co';
// const SUPABASE_API_KEY = process.env.SUPABASE_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTgwOTkxNzYsImV4cCI6MjAxMzY3NTE3Nn0.B_LQ2_2jUIZ1PvR1_ObQ-8fmVOaOY0jXkYa9KGbU9N0';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID || 'asst_l8fFxu1rBjkZGNWZ0PSLZ73Q';
const PORT = process.env.PORT || 3010;
let CONTROL_PANEL_URL = process.env.CONTROL_PANEL_URL || 'http://localhost:3000/api/register-bot-response';
const BUSINESS_ID = process.env.BUSINESS_ID || '2d385aa5-40e0-4ec9-9360-19281bc605e4';
const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
const GUPSHUP_NUMBER = process.env.GUPSHUP_NUMBER;
const GUPSHUP_USERID = process.env.GUPSHUP_USERID;

// Inicializar OpenAI
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

// Verificar el formato de la API Key
if (OPENAI_API_KEY && OPENAI_API_KEY.startsWith('sk-proj-')) {
    console.warn('⚠️ ADVERTENCIA: El formato de la API Key de OpenAI parece incorrecto. Debería comenzar con "sk-" y no "sk-proj-"');
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
const conversationToPhoneMap = {};

// Caché del estado del bot por remitente
const senderBotStatusMap = {};

// Cache para evitar procesar mensajes duplicados (por ID + contenido)
const processedMessages = {};

// Set para almacenar mensajes procesados recientemente (evitar duplicados)
const recentlyProcessedMessages = new Set();

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
        conversationToPhoneMap[conv.id] = conv.user_id;
      }
    });
    
    console.log(`✅ Mapeos actualizados: ${Object.keys(phoneToConversationMap).length} números mapeados`);
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
  console.log(`✅ URL configurada para Render: ${CONTROL_PANEL_URL}`);
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
  origin: ['http://localhost:3000', 'http://localhost:3001', 'https://whatsapp-mern-front.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));

// Middleware para opciones preflight
app.options('*', cors(corsOptions));

// Middleware para logs detallados
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

// 🗂 Almacena el historial de threads de usuarios
const userThreads = {};

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

const supabase = createClient(supabaseUrl, supabaseKey);

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
                    conversationToPhoneMap[existingConversationId] = sender;
                    
                    // Actualizar estado en caché
                    senderBotStatusMap[sender] = false;
                    
                    console.log(`✅ Nueva conversación creada: ${existingConversationId} para ${sender} (bot inactivo por defecto)`);
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
async function registerBotResponse(conversationId, message, business_id = BUSINESS_ID, sender_type = 'bot') {
  try {
    if (!conversationId || !message) {
      console.error('❌ Faltan parámetros para registrar respuesta');
      return { success: false, error: 'Faltan parámetros' };
    }
    
    // Logs detallados para depurar
    console.log('🔄 Llamada a global.registerBotResponse interceptada');
    console.log(`📤 Guardando mensaje de tipo '${sender_type}' para: ${conversationId}`);
    console.log(`🚀 Procesando mensaje para: ${conversationId}`);
    console.log(`📝 Mensaje: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    
    // 1. Buscar la conversación en la base de datos
    console.log(`🔍 Buscando conversación para: ${conversationId}`);
    let conversationRecord;
    
    // Este ID es a menudo un número telefónico, verificar formato
    const isPhoneNumber = /^\+?\d+$/.test(conversationId.toString().trim());
    
    try {
      // Primero buscar por ID exacto (UUID)
      const { data: convById } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();
      
      if (convById) {
        console.log(`✅ Conversación encontrada directamente por ID`);
        conversationRecord = convById;
      } 
      // Si no se encuentra por ID exacto y parece ser un número telefónico
      else if (isPhoneNumber) {
        // Normalizar para búsqueda (sin el + inicial)
        const normalizedPhone = conversationId.toString().replace(/^\+/, '');
        
        // Buscar por usuario (número de teléfono)
        const { data: convByPhone } = await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', normalizedPhone)
          .eq('business_id', business_id)
          .single();
        
        if (convByPhone) {
          console.log(`✅ Conversación encontrada por teléfono: ${normalizedPhone}`);
          conversationRecord = convByPhone;
        }
      }
    } catch (err) {
      console.log(`⚠️ Error o no encontrada en búsqueda exacta: ${err.message}`);
    }
    
    // Si no se encuentra la conversación, crear un nuevo registro
    if (!conversationRecord) {
      // Determinar si el ID parece un UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId);
      
      if (isUUID) {
        console.log(`⚠️ No se encontró la conversación con ID: ${conversationId}`);
        return { success: false, error: 'Conversación no encontrada' };
      }
      
      // Si parece un número telefónico, crear la conversación
      if (isPhoneNumber) {
        const normalizedPhone = conversationId.toString().replace(/^\+/, '');
        console.log(`🆕 Creando nueva conversación para ${normalizedPhone}`);
        
        try {
          const { data: newConversation, error } = await supabase
            .from('conversations')
            .insert({
              user_id: normalizedPhone,
              business_id: business_id,
              last_message: message.substring(0, 100),
              is_bot_active: true // Por defecto activado
            })
            .select()
            .single();
          
          if (error) {
            console.error(`❌ Error al crear conversación: ${error.message}`);
        return { success: false, error: error.message };
          }
          
          console.log(`✅ Nueva conversación creada con ID: ${newConversation.id}`);
          conversationRecord = newConversation;
        } catch (err) {
          console.error(`❌ Error al crear la conversación: ${err.message}`);
          return { success: false, error: err.message };
        }
      }
    }
    
    // Si aún no tenemos conversación, salir con error
    if (!conversationRecord) {
      console.error('❌ No se pudo encontrar ni crear la conversación');
      return { success: false, error: 'No se pudo encontrar ni crear la conversación' };
    }
    
    console.log(`ℹ️ Usando conversación existente con ID: ${conversationRecord.id}`);
    
    // Verificar si el bot está activo, para mensajes de tipo 'bot'
    if (sender_type === 'bot' && conversationRecord.is_bot_active === false) {
      console.log(`🤖 Bot desactivado para conversación ${conversationRecord.id}, no se enviará respuesta automática`);
      return { 
        success: true, 
        id: null, 
        message: 'Bot desactivado, no se procesó respuesta automática',
        conversationId: conversationRecord.id
      };
    }
    
    // 2. Guardar el mensaje en Supabase
    console.log(`🔄 Guardando mensaje en Supabase...`);
    console.log(`📤 Tipo de mensaje: ${sender_type}`);
    
    let messageRecord;
    try {
      // Intentar usando el cliente Supabase primero
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationRecord.id,
          content: message,
          sender_type: sender_type
        })
        .select()
        .single();
        
      if (error) {
        console.warn(`⚠️ Error guardando mensaje con cliente, usando API REST: ${error.message}`);
        throw error; // Para caer en el catch y usar la alternativa
      }
      
      messageRecord = data;
      console.log(`✅ Mensaje guardado en Supabase con ID: ${messageRecord.id}`);
    } catch (supabaseError) {
      // Alternativa: usar el servicio REST del panel para guardar el mensaje
      console.error(`❌ Error al guardar mensaje en Supabase: ${supabaseError.message}`);
      console.error(`  Status: ${supabaseError.status || 'N/A'}`);
      console.error(`  Data: ${JSON.stringify(supabaseError.data || {})}`);
      
      console.error(`❌ Error guardando en Supabase, intentando con el servidor: ${supabaseError.message}`);
      
      try {
        // Intentar usando la API del panel
        const serverResponse = await axios.post(
          CONTROL_PANEL_URL,
          {
            conversationId: conversationRecord.id,
            content: message,
            senderType: sender_type,
            businessId: business_id
          },
          {
            headers: { 'Content-Type': 'application/json' }
          }
        );
        
        console.log(`✅ Mensaje enviado correctamente al servidor: ${serverResponse.status}`);
        messageRecord = serverResponse.data;
      } catch (serverError) {
        console.error(`❌ Error al guardar el mensaje en el servidor: ${serverError.message}`);
        return { success: false, error: serverError.message };
      }
    }
    
    // 3. Actualizar la última actividad de la conversación
    try {
      await updateConversationLastActivity(conversationRecord.id, message);
      console.log(`✅ Última actividad de conversación actualizada`);
    } catch (updateError) {
      console.warn(`⚠️ Error al actualizar actividad de conversación: ${updateError.message}`);
      // No fallar por esto, ya tenemos el mensaje guardado
    }
    
    // 4. Devolver resultado exitoso
    return { 
      success: true, 
      id: messageRecord?.id, 
      message: 'Mensaje guardado correctamente',
      conversationId: conversationRecord.id
    };
  } catch (error) {
    console.error(`❌ Error general en registerBotResponse: ${error.message}`);
    return { success: false, error: error.message };
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
      console.log(`✅ Estados de bot cargados para ${Object.keys(senderBotStatusMap).length} conversaciones`);
    } else if (error) {
      console.warn('⚠️ Error al cargar estados iniciales de bots:', error.message);
    }
  } catch (e) {
    console.error('❌ Error en inicialización de mapeos:', e.message);
  }
});

// Punto de entrada para webhooks de WhatsApp
app.post('/webhook', async (req, res) => {
    try {
        if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
            console.log('⚙️ Verificación de webhook exitosa');
            return res.status(200).send(req.query['hub.challenge']);
        }
    
        // Los webhooks de WhatsApp Business API pueden ser de diferentes tipos
        const { isStatusUpdate, sender, message, messageId, timestamp } = extractMessageData(req.body);
    
    if (isStatusUpdate) {
            // No procesar actualizaciones de estado
            console.log('📊 Notificación de estado recibida, no requiere respuesta');
      console.log('📊 Procesada notificación de estado');
            return res.sendStatus(200);
        }
        
        if (!sender || !message) {
            console.warn('⚠️ Webhook sin mensaje o remitente válido');
            return res.sendStatus(200);
        }
        
        // Verificar si es un mensaje duplicado
        if (messageId && recentlyProcessedMessages.has(messageId)) {
            console.log(`🔁 Mensaje duplicado detectado: ${messageId}`);
            return res.sendStatus(200);
        }
        
        // Agregar a mensajes procesados recientemente
        if (messageId) {
            recentlyProcessedMessages.add(messageId);
            
            // Limpiar mensajes antiguos para evitar crecimiento excesivo
            setTimeout(() => {
                recentlyProcessedMessages.delete(messageId);
            }, 60000); // Eliminar después de 1 minuto
        }
        
        console.log(`👤 Mensaje recibido de ${sender}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
        
        // IMPORTANTE: Siempre consultar el estado actual en la base de datos, ignorando la caché
        console.log('🔒 FORZANDO CONSULTA A BASE DE DATOS para verificar estado actual del bot');
        const { data: conversationData, error: conversationError } = await supabase
            .from('conversations')
            .select('id, is_bot_active')
            .eq('user_id', sender)
            .eq('business_id', BUSINESS_ID);
        
        let conversationId = null;
        let isBotActive = false;
        
        if (conversationError) {
            console.error('❌ Error al verificar la conversación:', conversationError);
        } else if (conversationData && conversationData.length > 0) {
            conversationId = conversationData[0].id;
            isBotActive = conversationData[0].is_bot_active === true; // Comparación estricta con true
            console.log(`ℹ️ ESTADO DIRECTO DB: Bot ${isBotActive ? 'ACTIVO ✅' : 'INACTIVO ⛔'} para la conversación ${conversationId} (número ${sender})`);
            
            // Actualizar caché para futuras referencias
            senderBotStatusMap[sender] = isBotActive;
            console.log(`📝 Caché actualizada: senderBotStatusMap[${sender}] = ${isBotActive}`);
        } else {
            // No existe la conversación, la creamos
            // IMPORTANTE: Por defecto, crear conversaciones con bot inactivo para seguridad
            const { data: newConversation, error: createError } = await supabase
                .from('conversations')
                .insert([
                    {
                        user_id: sender,
                        business_id: BUSINESS_ID,
                        is_bot_active: false, // Crear con bot inactivo por defecto
                        sender_name: sender
                    }
                ])
                .select();
                
            if (createError) {
                console.error('❌ Error al crear la conversación:', createError);
            } else if (newConversation && newConversation.length > 0) {
                conversationId = newConversation[0].id;
                isBotActive = newConversation[0].is_bot_active === true; // Siempre será false aquí
                console.log(`✅ Nueva conversación creada: ${conversationId} para ${sender} (bot inactivo por defecto)`);
                
                // Actualizar mapeo
                phoneToConversationMap[sender] = conversationId;
                conversationToPhoneMap[conversationId] = sender;
                
                // Actualizar caché de estado
                senderBotStatusMap[sender] = isBotActive;
                console.log(`📝 Caché actualizada para nuevo usuario: senderBotStatusMap[${sender}] = ${isBotActive}`);
            }
        }
        
        // VERIFICACIÓN ADICIONAL - Imprimir el estado actual
        console.log(`🔐 VERIFICACIÓN FINAL antes de procesar: Bot para ${sender} está ${isBotActive ? 'ACTIVO ✅' : 'INACTIVO ⛔'}`);
        
        // GUARDAR EL MENSAJE SIEMPRE
        console.log(`💾 Guardando mensaje entrante para ${sender}`);
        await saveMessageToSupabase({
            sender,
            message,
            messageId,
            timestamp,
            conversationId,
            isBotActive
        });
        
        // ⚠️ VERIFICACIÓN EXTRA DE SEGURIDAD: Volver a verificar el estado actual en la DB
        // Esto es para asegurar que realmente el bot no esté activo
        if (conversationId) {
            try {
                console.log(`🔒 VERIFICACIÓN DEFINITIVA: Consultando nuevamente el estado del bot para ${conversationId}`);
                const { data: finalCheck, error: finalError } = await supabase
                    .from('conversations')
                    .select('is_bot_active')
                    .eq('id', conversationId)
                    .single();
                
                if (!finalError && finalCheck) {
                    const finalBotStatus = finalCheck.is_bot_active === true;
                    console.log(`✅ VERIFICACIÓN DEFINITIVA: Estado del bot es ${finalBotStatus ? 'ACTIVO ✅' : 'INACTIVO ⛔'}`);
                    
                    // Usar el estado más reciente para la decisión final
                    isBotActive = finalBotStatus;
                    
                    // Actualizar caché con el valor definitivo
                    senderBotStatusMap[sender] = finalBotStatus;
                    console.log(`📝 Caché FINAL actualizada: senderBotStatusMap[${sender}] = ${finalBotStatus}`);
                }
            } catch (finalCheckError) {
                console.error('❌ Error en verificación final:', finalCheckError);
                // En caso de error, NO procesar - asumir bot inactivo por seguridad
                isBotActive = false;
            }
        }
        
        // Procesar mensaje con OpenAI SOLO si el bot está ACTIVO
        if (isBotActive === true) {
            console.log(`⚙️ Procesando mensaje de ${sender} con OpenAI: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
            // No esperamos a que termine el procesamiento
            processMessageWithOpenAI(sender, message, conversationId)
                .catch(err => console.error('❌ Error procesando mensaje con OpenAI:', err));
      } else {
            console.log(`🛑 Bot INACTIVO: NO se procesa mensaje de ${sender} con OpenAI ni se envía respuesta automática`);
        }
        
        // Responder inmediatamente al webhook
        res.sendStatus(200);
    } catch (error) {
        console.error('❌ Error en webhook:', error);
        res.sendStatus(200); // Siempre responder OK a WhatsApp
    }
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
    
    console.log(`📤 Enviando mensaje a conversación ${normalizedId}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
    
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
        if (conversationToPhoneMap[normalizedId]) {
          phoneNumber = conversationToPhoneMap[normalizedId];
          console.log(`✅ Número encontrado en caché para conversación: ${phoneNumber}`);
        } else {
          // Buscar en base de datos
          try {
            const { data, error } = await supabase
              .from('conversations')
              .select('user_id')
              .eq('id', normalizedId)
              .single();
            
            if (error) {
              console.error(`❌ Error buscando número para conversación: ${error.message}`);
              throw new Error(`No se pudo obtener el número de teléfono: ${error.message}`);
            }
            
            if (data && data.user_id) {
              phoneNumber = data.user_id;
              console.log(`✅ Número encontrado en DB para conversación: ${phoneNumber}`);
              
              // Actualizar caché
              conversationToPhoneMap[normalizedId] = phoneNumber;
              phoneToConversationMap[phoneNumber] = normalizedId;
            } else {
              console.error(`❌ No se encontró un número de teléfono para la conversación ${normalizedId}`);
              throw new Error('No se encontró un número de teléfono asociado a esta conversación');
            }
          } catch (dbError) {
            console.error(`❌ Error al buscar número en DB: ${dbError.message}`);
            throw dbError;
          }
        }
      }
      
      // Verificar que tenemos un número válido
      if (!phoneNumber || !/^\d+$/.test(phoneNumber.toString().replace(/^\+/, ''))) {
        console.error(`❌ Número de teléfono inválido: ${phoneNumber}`);
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
        'apikey': GUPSHUP_API_KEY
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
          console.error(`❌ Error en la respuesta de GupShup: ${response.status}`);
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
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    const conversations = response.data;
    console.log(`✅ Se encontraron ${conversations.length} conversaciones para el negocio ${businessId}`);
    
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
    console.log(`🔍 Solicitando mensajes para conversación: ${conversationId}`);
    
    if (!conversationId) {
      return res.status(400).json({ error: 'Se requiere ID de conversación' });
    }
    
    // Cargar directamente la configuración de Supabase para asegurar que siempre use valores correctos
    const supabaseConfig = require('./supabase-config');
    const supabaseUrl = process.env.SUPABASE_URL || supabaseConfig.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || supabaseConfig.SUPABASE_KEY;
    
    // Construir la URL para consultar los mensajes
    const url = `${supabaseUrl}/rest/v1/messages?conversation_id=eq.${conversationId}&order=created_at.asc`;
    
    // Realizar la consulta a Supabase
    const response = await axios.get(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    const messages = response.data;
    console.log(`✅ Encontrados ${messages.length} mensajes para la conversación ${conversationId}`);
    
    return res.status(200).json(messages);
  } catch (error) {
    console.error('❌ Error al obtener mensajes:', error.message);
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', error.response.data);
    }
    return res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

// Endpoint para activar/desactivar el bot para una conversación específica (acepta PUT y POST)
app.put('/api/conversations/:id/toggle-bot', handleToggleBot);
app.post('/api/conversations/:id/toggle-bot', handleToggleBot);

// Función de manejo para toggle-bot
async function handleToggleBot(req, res) {
  try {
    const { id } = req.params;
    const { active } = req.body;
    
    if (active === undefined) {
      return res.status(400).json({ error: 'Se requiere el parámetro active' });
    }
    
    console.log(`🤖 ${active ? 'Activando' : 'Desactivando'} bot para conversación: ${id}`);
    
    // Verificar si es una conversación UUID o un número telefónico
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let phoneNumber = null;
    
    // Si es un UUID, buscar el número telefónico asociado primero
    if (isUUID) {
      // Verificar primero en caché
      if (conversationToPhoneMap[id]) {
        phoneNumber = conversationToPhoneMap[id];
        console.log(`📱 Número encontrado en caché para conversación ${id}: ${phoneNumber}`);
      } else {
        // Buscar en la base de datos
        const { data: userData, error: userError } = await supabase
          .from('conversations')
          .select('user_id')
          .eq('id', id)
          .single();
        
        if (!userError && userData && userData.user_id) {
          phoneNumber = userData.user_id;
          console.log(`📱 Número encontrado en DB para conversación ${id}: ${phoneNumber}`);
        }
      }
    } else {
      // El ID proporcionado es probablemente un número de teléfono
      phoneNumber = id;
    }
    
    // Actualizar el estado del bot en la base de datos
    const { data, error } = await supabase
      .from('conversations')
      .update({ 
        is_bot_active: active
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error al actualizar estado del bot:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log(`✅ Estado del bot actualizado en DB: ${active ? 'Activado' : 'Desactivado'}`);
    
    // IMPORTANTE: Actualizar la caché con el nuevo estado del bot
    if (phoneNumber) {
      senderBotStatusMap[phoneNumber] = active === true;
      console.log(`📝 Caché actualizada: senderBotStatusMap[${phoneNumber}] = ${active === true}`);
    }
    
    // Buscar otras conversaciones asociadas al mismo número (si las hay)
    if (phoneNumber) {
      try {
        const { data: otherConvs, error: otherError } = await supabase
          .from('conversations')
          .select('id')
          .eq('user_id', phoneNumber)
          .neq('id', id);
        
        if (!otherError && otherConvs && otherConvs.length > 0) {
          console.log(`🔄 Encontradas ${otherConvs.length} conversaciones adicionales para el mismo número`);
          
          // Actualizar todas las conversaciones con el mismo estado para mantener coherencia
          const { error: updateError } = await supabase
            .from('conversations')
            .update({ is_bot_active: active })
            .eq('user_id', phoneNumber);
          
          if (updateError) {
            console.warn(`⚠️ Error actualizando conversaciones adicionales: ${updateError.message}`);
          } else {
            console.log(`✅ Todas las conversaciones para ${phoneNumber} actualizadas con estado: ${active ? 'Activado' : 'Desactivado'}`);
          }
        }
      } catch (otherError) {
        console.warn(`⚠️ Error al buscar conversaciones adicionales: ${otherError.message}`);
      }
    }
    
    // En lugar de registrar un mensaje de tipo 'system', usar tipo 'bot' que sí está permitido
    const systemMessage = active 
      ? "✅ Bot activado por el operador" 
      : "❌ Bot desactivado por el operador";
    
    try {
      // Guardar mensaje directamente en la base de datos con tipo 'bot' en lugar de 'system'
      const messageData = {
        conversation_id: id,
        content: systemMessage,
        sender_type: 'bot', // Usar 'bot' en lugar de 'system' que no está permitido
        created_at: new Date().toISOString()
      };
      
      const { data: msgData, error: msgError } = await supabase
        .from('messages')
        .insert([messageData])
        .select()
        .single();
        
      if (msgError) {
        console.warn('⚠️ No se pudo registrar mensaje de cambio de estado:', msgError);
        // No bloquear la operación por este error
      } else {
        console.log('✅ Mensaje de cambio de estado registrado:', msgData.id);
      }
    } catch (msgError) {
      console.warn('⚠️ No se pudo registrar mensaje de cambio de estado:', msgError);
      // No bloquear la operación por este error
    }
    
    return res.status(200).json({ 
      success: true, 
      id, 
      is_bot_active: active,
      message: `Bot ${active ? 'activado' : 'desactivado'} correctamente` 
    });
  } catch (error) {
    console.error('❌ Error en toggle-bot:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Función para extraer datos del mensaje de la solicitud de webhook
function extractMessageData(body) {
    try {
        // Detectar notificación de estado (mensaje de confirmación)
        if (body && body.entry && body.entry[0] && body.entry[0].changes && 
            body.entry[0].changes[0] && body.entry[0].changes[0].value && 
            body.entry[0].changes[0].value.statuses) {
          console.log('📊 Notificación de estado recibida, no requiere respuesta');
            return { isStatusUpdate: true };
        }
        
        // Extraer datos de mensajes entrantes de GupShup
        if (body && body.entry && body.entry[0] && body.entry[0].changes && 
            body.entry[0].changes[0] && body.entry[0].changes[0].value && 
            body.entry[0].changes[0].value.messages && 
            body.entry[0].changes[0].value.messages.length > 0) {
            
            const messageObj = body.entry[0].changes[0].value.messages[0];
            
            // Verificar estructura del mensaje
            if (messageObj && messageObj.from && messageObj.text && messageObj.text.body) {
                const sender = messageObj.from;
                const message = messageObj.text.body;
                const messageId = messageObj.id || `temp-${Date.now()}`;
                
                // Formatear timestamp correctamente
                let timestamp;
                if (messageObj.timestamp) {
                    // Verificar si es un número (epoch) o una fecha ISO
                    if (!isNaN(messageObj.timestamp)) {
                        // Convertir timestamp epoch a ISO
                        const timestampNum = parseInt(messageObj.timestamp, 10);
                        // Si tiene 10 dígitos (segundos) o 13 (milisegundos)
                        const date = timestampNum < 10000000000 
                            ? new Date(timestampNum * 1000)
                            : new Date(timestampNum);
                        timestamp = date.toISOString();
                    } else {
                        // Ya es un formato de fecha
                        timestamp = messageObj.timestamp;
                    }
                } else {
                    timestamp = new Date().toISOString();
                }
                
                // Verificar formato válido
                try {
                    new Date(timestamp);
                } catch (e) {
                    console.warn(`⚠️ Timestamp inválido, usando fecha actual: ${timestamp}`);
                    timestamp = new Date().toISOString();
                }
                
                // Conversión importante: Guardar información de mapeo para futura referencia
                if (sender) {
                    // Buscar en caché primero
                    if (!phoneToConversationMap[sender]) {
                        console.log(`🔄 Guardando mapeo: número ${sender} para futura referencia`);
                        
                        // Cargar desde base de datos si no existe en caché
                        try {
                            supabase
                                .from('conversations')
                                .select('id')
                                .eq('user_id', sender)
                                .eq('business_id', BUSINESS_ID)
                                .then(({ data, error }) => {
                                    if (!error && data && data.length > 0) {
                                        const convId = data[0].id;
                                        phoneToConversationMap[sender] = convId;
                                        conversationToPhoneMap[convId] = sender;
                                        console.log(`✅ Mapeo cargado de DB: ${sender} → ${convId}`);
                                    }
                                });
                        } catch (e) {
                            console.warn(`⚠️ Error al cargar mapeo para ${sender}:`, e.message);
                        }
                    }
                }
                
            return {
                    isStatusUpdate: false,
                    sender,
                    message,
                    messageId,
                    timestamp
                };
            } else {
                console.warn('⚠️ Estructura de mensaje inválida en webhook', JSON.stringify(messageObj).substring(0, 100));
            }
        } else if (body && body.payload) {
            // Formato alternativo (legacy o simulación)
            const payload = body.payload;
            const type = payload.type;
            
            if (type === 'text' && payload.payload && payload.payload.text) {
                const sender = payload.sender ? payload.sender.phone : (payload.source || null);
                const message = payload.payload.text;
                const messageId = payload.id || `temp-${Date.now()}`;
                const timestamp = new Date().toISOString();
                
          return { 
            isStatusUpdate: false,
                    sender,
                    message,
                    messageId,
                    timestamp
          };
            } else {
                console.warn(`⚠️ Tipo de mensaje no soportado: ${type}`);
        }
        } else {
            console.warn('⚠️ Webhook con estructura desconocida', JSON.stringify(body).substring(0, 200));
    }
    
        return { isStatusUpdate: false };
  } catch (error) {
        console.error('❌ Error extrayendo datos del mensaje:', error);
        return { isStatusUpdate: false };
    }
}

// Procesar mensaje con OpenAI y generar respuesta
async function processMessageWithOpenAI(sender, message, conversationId) {
    try {
        if (!sender || !message) {
            console.warn('❌ Datos incompletos para procesar mensaje con OpenAI');
            return null;
        }

        console.log(`🔍 VERIFICACIÓN CRÍTICA: Comprobando si el bot debe estar ACTIVO para ${sender}`);
        
        // ⚠️ VERIFICACIÓN INICIAL - Comprobar que NO esté desactivado en caché
        if (sender in senderBotStatusMap && senderBotStatusMap[sender] === false) {
            console.log(`🚫 PROTECCIÓN INICIAL: Bot marcado como INACTIVO en caché para ${sender}, CANCELANDO procesamiento`);
            return null;
        }

        // ⚠️ VERIFICACIÓN EN BASE DE DATOS - Forzar consulta a DB
        let isBotActive = false;
        let actualConversationId = conversationId;
        
        // Si no tenemos ID, intentar buscarlo por número
        if (!actualConversationId) {
            console.log(`🔍 Buscando conversación para ${sender}...`);
            const { data: convById, error: errorById } = await supabase
                .from('conversations')
                .select('id, is_bot_active')
                .eq('user_id', sender)
                .eq('business_id', BUSINESS_ID);
                
            if (errorById) {
                console.error('❌ ERROR CRÍTICO buscando conversación:', errorById);
                return null; // Salir por seguridad
            }
            
            if (convById && convById.length > 0) {
                actualConversationId = convById[0].id;
                isBotActive = convById[0].is_bot_active === true; // Comparación estricta
                console.log(`🔎 Encontrada conversación: ${actualConversationId}, bot_active=${isBotActive}`);
          } else {
                console.warn(`⚠️ No se encontró conversación para ${sender}`);
                return null; // No hay conversación, no procesar
          }
        } else {
            // Tenemos ID, verificamos directamente
            console.log(`🔍 Verificando estado para conversación ${actualConversationId}...`);
            const { data: convData, error: convError } = await supabase
                .from('conversations')
                .select('is_bot_active')
                .eq('id', actualConversationId)
                .single();
                
            if (convError) {
                console.error(`❌ ERROR CRÍTICO verificando estado: ${convError.message}`);
                return null; // Salir por seguridad
            }
            
            if (convData) {
                isBotActive = convData.is_bot_active === true; // Comparación estricta
                console.log(`🔎 Estado de conversación ${actualConversationId}: bot_active=${isBotActive}`);
    } else {
                console.warn(`⚠️ No se encontró la conversación con ID ${actualConversationId}`);
                return null; // No existe, no procesar
            }
        }
        
        // ⚠️ PUNTO DE SALIDA CRÍTICO - Si no está activo, cancelar
        if (!isBotActive) {
            console.log(`🛑 PROTECCIÓN CRÍTICA ACTIVADA: Bot está INACTIVO para ${sender}, CANCELANDO procesamiento`);
            return null;
        }
        
        // 🔄 VERIFICACIÓN FINAL - Una verificación extra adicional de seguridad
        console.log(`🔎 VERIFICACIÓN FINAL: Consultando nuevamente estado para ${actualConversationId}...`);
        const { data: finalCheck, error: finalError } = await supabase
            .from('conversations')
            .select('is_bot_active')
            .eq('id', actualConversationId)
            .single();
            
        if (!finalError && finalCheck) {
            const finalStatus = finalCheck.is_bot_active === true;
            console.log(`🔎 ESTADO FINAL: is_bot_active=${finalStatus}`);
            
            if (!finalStatus) {
                console.log(`🛑 PROTECCIÓN FINAL ACTIVADA: Bot estaba INACTIVO en verificación final, CANCELANDO procesamiento`);
                return null;
            }
        } else if (finalError) {
            console.error(`❌ Error en verificación final: ${finalError.message}`);
            return null; // Salir por seguridad
        }
        
        // ✅ AUTORIZACIÓN CONCEDIDA - El bot está definitivamente activo
        console.log(`✅ VERIFICACIONES COMPLETAS: Bot confirmado como ACTIVO para ${sender}, procediendo con OpenAI`);
        
        // El resto del código existente para procesar con OpenAI
        const { data: historyData, error: historyError } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', actualConversationId)
            .order('created_at', { ascending: true })
            .limit(10);
        
        if (historyError) {
            console.error('❌ Error obteniendo historial:', historyError);
        }
        
        // ... continuar con el código existente
    } catch (error) {
        console.error('❌ Error procesando mensaje con OpenAI:', error);
        return null;
    }
}

// Función para enviar respuestas a WhatsApp
async function sendWhatsAppResponse(recipient, message) {
  try {
    console.log(`📋 INICIO DE FUNCIÓN sendWhatsAppResponse - Recipient: ${recipient}`);
    
    if (!recipient || !message) {
      console.warn('❌ Datos incompletos para enviar respuesta a WhatsApp');
      return false;
    }
    
    if (!GUPSHUP_API_KEY) {
      console.error('❌ API key de GupShup no configurada');
      console.log('GUPSHUP_API_KEY:', GUPSHUP_API_KEY ? 'Presente (oculta)' : 'No configurada');
      return false;
    }
    
    console.log(`📤 Enviando respuesta a ${recipient}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    
    // Verificar si recipient es un UUID en lugar de un número telefónico
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recipient);
    console.log(`🔍 Verificando formato: El destinatario es ${isUUID ? 'un UUID' : 'un número telefónico'}`);
    
    let phoneNumber = recipient;
    if (isUUID) {
      console.log(`🔍 El destinatario parece ser un UUID de conversación: ${recipient}`);
      console.log(`🔍 Buscando número telefónico asociado a conversación ${recipient}...`);
      
      // Primero verificar en caché
      console.log(`🔍 Verificando en caché: ${conversationToPhoneMap[recipient] ? 'Encontrado' : 'No encontrado'}`);
      if (conversationToPhoneMap[recipient]) {
        phoneNumber = conversationToPhoneMap[recipient];
        console.log(`✅ Número encontrado en caché: ${phoneNumber}`);
          } else {
        // Buscar en la base de datos
        console.log(`🔍 Buscando en base de datos...`);
        try {
          const { data, error } = await supabase
            .from('conversations')
            .select('user_id')
            .eq('id', recipient)
            .single();
          
          if (error) {
            console.error(`❌ Error buscando número: ${error.message}`);
            console.log(`🔍 Consulta fallida: .from('conversations').select('user_id').eq('id', '${recipient}').single()`);
            return false;
          }
          
          if (data && data.user_id) {
            phoneNumber = data.user_id;
            console.log(`✅ Número encontrado en DB: ${phoneNumber}`);
            
            // Actualizar caché
            conversationToPhoneMap[recipient] = phoneNumber;
            phoneToConversationMap[phoneNumber] = recipient;
            console.log(`📝 Caché actualizada: conversationToPhoneMap['${recipient}'] = '${phoneNumber}'`);
        } else {
            console.error(`❌ No se encontró número telefónico para la conversación ${recipient}`);
            console.log(`🔍 La consulta devolvió: ${JSON.stringify(data)}`);
            return false;
          }
        } catch (dbError) {
          console.error(`❌ Error en consulta a DB: ${dbError.message}`);
          console.log(`🔍 Error stack: ${dbError.stack}`);
          return false;
        }
      }
    }
    
    // Asegurar que el número de teléfono tiene formato correcto
    // El número debe estar en formato internacional sin +
    // Ejemplo: 5212221234567 (52 es código de país México, seguido del número)
    let formattedNumber = phoneNumber.toString().trim();
    
    // Eliminar cualquier + al inicio
    formattedNumber = formattedNumber.replace(/^\+/, '');
    
    // Verificar que sea solo números
    if (!/^\d+$/.test(formattedNumber)) {
      console.error(`❌ Formato de número inválido: ${formattedNumber}`);
      return false;
    }
    
    console.log('🔑 Usando API Key:', GUPSHUP_API_KEY ? GUPSHUP_API_KEY.substring(0, 5) + '...' : 'No configurada');
    console.log('📱 Desde número:', GUPSHUP_NUMBER);
    console.log('📱 Hacia número:', formattedNumber);
    
    // API v1 de GupShup - Método que funciona comprobado
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
      'apikey': GUPSHUP_API_KEY
    };
    
    console.log('🔄 Enviando mensaje a WhatsApp...');
    console.log(`📨 Datos de envío: URL=${apiUrl}, destination=${formattedNumber}, message=${JSON.stringify({type: 'text', text: message.substring(0, 30) + (message.length > 30 ? '...' : '')})}`);
    
    try {
    const response = await axios.post(apiUrl, formData, { headers });
    
      console.log(`📦 Respuesta recibida: status=${response.status}`);
    
    if (response.status >= 200 && response.status < 300) {
        console.log(`✅ Respuesta enviada exitosamente a ${formattedNumber}`);
        console.log('📊 Respuesta de GupShup:', JSON.stringify(response.data));
      return true;
    } else {
        console.error(`❌ Error en respuesta HTTP: ${response.status}`);
        throw new Error(`Error con la API WhatsApp: ${response.status}`);
      }
    } catch (apiError) {
      console.error('❌ Error en la llamada a la API de GupShup:', apiError.message);
      if (apiError.response) {
        console.error('🔍 Detalles del error HTTP:', 
          apiError.response.status, 
          JSON.stringify(apiError.response.data || {})
        );
      } else if (apiError.request) {
        console.error('🔍 No se recibió respuesta:', apiError.request);
      } else {
        console.error('🔍 Error en la configuración:', apiError.message);
      }
      throw apiError;
    }
  } catch (error) {
    console.error('❌ Error general en sendWhatsAppResponse:', error.message);
    if (error.response) {
      console.error('🔍 Detalles del error:', error.response.status, JSON.stringify(error.response.data || {}));
    }
    console.error('📋 Stack del error:', error.stack);
      return false;
  } finally {
    console.log(`📋 FIN DE FUNCIÓN sendWhatsAppResponse`);
  }
}

// Endpoint para probar la función de bots activos/inactivos
app.post('/simulate-webhook', async (req, res) => {
    try {
        const { sender, message } = req.body;
        
        if (!sender || !message) {
            return res.status(400).json({ 
                success: false, 
                message: 'Se requiere sender y message' 
            });
        }
        
        console.log(`\n🧪 === INICIANDO SIMULACIÓN DE MENSAJE ===`);
        console.log(`🧪 Remitente: ${sender}`);
        console.log(`🧪 Mensaje: "${message}"`);
        
        // Verificar explícitamente el estado del bot para este remitente
        let isBotActive = true;
        let conversationId = null;
        let botStatusChecks = [];
        
        try {
            const { data, error } = await supabase
                .from('conversations')
                .select('id, is_bot_active')
                .eq('user_id', sender)
                .eq('business_id', BUSINESS_ID);
            
            if (!error && data && data.length > 0) {
                conversationId = data[0].id;
                isBotActive = data[0].is_bot_active;
                console.log(`🧪 Conversación ${conversationId}`);
                console.log(`🧪 Estado del bot: ${isBotActive ? 'ACTIVO ✅' : 'DESACTIVADO ❌'}`);
                
                // También actualizar caché para pruebas
                senderBotStatusMap[sender] = isBotActive;
                console.log(`🧪 Actualizada caché de estado: senderBotStatusMap[${sender}] = ${isBotActive}`);
    } else {
                console.log(`🧪 No se encontró conversación para ${sender}, se asumirá bot activo ✅`);
    }
  } catch (error) {
            console.error(`🧪 Error al verificar estado del bot: ${error.message}`);
        }
        
        // Crear el formato exacto de un mensaje entrante de webhook
        const simulatedWebhookData = {
            entry: [{
                changes: [{
                    field: "messages",
                    value: {
                        contacts: [{
                            profile: {
                                name: `Simulador ${sender}`
                            },
                            wa_id: sender
                        }],
                        messages: [{
                            from: sender,
                            id: `sim-${Date.now()}`,
                            text: {
                                body: message
                            },
                            timestamp: new Date().toISOString(),
                            type: "text"
                        }],
                        messaging_product: "whatsapp"
                    }
                }]
            }]
        };
        
        // Usar el mismo procesamiento que para webhooks reales
        console.log('🧪 Procesando mensaje a través del webhook...');
        
        // Interceptar temporalmente la función de envío para capturar la respuesta
        let responseBot = null;
        const originalSendFunc = sendWhatsAppResponse;
        sendWhatsAppResponse = async (destPhone, msgText) => {
            responseBot = msgText;
            console.log(`🧪 Respuesta capturada: "${msgText.substring(0, 100)}${msgText.length > 100 ? '...' : ''}"`);
            // No enviar mensajes reales en la simulación
            return true;
        };
        
        // También interceptar la función de procesamiento con OpenAI para saber si se invocó
        let openAICalled = false;
        let verificationResults = [];
        const originalProcessFunc = processMessageWithOpenAI;
        processMessageWithOpenAI = async (sender, message, conversationId) => {
            openAICalled = true;
            console.log(`🧪 Llamada a OpenAI interceptada para ${sender}`);
            
            // Añadir interceptores para verificaciones
            const originalConsoleLog = console.log;
            console.log = function(msg, ...args) {
                originalConsoleLog(msg, ...args);
                
                // Capturar mensajes de verificación
                if (typeof msg === 'string') {
                    if (msg.includes('VERIFICACIÓN')) {
                        verificationResults.push(msg);
                    }
                }
            };
            
            try {
                return await originalProcessFunc(sender, message, conversationId);
            } finally {
                console.log = originalConsoleLog;
            }
        };
        
        // Procesar el mensaje simulado con la ruta del webhook
        await new Promise((resolve) => {
            // Enviar la solicitud directamente al endpoint del webhook
            app.handle({
                method: 'POST',
                url: '/webhook',
                body: simulatedWebhookData,
                headers: { 'content-type': 'application/json' }
            }, {
                sendStatus: (status) => {
                    console.log(`🧪 Webhook respondió con estado: ${status}`);
                    resolve();
                    return { send: () => {} };
                },
                status: () => ({ send: () => {} })
            }, () => {});
        });
        
        // Esperar brevemente para que procese las verificaciones
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Restaurar las funciones originales
        sendWhatsAppResponse = originalSendFunc;
        processMessageWithOpenAI = originalProcessFunc;
        
        // Mostrar resultados de la simulación
        console.log(`\n🧪 === RESULTADO DE LA SIMULACIÓN ===`);
        console.log(`🧪 Remitente: ${sender}`);
        console.log(`🧪 Mensaje: "${message}"`);
        console.log(`🧪 Estado del bot: ${isBotActive ? 'ACTIVO ✅' : 'DESACTIVADO ❌'}`);
        console.log(`🧪 OpenAI llamado: ${openAICalled ? 'SÍ ✅' : 'NO ❌'}`);
        
        // Mostrar verificaciones capturadas
        if (verificationResults.length > 0) {
            console.log(`🧪 Verificaciones detectadas (${verificationResults.length}):`);
            verificationResults.forEach((msg, i) => {
                console.log(`   ${i+1}. ${msg}`);
            });
        } else if (!openAICalled) {
            console.log(`🧪 ✅ Correcto: No se llamó a OpenAI porque el bot está desactivado`);
        } else if (isBotActive) {
            console.log(`🧪 ✅ Correcto: Se llamó a OpenAI porque el bot está activado`);
    } else {
            console.log(`🧪 ❌ ERROR: Se llamó a OpenAI aunque el bot está desactivado`);
        }
        
        console.log(`🧪 Respuesta: ${responseBot ? `"${responseBot.substring(0, 100)}${responseBot.length > 100 ? '...' : ''}"` : 'No se envió respuesta ❌'}`);
        
        if (!isBotActive && !responseBot) {
            console.log(`🧪 ✅ ÉXITO: Bot desactivado y no se envió respuesta (comportamiento correcto)`);
        } else if (isBotActive && responseBot) {
            console.log(`🧪 ✅ ÉXITO: Bot activado y se envió respuesta (comportamiento correcto)`);
        } else if (!isBotActive && responseBot) {
            console.log(`🧪 ❌ ERROR: Bot desactivado pero se envió respuesta (comportamiento incorrecto)`);
        } else if (isBotActive && !responseBot) {
            console.log(`🧪 ⚠️ ADVERTENCIA: Bot activado pero no se envió respuesta (posible problema con OpenAI)`);
        }

        return res.status(200).json({ 
            success: true,
            message: responseBot,
            sender: sender,
            bot_active: isBotActive,
            openai_called: openAICalled,
            verification_steps: verificationResults.length
        });
    } catch (error) {
        console.error('❌ Error en simular mensaje:', error.message);
        return res.status(500).json({ error: error.message });
    }
});

// Endpoint para limpiar la caché de estados del bot
app.post('/clear-cache', (req, res) => {
  try {
    console.log('🧹 Limpiando caché de estados de bot...');
    
    // Resetear el mapa de estados
    for (const key in senderBotStatusMap) {
      delete senderBotStatusMap[key];
    }
    
    console.log('✅ Caché de estados limpiada correctamente');
    console.log('📊 Estado actual de la caché:', Object.keys(senderBotStatusMap).length, 'entradas');
    
    return res.json({
      success: true,
      message: 'Caché limpiada correctamente',
      cache_size: Object.keys(senderBotStatusMap).length
    });
  } catch (error) {
    console.error('❌ Error al limpiar caché:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al limpiar caché',
      error: error.message
    });
  }
});

// Endpoint para forzar la recarga de estados de bot desde la base de datos
app.post('/reload-bot-states', async (req, res) => {
  try {
    console.log('🔄 Recargando estados de bot desde la base de datos...');
    
    // Limpiar caché actual
    for (const key in senderBotStatusMap) {
      delete senderBotStatusMap[key];
    }
    
    // Cargar estados desde Supabase
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('id, user_id, is_bot_active')
      .eq('business_id', BUSINESS_ID);
    
    if (error) {
      throw new Error(`Error al cargar conversaciones: ${error.message}`);
    }
    
    let loadedCount = 0;
    
    // Actualizar caché con datos frescos
    for (const conv of conversations) {
      if (conv.user_id) {
        senderBotStatusMap[conv.user_id] = conv.is_bot_active === true;
        loadedCount++;
        console.log(`ℹ️ Bot para ${conv.user_id}: ${conv.is_bot_active ? 'ACTIVO ✅' : 'INACTIVO ⛔'}`);
      }
    }
    
    console.log(`✅ Estados de bot recargados: ${loadedCount} conversaciones actualizadas`);
    
    return res.json({
      success: true,
      message: `Estados de bot recargados correctamente`,
      loaded_count: loadedCount,
      cache_size: Object.keys(senderBotStatusMap).length
    });
  } catch (error) {
    console.error('❌ Error al recargar estados:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al recargar estados',
      error: error.message
    });
  }
});

// Endpoint para mostrar columnas de una tabla
app.post('/show-table-columns', async (req, res) => {
  try {
    const { table } = req.body;
    
    if (!table) {
      return res.status(400).json({ success: false, message: 'Se requiere table' });
    }
    
    console.log(`🔍 Obteniendo columnas de la tabla: ${table}`);
    
    // En lugar de usar RPC, simplemente consultar la tabla directamente
    const { data, error } = await supabase
      .from(table)
      .select()
      .limit(1);
    
    if (error) {
      console.error(`❌ Error al obtener datos de ${table}:`, error);
      return res.status(500).json({ 
        success: false, 
        message: `Error al obtener datos de ${table}`, 
        error: error.message 
      });
    }
    
    // Si tenemos datos, podemos ver la estructura del primer objeto
    let columns = [];
    if (data && data.length > 0) {
      columns = Object.keys(data[0]).map(column => ({
        column_name: column,
        data_type: typeof data[0][column],
        sample_value: data[0][column]
      }));
    }
    
    console.log(`✅ Se encontraron ${columns.length} columnas en la tabla ${table}`);
    
    return res.status(200).json({
      success: true,
      table: table,
      column_count: columns.length,
      columns: columns,
      sample_row: data && data.length > 0 ? data[0] : null
    });
  } catch (error) {
    console.error('❌ Error general al obtener columnas:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error general al obtener columnas', 
      error: error.message 
    });
  }
});

// Endpoint para verificar conversaciones duplicadas
app.post('/check-duplicate-conversations', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requiere phoneNumber' 
      });
    }
    
    console.log(`🔍 Buscando conversaciones duplicadas para el número: ${phoneNumber}`);
    
    // Primero normalizar el número telefónico para búsqueda consistente
    const normalizedNumber = phoneNumber.toString().trim().replace(/^\+/, '');
    
    // Buscar todas las conversaciones con este número de teléfono
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', normalizedNumber);
    
    if (error) {
      console.error('❌ Error al buscar conversaciones:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Error al buscar conversaciones', 
        error: error.message 
      });
    }
    
    console.log(`✅ Búsqueda completada: ${conversations?.length || 0} conversaciones encontradas`);
    
    // Estado actual en caché
    const cachedStatus = senderBotStatusMap[normalizedNumber];
    console.log(`📋 Estado en caché para ${normalizedNumber}: ${cachedStatus === true ? 'ACTIVO ✅' : cachedStatus === false ? 'INACTIVO ⛔' : 'No está en caché ❓'}`);
    
    // Añadir texto de estado a cada conversación
    const detailedConversations = conversations?.map(conv => ({
      ...conv,
      status_text: conv.is_bot_active ? 'ACTIVO ✅' : 'INACTIVO ⛔'
    })) || [];
    
    return res.status(200).json({
      success: true,
      phone_number: normalizedNumber,
      conversation_count: detailedConversations.length,
      cached_status: cachedStatus,
      cached_status_text: cachedStatus === true ? 'ACTIVO ✅' : cachedStatus === false ? 'INACTIVO ⛔' : 'No está en caché ❓',
      conversations: detailedConversations
    });
  } catch (error) {
    console.error('❌ Error general al verificar conversaciones duplicadas:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error general al verificar conversaciones duplicadas', 
      error: error.message 
    });
  }
});

// Endpoint para verificar el estado de una conversación específica
app.get('/check-bot-status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requiere ID de conversación' 
      });
    }
    
    console.log(`🔍 Verificando estado del bot para conversación: ${id}`);
    
    // Determinar si es UUID o número telefónico
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let query;
    
    if (isUUID) {
      // Es un UUID, buscar por ID
      query = supabase
        .from('conversations')
        .select('*')
        .eq('id', id);
    } else {
      // Es un número telefónico, buscar por user_id
      const normalizedNumber = id.toString().trim().replace(/^\+/, '');
      query = supabase
        .from('conversations')
        .select('*')
        .eq('user_id', normalizedNumber);
    }
    
    const { data: conversations, error } = await query;
    
    if (error) {
      console.error('❌ Error al buscar conversación:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Error al buscar conversación', 
        error: error.message 
      });
    }
    
    if (!conversations || conversations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró conversación con ese ID o número'
      });
    }
    
    // Si es un número y hay múltiples conversaciones, mostrar todas
    const phoneNumber = isUUID ? 
      (conversations[0]?.user_id || null) : 
      id.toString().trim().replace(/^\+/, '');
    
    // Estado actual en caché
    const cachedStatus = phoneNumber ? senderBotStatusMap[phoneNumber] : null;
    console.log(`📋 Estado en caché para ${phoneNumber || 'desconocido'}: ${cachedStatus === true ? 'ACTIVO ✅' : cachedStatus === false ? 'INACTIVO ⛔' : 'No está en caché ❓'}`);
    
    // Añadir texto de estado a cada conversación
    const detailedConversations = conversations?.map(conv => ({
      ...conv,
      status_text: conv.is_bot_active ? 'ACTIVO ✅' : 'INACTIVO ⛔'
    })) || [];
    
    return res.status(200).json({
      success: true,
      id: id,
      is_uuid: isUUID,
      phone_number: phoneNumber,
      conversation_count: detailedConversations.length,
      cached_status: cachedStatus,
      cached_status_text: cachedStatus === true ? 'ACTIVO ✅' : cachedStatus === false ? 'INACTIVO ⛔' : 'No está en caché ❓',
      conversations: detailedConversations
    });
  } catch (error) {
    console.error('❌ Error general al verificar estado del bot:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error general al verificar estado del bot', 
      error: error.message 
    });
  }
});

// Endpoint para forzar desactivación del bot para un número específico
app.post('/force-deactivate-bot', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere phoneNumber'
      });
    }
    
    console.log(`🔒 Forzando desactivación del bot para número: ${phoneNumber}`);
    
    // Normalizar el número para búsqueda consistente
    const normalizedNumber = phoneNumber.toString().trim().replace(/^\+/, '');
    
    // 1. Actualizar en caché inmediatamente
    senderBotStatusMap[normalizedNumber] = false;
    console.log(`🔒 Desactivado en caché: senderBotStatusMap[${normalizedNumber}] = false`);
    
    // 2. Desactivar en base de datos
    const { data, error } = await supabase
      .from('conversations')
      .update({ is_bot_active: false })
      .eq('user_id', normalizedNumber)
      .eq('business_id', BUSINESS_ID)
      .select();
    
    if (error) {
      console.error('❌ Error al desactivar bot en DB:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
        message: 'Error al desactivar bot en base de datos, pero se marcó como inactivo en caché'
      });
    }
    
    console.log(`✅ Bot desactivado exitosamente para ${normalizedNumber} en DB y caché`);
    
    // 3. Intentar obtener el ID de conversación para referencia
    let conversationId = null;
    if (data && data.length > 0) {
      conversationId = data[0].id;
      console.log(`ℹ️ ID de conversación: ${conversationId}`);
    }
    
    return res.status(200).json({
      success: true,
      message: `Bot desactivado exitosamente para ${phoneNumber}`,
      conversation_id: conversationId,
      conversation_count: data?.length || 0
    });
  } catch (error) {
    console.error('❌ Error general al forzar desactivación:', error);
    return res.status(500).json({
      success: false,
      message: 'Error general al forzar desactivación',
      error: error.message
    });
  }
});

// Función para desactivar y verificar bot
async function forceDeactivateBot(phoneOrConversationId) {
  try {
    // Determinar si es un ID de conversación o un número de teléfono
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(phoneOrConversationId);
    
    console.log(`🔒 Forzando desactivación para ${isUUID ? 'conversación' : 'número'}: ${phoneOrConversationId}`);
    
    if (isUUID) {
      // Es un ID de conversación
      // 1. Buscar el número asociado para actualizar caché
      const { data: userData, error: userError } = await supabase
        .from('conversations')
        .select('user_id')
        .eq('id', phoneOrConversationId)
        .single();
      
      if (!userError && userData && userData.user_id) {
        // Actualizar caché
        senderBotStatusMap[userData.user_id] = false;
        console.log(`🔒 Desactivado en caché: senderBotStatusMap[${userData.user_id}] = false`);
      }
      
      // 2. Desactivar por ID
      const { error } = await supabase
        .from('conversations')
        .update({ is_bot_active: false })
        .eq('id', phoneOrConversationId);
      
      if (error) {
        console.error(`❌ Error al desactivar bot para conversación ${phoneOrConversationId}:`, error);
    return false;
  }
      
      console.log(`✅ Bot desactivado exitosamente para conversación ${phoneOrConversationId}`);
      return true;
    } else {
      // Es un número de teléfono
      // Normalizar el número
      const normalizedNumber = phoneOrConversationId.toString().trim().replace(/^\+/, '');
      
      // 1. Actualizar caché
      senderBotStatusMap[normalizedNumber] = false;
      console.log(`🔒 Desactivado en caché: senderBotStatusMap[${normalizedNumber}] = false`);
      
      // 2. Desactivar en base de datos
      const { error } = await supabase
        .from('conversations')
        .update({ is_bot_active: false })
        .eq('user_id', normalizedNumber)
        .eq('business_id', BUSINESS_ID);
      
      if (error) {
        console.error(`❌ Error al desactivar bot para número ${normalizedNumber}:`, error);
        return false;
      }
      
      console.log(`✅ Bot desactivado exitosamente para número ${normalizedNumber}`);
      return true;
    }
  } catch (error) {
    console.error('❌ Error general en forceDeactivateBot:', error);
    return false;
  }
}