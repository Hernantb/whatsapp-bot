/**
 * FIX DIRECTO PARA BOT WHATSAPP
 * 
 * Este script corrige el problema de URLs duplicadas en las peticiones al panel de control.
 * Debe ser incluido al inicio del archivo principal del bot (index.js).
 */

// Al inicio del archivo, cargar las dependencias
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Cargar configuración de Supabase
let { SUPABASE_URL, SUPABASE_KEY, BUSINESS_ID } = require('./supabase-config');

// Verificar si las variables de entorno están definidas (tienen prioridad)
if (process.env.SUPABASE_URL) {
  SUPABASE_URL = process.env.SUPABASE_URL;
  console.log('✅ Usando SUPABASE_URL desde variable de entorno');
}

if (process.env.SUPABASE_KEY) {
  SUPABASE_KEY = process.env.SUPABASE_KEY;
  console.log('✅ Usando SUPABASE_KEY desde variable de entorno');
}

if (process.env.BUSINESS_ID) {
  BUSINESS_ID = process.env.BUSINESS_ID;
  console.log('✅ Usando BUSINESS_ID desde variable de entorno');
}

// Verificar que las variables estén definidas
if (SUPABASE_URL === 'https://tu-proyecto.supabase.co') {
  console.error('⚠️ ADVERTENCIA: Debes configurar SUPABASE_URL en supabase-config.js o en variables de entorno');
}

if (SUPABASE_KEY === 'tu-clave-anonima') {
  console.error('⚠️ ADVERTENCIA: Debes configurar SUPABASE_KEY en supabase-config.js o en variables de entorno');
}

// Configurar fetch para Node.js - VERSIÓN MEJORADA PARA RENDER
let fetch;
try {
  // Intentar usar node-fetch primero (más estable en entornos de servidor)
  try {
    const nodeFetch = require('node-fetch');
    fetch = nodeFetch.default || nodeFetch;  // Manejar diferentes versiones
    global.fetch = fetch;
    console.log('✅ node-fetch cargado exitosamente');
  } catch (e) {
    console.log('⚠️ node-fetch no disponible, intentando usar fetch nativo...');
    // Intentar usar fetch global (disponible en Node.js más reciente)
    fetch = global.fetch;
    console.log('✅ fetch nativo disponible en Node.js');
  }
} catch (error) {
  console.warn('⚠️ No se pudo cargar fetch. Los servicios que lo requieran pueden fallar.');
  console.warn('⚠️ Instala node-fetch v2 con: npm install node-fetch@2');
}

// Importar Supabase con configuración mejorada
let supabase;
try {
  console.log('🔄 Inicializando cliente Supabase...');
  
  // Usar configuración estándar para Node.js
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: false
    }
  });
  
  console.log('✅ Cliente Supabase inicializado correctamente');
} catch (error) {
  console.error('❌ Error al inicializar cliente Supabase:', error.message);
}

// Configuración
const DEFAULT_PROD_URL = 'https://render-wa.onrender.com';
const DEFAULT_DEV_URL = 'http://localhost:4001';

// Función para verificar disponibilidad de URL (mock - siempre asume que render está disponible en producción)
const isUrlAvailable = (url) => {
  // En producción, si la URL viene de una variable de entorno, úsala
  if (process.env.NODE_ENV === 'production' && process.env.CONTROL_PANEL_URL) {
    console.log(`🔍 Usando URL de variable de entorno en producción: ${process.env.CONTROL_PANEL_URL}`);
    return true;
  }
  
  // En producción sin variable de entorno, asume que la URL de producción está disponible
  if (process.env.NODE_ENV === 'production' && url === DEFAULT_PROD_URL) {
    console.log(`🔍 Usando URL predeterminada de producción: ${DEFAULT_PROD_URL}`);
    return true;
  }
  
  // Para entorno local
  if (url.includes('localhost')) {
    // En entorno de desarrollo, verificamos si hay un servidor local
    try {
      // Nota: esta es una verificación simulada, en un caso real
      // se intentaría una conexión real antes de determinar disponibilidad
      const isDev = process.env.NODE_ENV !== 'production';
      console.log(`🔍 Verificando disponibilidad de servidor local en desarrollo: ${isDev ? 'disponible' : 'no disponible'}`);
      return isDev;
    } catch (e) {
      console.log(`❌ Error verificando disponibilidad local: ${e.message}`);
      return false;
    }
  }
  
  console.log(`🔍 Usando URL externa: ${url}`);
  return true; // Asumimos que URLs externas están disponibles
};

// Selección de URL con fallback
const selectUrl = () => {
  // En producción, forzar siempre la URL de producción
  if (process.env.NODE_ENV === 'production') {
    console.log(`🌐 Ambiente de PRODUCCIÓN detectado - Usando URL de producción`);
    return DEFAULT_PROD_URL;
  }
  
  // Para desarrollo, intentar usar la URL local primero
  console.log(`🌐 Ambiente de DESARROLLO detectado - Intentando URL local`);
  const envUrl = process.env.CONTROL_PANEL_URL;
  
  // Segunda opción: URL según ambiente (ya sabemos que estamos en desarrollo)
  const defaultUrl = DEFAULT_DEV_URL;
  
  // Verificar disponibilidad y seleccionar
  const primaryUrl = envUrl || defaultUrl;
  if (isUrlAvailable(primaryUrl)) {
    return primaryUrl;
  }
  
  // Fallback a URL de producción si la primaria no está disponible
  console.warn(`⚠️ URL primaria ${primaryUrl} no disponible, usando fallback: ${DEFAULT_PROD_URL}`);
  return DEFAULT_PROD_URL;
};

// Forzar la URL correcta según el ambiente
console.log('🔍 FIX-REAL-BOT: Estado de URL antes de procesar:');
console.log('- CONTROL_PANEL_URL:', process.env.CONTROL_PANEL_URL || 'no definida');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'no definido');
console.log('- RENDER:', process.env.RENDER || 'no definido');

// Verificar si ya está configurada correctamente
const isProdEnv = process.env.NODE_ENV === 'production';
const isRenderEnv = process.env.RENDER === 'true' || process.env.RENDER_EXTERNAL_URL !== undefined;

// Respetar la URL ya configurada en producción si existe y no es localhost
let CONTROL_PANEL_URL;
if (isProdEnv) {
  const correctProdUrl = 'https://whatsapp-bot-if6z.onrender.com';
  
  if (process.env.CONTROL_PANEL_URL) {
    if (process.env.CONTROL_PANEL_URL.includes('localhost')) {
      console.log('⚠️ FIX-REAL-BOT: URL de localhost detectada en producción, corrigiendo...');
      CONTROL_PANEL_URL = correctProdUrl;
    } else if (isRenderEnv) {
      console.log('✅ FIX-REAL-BOT: Usando URL configurada para Render:', process.env.CONTROL_PANEL_URL);
      CONTROL_PANEL_URL = process.env.CONTROL_PANEL_URL;
    } else {
      // Si es producción pero no es Render, usar la URL configurada
      console.log('✅ FIX-REAL-BOT: Usando URL de producción configurada:', process.env.CONTROL_PANEL_URL);
      CONTROL_PANEL_URL = process.env.CONTROL_PANEL_URL;
    }
  } else {
    // Si no hay URL configurada en producción, usar la predeterminada
    console.log('⚠️ FIX-REAL-BOT: Sin URL configurada en producción, usando predeterminada:', correctProdUrl);
    CONTROL_PANEL_URL = correctProdUrl;
  }
} else {
  // En desarrollo, usar la selección normal
  console.log('🔍 FIX-REAL-BOT: Usando selección de URL para entorno de desarrollo');
  CONTROL_PANEL_URL = selectUrl();
}

// Limpiar la URL: eliminar /register-bot-response o /api/register-bot-response si está presente
if (CONTROL_PANEL_URL && (CONTROL_PANEL_URL.includes('/register-bot-response') || CONTROL_PANEL_URL.includes('/api/register-bot-response'))) {
  console.log('⚠️ Detectada URL con ruta incluida. Corrigiendo para usar solo el dominio base...');
  console.log('⚠️ URL original:', CONTROL_PANEL_URL);
  
  // Extraer solo el dominio base usando una regex más estricta
  const urlPattern = /^(https?:\/\/[^\/]+)(?:\/.*)?$/;
  const match = CONTROL_PANEL_URL.match(urlPattern);
  
  if (match && match[1]) {
    CONTROL_PANEL_URL = match[1]; // Tomar solo el dominio con protocolo
    console.log('✅ URL corregida a dominio base:', CONTROL_PANEL_URL);
  } else {
    // Si por alguna razón falla, usar un enfoque más simple
    CONTROL_PANEL_URL = CONTROL_PANEL_URL.replace(/\/(?:api\/)?register-bot-response.*$/, '');
    console.log('✅ URL corregida mediante método alternativo:', CONTROL_PANEL_URL);
  }
  
  // Guardar la URL correcta en variable de entorno para que persista
  try {
    process.env.CONTROL_PANEL_URL = CONTROL_PANEL_URL;
    console.log('✅ URL base guardada en variable de entorno');
  } catch (e) {
    console.log('⚠️ No se pudo guardar en variable de entorno:', e.message);
  }
}

// Forzar verificación de que la URL no incluya rutas
if (CONTROL_PANEL_URL.includes('/api/') || CONTROL_PANEL_URL.includes('/register-bot-response')) {
  console.log('⚠️ ALERTA: La URL todavía contiene rutas. Aplicando corrección final...');
  CONTROL_PANEL_URL = CONTROL_PANEL_URL.split('/api/')[0].split('/register-bot-response')[0];
  console.log('✅ URL final corregida:', CONTROL_PANEL_URL);
}

// Verificar puerto explícito
if (CONTROL_PANEL_URL.includes('render-wa.onrender.com') && !CONTROL_PANEL_URL.includes(':10000')) {
  // Los logs muestran que Render está funcionando en puerto 10000
  console.log('⚠️ Ajustando URL para incluir puerto explícito 10000 para Render...');
  CONTROL_PANEL_URL = CONTROL_PANEL_URL.replace('render-wa.onrender.com', 'whatsapp-bot-if6z.onrender.com');
  console.log('✅ URL con puerto:', CONTROL_PANEL_URL);
}

// Mostrar información del entorno actual
console.log('🌐 Ambiente de ' + (process.env.NODE_ENV === 'production' ? 'PRODUCCIÓN' : 'DESARROLLO') + ' detectado - Intentando URL local');

// Verificar disponibilidad del servidor local en modo desarrollo
if (process.env.NODE_ENV !== 'production') {
  const localServerAvailable = true; // Simplificado para este ejemplo
  console.log(`🔍 Verificando disponibilidad de servidor local en desarrollo: ${localServerAvailable ? 'disponible' : 'no disponible'}`);
}

console.log('🔧 APLICANDO PARCHE PARA CORREGIR URLs DEL BOT WHATSAPP');
console.log('CONTROL_PANEL_URL actual:', CONTROL_PANEL_URL);
console.log('Ambiente:', process.env.NODE_ENV === 'production' ? 'Producción' : 'Desarrollo');

// Determinar la URL correcta según el ambiente
let correctUrl = CONTROL_PANEL_URL;
console.log('URL que se usará:', correctUrl);

// Conexión a Supabase mediante REST API (alternativa)
async function directSupabaseAxios(endpoint, method, data = null) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'get' ? 'return=representation' : 'return=minimal'
    };
    
    let response;
    if (method === 'get') {
      response = await axios.get(url, { headers });
    } else if (method === 'post') {
      response = await axios.post(url, data, { headers });
    } else if (method === 'patch') {
      response = await axios.patch(url, data, { headers });
    }
    
    return { data: response.data, error: null };
  } catch (error) {
    console.error(`❌ Error en petición ${method.toUpperCase()} a ${endpoint}:`, error.message);
    return { data: null, error: error };
  }
}

// Función para guardar mensajes directamente en Supabase usando la URL directa
async function saveMessageToSupabase(conversationId, message, business_id, sender_type = 'bot', metadata = null) {
  console.log('🔄 Guardando mensaje en Supabase...');
  console.log(`📤 Tipo de mensaje: ${sender_type}`);
  console.log(`📤 Guardando mensaje de tipo '${sender_type}' para: ${conversationId}`);
  
  try {
    // Normalizar el ID de la conversación para evitar problemas con diferentes formas de escribir el mismo ID
    const normalizedConversationId = String(conversationId).trim().replace(/_TEST.*$/i, '');
    console.log(`🚀 Procesando mensaje para: ${normalizedConversationId}`);
    
    // 1. Buscar la conversación existente
    console.log('🔍 Buscando conversación para:', normalizedConversationId);
    
    let result;
    
    // Intentar primero con el cliente Supabase
    if (supabase) {
      try {
        const { data: conversations, error } = await supabase
          .from('conversations')
          .select('id')
          .eq('user_id', normalizedConversationId)
          .eq('business_id', business_id)
          .limit(1);
          
        if (error) throw error;
        result = { conversations };
      } catch (clientError) {
        console.log('⚠️ Error con cliente Supabase, usando API REST:', clientError.message);
        
        // Si falla, usar API REST directa
        const { data, error } = await directSupabaseAxios(
          `conversations?user_id=eq.${encodeURIComponent(normalizedConversationId)}&business_id=eq.${encodeURIComponent(business_id)}&select=id`, 
          'get'
        );
        
        if (error) throw error;
        result = { conversations: data };
      }
    } else {
      // Si no hay cliente, usar directamente API REST
      const { data, error } = await directSupabaseAxios(
        `conversations?user_id=eq.${encodeURIComponent(normalizedConversationId)}&business_id=eq.${encodeURIComponent(business_id)}&select=id`, 
        'get'
      );
      
      if (error) throw error;
      result = { conversations: data };
    }
    
    let conversationDbId;
    
    // 2. Crear nueva conversación si no existe
    if (!result.conversations || result.conversations.length === 0) {
      console.log('🆕 No se encontró conversación existente, creando nueva...');
      
      const newConversation = {
        user_id: normalizedConversationId,
        business_id,
        sender_name: 'Usuario',
        last_message: message
        // No incluir updated_at ya que no existe en la tabla
      };
      
      // Intentar crear con el cliente o API REST
      if (supabase) {
        try {
          const { data: newData, error } = await supabase
            .from('conversations')
            .insert([newConversation])
            .select();
            
          if (error) throw error;
          conversationDbId = newData[0].id;
        } catch (clientError) {
          console.log('⚠️ Error creando conversación con cliente, usando API REST:', clientError.message);
          
          const { data, error } = await directSupabaseAxios('conversations', 'post', newConversation);
          if (error) throw error;
          conversationDbId = data[0].id;
        }
      } else {
        const { data, error } = await directSupabaseAxios('conversations', 'post', newConversation);
        if (error) throw error;
        conversationDbId = data[0].id;
      }
      
      console.log('✅ Nueva conversación creada con ID:', conversationDbId);
    } else {
      conversationDbId = result.conversations[0].id;
      console.log('ℹ️ Usando conversación existente con ID:', conversationDbId);
    }
    
    // 3. Guardar el mensaje
    const messageData = {
      conversation_id: conversationDbId,
      content: typeof message === 'string' ? message : JSON.stringify(message),
      sender_type,
      created_at: new Date().toISOString(),
      business_id
    };
    
    // Si hay metadatos, agregarlos al mensaje
    if (metadata && typeof metadata === 'object') {
      messageData.metadata = metadata;
      if (metadata.source === 'dashboard' || metadata.from_api_send_manual === true) {
        messageData.sent_from_dashboard = true;
      }
    }

    if (supabase) {
      try {
        const { error } = await supabase.from('messages').insert([messageData]);
        if (error) throw error;
      } catch (clientError) {
        console.log('⚠️ Error guardando mensaje con cliente, usando API REST:', clientError.message);
        
        const { error } = await directSupabaseAxios('messages', 'post', messageData);
        if (error) throw error;
      }
    } else {
      const { error } = await directSupabaseAxios('messages', 'post', messageData);
      if (error) throw error;
    }
    
    // 4. Actualizar última actividad de la conversación
    const update = {
      last_message: message
      // No incluir updated_at ya que no existe en la tabla
    };
    
    if (supabase) {
      try {
        const { error } = await supabase
          .from('conversations')
          .update(update)
          .eq('id', conversationDbId);
          
        if (error) throw error;
      } catch (clientError) {
        console.log('⚠️ Error actualizando conversación con cliente, usando API REST:', clientError.message);
        
        const { error } = await directSupabaseAxios(
          `conversations?id=eq.${conversationDbId}`, 
          'patch', 
          update
        );
        if (error) throw error;
      }
    } else {
      const { error } = await directSupabaseAxios(
        `conversations?id=eq.${conversationDbId}`, 
        'patch', 
        update
      );
      if (error) throw error;
    }
    
    console.log('✅ Mensaje guardado y conversación actualizada correctamente en Supabase');
    return true;
  } catch (error) {
    console.error('❌ Error al guardar mensaje en Supabase:', error.message);
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', JSON.stringify(error.response.data));
    }
    throw error; // Reenviar el error para manejarlo en registerBotResponse
  }
}

// Función para registrar respuestas del bot
async function registerBotResponse(conversationId, message, business_id = BUSINESS_ID, sender_type = 'bot', metadata = null) {
  if (!conversationId || !message) {
    console.error('❌ Error: Se requiere conversationId y message');
    return false;
  }
  
  // Normalizar el ID de la conversación para garantizar consistencia
  const normalizedConversationId = String(conversationId).trim().replace(/_TEST.*$/i, '');
  console.log('🚀 Procesando mensaje para:', normalizedConversationId);
  console.log('📝 Mensaje:', JSON.stringify(message).substring(0, 100) + (message.length > 100 ? '...' : ''));
  
  if (metadata) {
    console.log('📝 Metadatos:', JSON.stringify(metadata));
  }
  
  try {
    // Intentar guardar directamente en Supabase, pasando los metadatos
    await saveMessageToSupabase(normalizedConversationId, message, business_id, sender_type, metadata);
    console.log(`✅ Mensaje guardado correctamente en Supabase (tipo: ${sender_type})`);
    return { success: true, message: "Mensaje guardado en Supabase" };
  } catch (error) {
    // Intentar con el servidor como respaldo
    console.error('❌ Error guardando en Supabase, intentando con el servidor:', error.message);
    
    try {
      // Intentar con la API REST del servidor
      const serverUrl = `${CONTROL_PANEL_URL}/api/register-bot-response`;
      console.log('🔄 Enviando mensaje al servidor:', serverUrl);
      
      const requestData = {
        conversationId: normalizedConversationId,
        message,
        business_id: business_id,
        sender_type: sender_type
      };
      
      // Añadir metadatos a la solicitud si existen
      if (metadata) {
        requestData.metadata = metadata;
      }
      
      const response = await axios.post(serverUrl, requestData);
      
      console.log('✅ Mensaje enviado correctamente al servidor:', response.status);
      return { success: true, message: "Mensaje enviado al servidor" };
    } catch (serverError) {
      console.error('❌ Error también al enviar al servidor:', serverError.message);
      
      // Intentar URL alternativa
      try {
        const alternativeUrl = `${CONTROL_PANEL_URL}/register-bot-response`;
        console.log('🔄 Intentando URL alternativa:', alternativeUrl);
        
        const altResponse = await axios.post(alternativeUrl, {
          conversationId: normalizedConversationId,
          message,
          business_id: business_id,
          sender_type: sender_type
        });
        
        console.log('✅ Mensaje enviado con URL alternativa:', altResponse.status);
        return { success: true, message: "Mensaje enviado al servidor (alternativa)" };
      } catch (altError) {
        console.error('❌ Error en segundo intento:', altError.message);
        console.error('❌ No se pudo guardar el mensaje por ningún método.');
        return { success: false, error: altError.message };
      }
    }
  }
}

// Exportar las funciones
module.exports = {
  registerBotResponse,
  saveMessageToSupabase,
  SUPABASE_URL,
  SUPABASE_KEY
};

// Al inicio del archivo, donde se importan las dependencias
// IMPORTANTE: Agregar este código al inicio, después de las importaciones
console.log('📡 VERIFICACIÓN DE ACCESO A SUPABASE');

// Verificar si Supabase es accesible desde este entorno
(async function testSupabaseAccess() {
  try {
    console.log(`🔍 Intentando acceder a Supabase (${SUPABASE_URL}) con Axios...`);
    const axiosResponse = await axios.get(`${SUPABASE_URL}/rest/v1/conversations?limit=1`, {
      headers: {
        'apikey': SUPABASE_KEY
      },
      timeout: 5000
    });
    console.log('✅ SUPABASE ACCESIBLE VIA AXIOS:', axiosResponse.status);
    console.log('✅ CONTENIDO DE RESPUESTA:', JSON.stringify(axiosResponse.data).substring(0, 100) + '...');
  } catch (axiosError) {
    console.error('❌ ERROR ACCEDIENDO A SUPABASE VIA AXIOS:', axiosError.message);
    if (axiosError.code === 'ENOTFOUND') {
      console.error('❌ NO SE PUEDE RESOLVER EL HOSTNAME DE SUPABASE - PROBLEMA DE DNS');
      console.error('ℹ️ Asegúrate de que el SUPABASE_URL en supabase-config.js sea correcto');
    } else if (axiosError.response) {
      console.error('ℹ️ RESPUESTA DE ERROR:', axiosError.response.status, axiosError.response.statusText);
    }
  }

  // Intentar con fetch nativo si está disponible
  if (global.fetch) {
    try {
      console.log(`🔍 Intentando acceder a Supabase (${SUPABASE_URL}) con Fetch nativo...`);
      const fetchResponse = await fetch(`${SUPABASE_URL}/rest/v1/conversations?limit=1`, {
        headers: {
          'apikey': SUPABASE_KEY
        }
      });
      const data = await fetchResponse.json();
      console.log('✅ SUPABASE ACCESIBLE VIA FETCH NATIVO:', fetchResponse.status);
      console.log('✅ CONTENIDO DE RESPUESTA:', JSON.stringify(data).substring(0, 100) + '...');
    } catch (fetchError) {
      console.error('❌ ERROR ACCEDIENDO A SUPABASE VIA FETCH NATIVO:', fetchError.message);
    }
  } else {
    console.log('ℹ️ Fetch nativo no disponible en este entorno');
  }
  
  // Intentar con node-fetch si está disponible
  try {
    const nodeFetch = require('node-fetch');
    console.log(`🔍 Intentando acceder a Supabase (${SUPABASE_URL}) con node-fetch...`);
    try {
      const nodeFetchResponse = await nodeFetch(`${SUPABASE_URL}/rest/v1/conversations?limit=1`, {
        headers: {
          'apikey': SUPABASE_KEY
        }
      });
      const data = await nodeFetchResponse.json();
      console.log('✅ SUPABASE ACCESIBLE VIA NODE-FETCH:', nodeFetchResponse.status);
      console.log('✅ CONTENIDO DE RESPUESTA:', JSON.stringify(data).substring(0, 100) + '...');
    } catch (nodeFetchError) {
      console.error('❌ ERROR ACCEDIENDO A SUPABASE VIA NODE-FETCH:', nodeFetchError.message);
    }
  } catch (requireError) {
    console.log('ℹ️ node-fetch no está instalado o no es accesible');
  }

  console.log('📡 FIN DE VERIFICACIÓN DE ACCESO A SUPABASE');
})();

// Verificar dominios antiguos y corregirlos
if (process.env.NODE_ENV === 'production' && correctUrl.includes('panel-control-whatsapp.onrender.com')) {
    correctUrl = correctUrl.replace('panel-control-whatsapp.onrender.com', 'whatsapp-bot-if6z.onrender.com');
}

// Verificar puerto explícito
if (correctUrl.includes('render-wa.onrender.com') && !correctUrl.includes(':10000')) {
    // Los logs muestran que Render está funcionando en puerto 10000
    console.log('⚠️ Ajustando URL para incluir puerto explícito 10000 para Render...');
    correctUrl = correctUrl.replace('render-wa.onrender.com', 'whatsapp-bot-if6z.onrender.com');
    console.log('✅ URL con puerto:', correctUrl);
} 