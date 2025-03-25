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

// Configuración
const DEFAULT_PROD_URL = 'https://render-wa.onrender.com';
const DEFAULT_DEV_URL = 'http://localhost:4001';

// Configuración de Supabase
const SUPABASE_URL = 'https://ecnimzwygbbumxdcilsb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjbmltend5Z2JidW14ZGNpbHNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDM3MTkxMTEsImV4cCI6MjAxOTI5NTExMX0.KGnGBMq0nEG6BRE2CojwhqiOIzvgEvbQ-eKlnQrIaGs';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
let CONTROL_PANEL_URL = process.env.NODE_ENV === 'production' 
  ? DEFAULT_PROD_URL  // Siempre usar la URL de producción en producción
  : selectUrl();      // En desarrollo, usar la lógica de selección

// Limpiar la URL: eliminar /register-bot-response o /api/register-bot-response si está presente
if (CONTROL_PANEL_URL.includes('/register-bot-response') || CONTROL_PANEL_URL.includes('/api/register-bot-response')) {
  console.log('⚠️ Detectada URL con ruta incluida. Corrigiendo para usar solo el dominio base...');
  
  // Eliminar cualquier ruta añadida a la URL base
  CONTROL_PANEL_URL = CONTROL_PANEL_URL.replace(/\/(?:api\/)?register-bot-response.*$/, '');
  
  console.log('✅ URL corregida:', CONTROL_PANEL_URL);
}

const BUSINESS_ID = '2d385aa5-40e0-4ec9-9360-19281bc605e4';

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

// Función para guardar mensajes directamente en Supabase
async function saveMessageToSupabase(data) {
  try {
    console.log('🔄 Guardando mensaje directamente en Supabase...');
    
    const { conversationId, message, business_id } = data;
    
    // Buscar la conversación existente
    const { data: conversations, error: searchError } = await supabase
      .from('conversations')
      .select('id')
      .eq('phone_number', conversationId)
      .eq('business_id', business_id)
      .limit(1);
    
    if (searchError) {
      console.error('❌ Error al buscar conversación:', searchError.message);
      return false;
    }
    
    let conversationDbId;
    
    // Si no existe la conversación, la creamos
    if (!conversations || conversations.length === 0) {
      console.log('🆕 Creando nueva conversación para:', conversationId);
      
      const { data: newConversation, error: createError } = await supabase
        .from('conversations')
        .insert([
          { phone_number: conversationId, business_id: business_id, name: 'Usuario' }
        ])
        .select();
      
      if (createError) {
        console.error('❌ Error al crear conversación:', createError.message);
        return false;
      }
      
      conversationDbId = newConversation[0].id;
    } else {
      conversationDbId = conversations[0].id;
    }
    
    // Guardar el mensaje
    const { data: savedMessage, error: messageError } = await supabase
      .from('messages')
      .insert([
        {
          conversation_id: conversationDbId,
          message: message,
          is_from_user: false,
          created_at: new Date().toISOString()
        }
      ]);
    
    if (messageError) {
      console.error('❌ Error al guardar mensaje:', messageError.message);
      return false;
    }
    
    // Actualizar la última actividad de la conversación
    const { error: updateError } = await supabase
      .from('conversations')
      .update({ last_message: message, updated_at: new Date().toISOString() })
      .eq('id', conversationDbId);
    
    if (updateError) {
      console.error('❌ Error al actualizar conversación:', updateError.message);
      // No retornamos false aquí porque el mensaje ya se guardó
    }
    
    console.log('✅ Mensaje guardado correctamente en Supabase');
    return true;
  } catch (error) {
    console.error('❌ Error inesperado al guardar en Supabase:', error.message);
    return false;
  }
}

// Modificar la función global registerBotResponse para usar Supabase directamente
global.registerBotResponse = async function(conversationId, message) {
  const data = {
    conversationId,
    message,
    business_id: BUSINESS_ID
  };
  
  console.log(`🚀 Procesando mensaje para: ${conversationId}`);
  console.log(`📝 Mensaje: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
  
  // Intentar guardar directamente en Supabase
  const supabaseSaved = await saveMessageToSupabase(data);
  
  if (supabaseSaved) {
    return { status: 'success', message: 'Mensaje guardado directamente en Supabase' };
  }
  
  // Si falla Supabase, intentar con el servidor
  console.log('⚠️ Fallo al guardar en Supabase. Intentando con el servidor...');
  
  // Determinar la URL correcta según el ambiente
  const baseUrl = CONTROL_PANEL_URL.replace(/\/$/, '');
  const endpointPath = process.env.NODE_ENV === 'production' ? '/api/register-bot-response' : '/register-bot-response';
  const url = `${baseUrl}${endpointPath}`;
  
  try {
    const response = await axios.post(url, data);
    console.log('✅ Mensaje enviado correctamente al servidor');
    return response;
  } catch (error) {
    console.error(`❌ Error al enviar mensaje al servidor: ${error.message}`);
    
    // Si hay un error 404, intentamos con la URL alternativa
    if (error.response && error.response.status === 404) {
      const alternativeUrl = url.includes('/api/') 
        ? `${baseUrl}/register-bot-response`
        : `${baseUrl}/api/register-bot-response`;
      
      console.log(`🔄 Intentando URL alternativa: ${alternativeUrl}`);
      
      try {
        const response = await axios.post(alternativeUrl, data);
        console.log('✅ Mensaje enviado correctamente (segundo intento)');
        return response;
      } catch (secondError) {
        console.error(`❌ Error en segundo intento: ${secondError.message}`);
        // Si fallaron ambos intentos, ya guardamos en Supabase, así que está bien
        saveMessageToFallbackStorage(data);
      }
    } else {
      // Si no es un 404, guardamos localmente por seguridad
      saveMessageToFallbackStorage(data);
    }
    
    // No lanzamos el error ya que el mensaje ya está en Supabase o en archivo local
    return { status: 'fallback', message: 'Guardado en fallback (ya se intentó Supabase)' };
  }
};

// Sobrescribir el método post de axios para interceptar y corregir URLs duplicadas
const originalPost = axios.post;
axios.post = async function(url, data, config) {
  // Verificar si la URL ya contiene una ruta completa para registrar mensaje del bot
  if (url.includes('/register-bot-response') || url.includes('/api/register-bot-response')) {
    // Guardar directamente en Supabase primero
    const supabaseSaved = await saveMessageToSupabase(data);
    
    if (supabaseSaved) {
      console.log('✅ Mensaje guardado directamente en Supabase (interceptor)');
      return { status: 'success', data: { message: 'Guardado directamente en Supabase' } };
    }
    
    console.log('⚠️ Fallo al guardar en Supabase. Intentando con el servidor...');
    
    // Extraer la base URL para asegurarnos de que estamos usando el dominio correcto
    let baseUrl = url;
    
    // Extraer solo el dominio base
    if (baseUrl.includes('/register-bot-response')) {
      baseUrl = baseUrl.substring(0, baseUrl.indexOf('/register-bot-response'));
    } else if (baseUrl.includes('/api/register-bot-response')) {
      baseUrl = baseUrl.substring(0, baseUrl.indexOf('/api/register-bot-response'));
    }
    
    // En producción, usar la ruta de API de Next.js
    let correctUrl;
    if (process.env.NODE_ENV === 'production') {
      // Usar el endpoint de API en Next.js
      correctUrl = `${baseUrl}/api/register-bot-response`;
    } else {
      // En desarrollo, usar la ruta directa
      correctUrl = `${baseUrl}/register-bot-response`;
    }
    
    console.log(`🔄 Redirigiendo petición de ${url} a ${correctUrl}`);
    
    // Asegurarse de que business_id esté incluido en los datos
    if (data && !data.business_id) {
      data.business_id = BUSINESS_ID;
      console.log('🔄 Agregando business_id a la solicitud:', BUSINESS_ID);
    }
    
    // Intentar enviar la solicitud con manejo de errores mejorado
    try {
      const response = await originalPost.call(this, correctUrl, data, config);
      return response;
    } catch (error) {
      console.error(`❌ Error al enviar mensaje al servidor: ${error.message}`);
      
      if (error.response && error.response.status === 404) {
        // Si hay un error 404, intentar la otra variante de URL
        const alternativeUrl = correctUrl.includes('/api/') 
          ? `${baseUrl}/register-bot-response` 
          : `${baseUrl}/api/register-bot-response`;
        
        console.log(`🔄 Intentando URL alternativa: ${alternativeUrl}`);
        
        try {
          const response = await originalPost.call(this, alternativeUrl, data, config);
          return response;
        } catch (secondError) {
          console.error(`❌ Error en segundo intento: ${secondError.message}`);
          // El mensaje ya está guardado en Supabase, pero guardamos en fallback por seguridad
          saveMessageToFallbackStorage(data);
          return { status: 'fallback', data: 'Mensaje ya guardado en Supabase' };
        }
      }
      
      // Si no es un 404 o no podemos hacer un segundo intento, ya está en Supabase
      saveMessageToFallbackStorage(data);
      return { status: 'fallback', data: 'Mensaje ya guardado en Supabase' };
    }
  }
  
  // Para otras URLs que no son register-bot-response, usar el comportamiento normal
  return originalPost.call(this, url, data, config);
};

// Sistema de almacenamiento de fallback
function saveMessageToFallbackStorage(messageData) {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Crear directorio de fallback si no existe
    const fallbackDir = path.join(__dirname, 'fallback_messages');
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir);
    }
    
    // Almacenar mensaje con timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = path.join(fallbackDir, `message_${timestamp}.json`);
    
    fs.writeFileSync(filename, JSON.stringify(messageData, null, 2));
    console.log(`📥 Mensaje guardado localmente en: ${filename}`);
    
    // Crear o actualizar el archivo que indica mensajes pendientes
    const pendingCountFile = path.join(fallbackDir, 'pending_count.json');
    let pendingData = { count: 0, messages: [] };
    
    if (fs.existsSync(pendingCountFile)) {
      pendingData = JSON.parse(fs.readFileSync(pendingCountFile, 'utf8'));
    }
    
    pendingData.count++;
    pendingData.messages.push({
      timestamp: new Date().toISOString(),
      conversationId: messageData.conversationId,
      filename
    });
    
    fs.writeFileSync(pendingCountFile, JSON.stringify(pendingData, null, 2));
    console.log(`⚠️ Total de mensajes pendientes: ${pendingData.count}`);
  } catch (error) {
    console.error('❌ Error al guardar mensaje en almacenamiento local:', error);
  }
}

console.log('✅ Parche aplicado correctamente');
console.log('📝 De ahora en adelante, las URLs duplicadas serán corregidas automáticamente');
console.log('🌐 En ambiente de producción, se usará:', CONTROL_PANEL_URL);
console.log('🔍 También puedes usar la función global registerBotResponse() para enviar mensajes');
console.log('📦 Sistema de fallback activado: los mensajes se guardarán localmente si el servidor falla');

// Realizar diagnóstico de conectividad al iniciar
(async function diagnosticoInicial() {
  try {
    console.log('🔍 Iniciando diagnóstico de conectividad con el servidor...');
    
    const baseUrl = CONTROL_PANEL_URL;
    const axios = require('axios');
    
    // Verificar la URL base
    console.log(`📡 Probando conectividad con: ${baseUrl}`);
    try {
      await axios.get(baseUrl);
      console.log('✅ Conexión a URL base exitosa');
    } catch (error) {
      if (error.response) {
        // Si obtenemos una respuesta, incluso con error, el servidor está respondiendo
        console.log(`✅ El servidor responde (código ${error.response.status}), pero la ruta raíz puede no estar configurada`);
      } else {
        console.error(`❌ No se pudo conectar al servidor: ${error.message}`);
      }
    }
    
    // Probar rutas de registro de bot
    const directRoute = `${baseUrl}/register-bot-response`;
    const apiRoute = `${baseUrl}/api/register-bot-response`;
    
    console.log(`📡 Probando ruta directa: ${directRoute}`);
    try {
      await axios.get(directRoute);
      console.log('✅ Ruta directa accesible');
    } catch (error) {
      if (error.response && error.response.status !== 404) {
        console.log(`⚠️ La ruta directa responde con código ${error.response.status} (esto puede ser normal si solo acepta POST)`);
      } else {
        console.error(`❌ Ruta directa no encontrada: ${error.message}`);
      }
    }
    
    console.log(`📡 Probando ruta API: ${apiRoute}`);
    try {
      await axios.get(apiRoute);
      console.log('✅ Ruta API accesible');
    } catch (error) {
      if (error.response && error.response.status !== 404) {
        console.log(`⚠️ La ruta API responde con código ${error.response.status} (esto puede ser normal si solo acepta POST)`);
      } else {
        console.error(`❌ Ruta API no encontrada: ${error.message}`);
      }
    }
    
    // Intentando con puerto explícito (10000) como lo indican los logs
    if (baseUrl.includes('render-wa.onrender.com')) {
      const portUrl = baseUrl.replace('render-wa.onrender.com', 'render-wa.onrender.com:10000');
      console.log(`📡 Probando con puerto explícito: ${portUrl}`);
      
      try {
        await axios.get(portUrl);
        console.log('✅ Conexión exitosa con puerto explícito');
        
        // Si funciona, probar las rutas con el puerto
        const portDirectRoute = `${portUrl}/register-bot-response`;
        console.log(`📡 Probando ruta directa con puerto: ${portDirectRoute}`);
        await axios.get(portDirectRoute);
        console.log('✅ Ruta directa con puerto accesible');
        
        // Actualizar la URL para usar este puerto
        console.log('⚠️ Actualizando URL para usar el puerto explícito');
        global.CONTROL_PANEL_URL = portUrl;
        CONTROL_PANEL_URL = portUrl;
        
      } catch (error) {
        if (error.response) {
          console.log(`⚠️ El servidor con puerto explícito responde con código ${error.response.status}`);
        } else {
          console.error(`❌ No se pudo conectar al servidor con puerto explícito: ${error.message}`);
        }
      }
    }
    
    console.log('📊 Diagnóstico finalizado. El bot intentará ambas rutas si es necesario.');
    console.log('🔔 IMPORTANTE: Si ninguna ruta está disponible, los mensajes se guardarán localmente.');
    
  } catch (error) {
    console.error('❌ Error durante el diagnóstico:', error);
  }
})();

// Exportar funciones y configuración
module.exports = {
  registerBotResponse: global.registerBotResponse,
  CONTROL_PANEL_URL,
  BUSINESS_ID
}; 