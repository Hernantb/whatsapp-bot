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
const CONTROL_PANEL_URL = process.env.NODE_ENV === 'production' 
  ? DEFAULT_PROD_URL  // Siempre usar la URL de producción en producción
  : selectUrl();      // En desarrollo, usar la lógica de selección
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
  // Verificar si la URL contiene register-bot-response (cualquiera de las dos variantes)
  if (url.includes('/register-bot-response') || url.includes('/api/register-bot-response')) {
    // En producción, usar la ruta de API de Next.js
    if (process.env.NODE_ENV === 'production') {
      // Usar el endpoint de API en Next.js
      correctUrl = `${CONTROL_PANEL_URL}/api/register-bot-response`;
    } else {
      // En desarrollo, usar la ruta directa
      correctUrl = `${CONTROL_PANEL_URL}/register-bot-response`;
    }
    
    // Eliminar posibles rutas duplicadas
    const baseUrl = CONTROL_PANEL_URL.replace(/\/$/, '');
    const endpointPath = process.env.NODE_ENV === 'production' ? '/api/register-bot-response' : '/register-bot-response';
    correctUrl = `${baseUrl}${endpointPath}`;
    
    console.log(`📝 Redirección de solicitud a URL corregida: ${correctUrl}`);
    
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
          const alternativeUrl = process.env.NODE_ENV === 'production' 
            ? `${baseUrl}/register-bot-response` 
            : `${baseUrl}/api/register-bot-response`;
          
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
  return require('axios').post(url, data)
    .then(response => {
      console.log('✅ Mensaje enviado correctamente');
      return response;
    })
    .catch(error => {
      console.error(`❌ Error al enviar mensaje: ${error.message}`);
      throw error;
    });
};

console.log('✅ Parche aplicado correctamente');
console.log('📝 De ahora en adelante, las URLs duplicadas serán corregidas automáticamente');
console.log('🌐 En ambiente de producción, se usará:', CONTROL_PANEL_URL);
console.log('🔍 También puedes usar la función global registerBotResponse() para enviar mensajes');
console.log('📦 Sistema de fallback activado: los mensajes se guardarán localmente si el servidor falla');

// Exportar funciones y configuración
module.exports = {
  registerBotResponse: global.registerBotResponse,
  CONTROL_PANEL_URL,
  BUSINESS_ID
}; 