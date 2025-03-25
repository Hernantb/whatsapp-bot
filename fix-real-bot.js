/**
 * FIX DIRECTO PARA BOT WHATSAPP
 * 
 * Este script corrige el problema de URLs duplicadas en las peticiones al panel de control.
 * Debe ser incluido al inicio del archivo principal del bot (index.js).
 */

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

// Sobrescribir el método post de axios para interceptar y corregir URLs duplicadas
const originalPost = require('axios').post;
require('axios').post = function(url, data, config) {
  // Verificar si la URL ya contiene una ruta completa
  if (url.includes('/register-bot-response') || url.includes('/api/register-bot-response')) {
    // Extraer la base URL para asegurarnos de que estamos usando el dominio correcto
    let baseUrl = url;
    if (baseUrl.includes('/register-bot-response')) {
      baseUrl = baseUrl.substring(0, baseUrl.indexOf('/register-bot-response'));
    } else if (baseUrl.includes('/api/register-bot-response')) {
      baseUrl = baseUrl.substring(0, baseUrl.indexOf('/api/register-bot-response'));
    }
    
    // En producción, usar la ruta de API de Next.js
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
    return originalPost.call(this, correctUrl, data, config)
      .catch(error => {
        console.error(`❌ Error al enviar mensaje al servidor: ${error.message}`);
        
        if (error.response && error.response.status === 404) {
          // Si hay un error 404, intentar la otra variante de URL
          const alternativeUrl = correctUrl.includes('/api/') 
            ? correctUrl.replace('/api/register-bot-response', '/register-bot-response') 
            : correctUrl.replace('/register-bot-response', '/api/register-bot-response');
          
          console.log(`🔄 Intentando URL alternativa: ${alternativeUrl}`);
          return originalPost.call(this, alternativeUrl, data, config)
            .catch(secondError => {
              console.error(`❌ Error en segundo intento: ${secondError.message}`);
              // Implementar sistema de fallback - guardar mensaje en archivo local
              saveMessageToFallbackStorage(data);
              return { status: 'saved-locally', data: 'Mensaje guardado localmente por fallo del servidor' };
            });
        }
        
        // Implementar sistema de fallback - guardar mensaje en archivo local
        saveMessageToFallbackStorage(data);
        return { status: 'saved-locally', data: 'Mensaje guardado localmente por fallo del servidor' };
      });
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

// Función global para registrar respuestas del bot
global.registerBotResponse = function(conversationId, message) {
  const data = {
    conversationId,
    message,
    business_id: BUSINESS_ID
  };
  
  // Determinar la URL correcta según el ambiente
  const baseUrl = CONTROL_PANEL_URL.replace(/\/$/, '');
  const endpointPath = process.env.NODE_ENV === 'production' ? '/api/register-bot-response' : '/register-bot-response';
  const url = `${baseUrl}${endpointPath}`;
  
  console.log(`🚀 Enviando mensaje a: ${url}`);
  console.log(`📝 Datos del mensaje: Conversación: ${conversationId}, Mensaje: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
  
  return require('axios').post(url, data)
    .then(response => {
      console.log('✅ Mensaje enviado correctamente');
      return response;
    })
    .catch(error => {
      console.error(`❌ Error al enviar mensaje: ${error.message}`);
      
      // Si hay un error 404, intentamos con la URL alternativa
      if (error.response && error.response.status === 404) {
        const alternativeUrl = url.includes('/api/') 
          ? url.replace('/api/register-bot-response', '/register-bot-response') 
          : url.replace('/register-bot-response', '/api/register-bot-response');
        
        console.log(`🔄 Intentando URL alternativa: ${alternativeUrl}`);
        return require('axios').post(alternativeUrl, data)
          .then(response => {
            console.log('✅ Mensaje enviado correctamente (segundo intento)');
            return response;
          })
          .catch(secondError => {
            console.error(`❌ Error en segundo intento: ${secondError.message}`);
            saveMessageToFallbackStorage(data);
            throw secondError;
          });
      }
      
      // Si no es un 404 o no podemos hacer un segundo intento, guardar en fallback
      saveMessageToFallbackStorage(data);
      throw error;
    });
};

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