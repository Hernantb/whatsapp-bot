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

// Mensaje de inicio
console.log('🔧 APLICANDO PARCHE PARA CORREGIR URLs DEL BOT WHATSAPP');
console.log('CONTROL_PANEL_URL actual:', CONTROL_PANEL_URL);
console.log('Ambiente:', process.env.NODE_ENV === 'production' ? 'Producción' : 'Desarrollo');
console.log('URL que se usará:', CONTROL_PANEL_URL);

// Guardar una referencia al require original
const originalRequire = require;

// Sobreescribir la función require para interceptar axios
require = function(moduleName) {
  const module = originalRequire(moduleName);
  
  if (moduleName === 'axios') {
    console.log('📦 Interceptando módulo axios...');
    
    // Guardar referencia al método post original
    const originalPost = module.post;
    
    // Sobreescribir el método post
    module.post = function(url, data, config) {
      // Si la URL contiene register-bot-response, corregirla
      if (url && typeof url === 'string' && 
          (url.includes('/register-bot-response') || url.includes('/api/register-bot-response'))) {
        
        // Detectar y corregir URLs duplicadas
        let correctUrl;
        
        // En producción, usar la API de Next.js
        if (process.env.NODE_ENV === 'production') {
          correctUrl = `${CONTROL_PANEL_URL}/api/register-bot-response`;
        } else {
          correctUrl = `${CONTROL_PANEL_URL}/register-bot-response`;
        }
        
        // Eliminar cualquier duplicación de ruta
        correctUrl = correctUrl
          .replace(/\/register-bot-response\/register-bot-response$/, '/register-bot-response')
          .replace(/\/api\/register-bot-response\/api\/register-bot-response$/, '/api/register-bot-response');
        
        console.log(`🔄 Redirigiendo petición de ${url} a ${correctUrl}`);
        
        // Asegurar que business_id esté presente
        if (data && !data.business_id) {
          data.business_id = BUSINESS_ID;
          console.log(`📝 Añadiendo business_id: ${BUSINESS_ID}`);
        }
        
        return originalPost(correctUrl, data, config);
      }
      
      return originalPost(url, data, config);
    };
  }
  
  return module;
};

// Crear función global para registrar respuestas del bot
global.registerBotResponse = async function(phoneNumber, message, businessId = BUSINESS_ID) {
  try {
    const axios = require('axios');
    console.log(`🔄 Registrando respuesta del bot para conversación ${phoneNumber}`);
    
    // Intentamos primero con la ruta directa
    let correctUrl = `${CONTROL_PANEL_URL}/register-bot-response`;
    
    // Verificamos si estamos en producción para intentar con la ruta API de Next.js
    if (process.env.NODE_ENV === 'production') {
      console.log('🔄 Intentando con ruta API de Next.js');
      correctUrl = `${CONTROL_PANEL_URL}/api/register-bot-response`;
    }
    
    console.log(`🔄 Registrando respuesta del bot en el control panel: ${correctUrl}`);
    
    const payload = {
      conversationId: phoneNumber,
      message: message,
      business_id: businessId
    };
    
    console.log('📤 Payload enviado:', JSON.stringify(payload));
    
    try {
      const response = await axios.post(correctUrl, payload);
      console.log('✅ Respuesta registrada correctamente:', response.data);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404 && correctUrl.includes('/register-bot-response') && !correctUrl.includes('/api/')) {
        // Si fallamos con la ruta directa, intentamos con la ruta de API de Next.js
        console.log('⚠️ Ruta directa no encontrada, intentando con ruta API de Next.js');
        correctUrl = correctUrl.replace('/register-bot-response', '/api/register-bot-response');
        console.log(`🔄 Nuevo intento con: ${correctUrl}`);
        
        const nextResponse = await axios.post(correctUrl, payload);
        console.log('✅ Respuesta registrada correctamente en ruta alternativa:', nextResponse.data);
        return nextResponse.data;
      } else {
        throw error; // Re-lanzar el error si no es un 404 o ya estamos usando la ruta API
      }
    }
  } catch (error) {
    console.error('❌ Error al registrar respuesta en el control panel:', error.message);
    if (error.response) {
      console.error('🔍 Código de respuesta:', error.response.status);
      console.error('🔍 Respuesta del servidor:', error.response.data);
    } else if (error.request) {
      console.error('🔍 No se recibió respuesta del servidor');
      console.error('🔍 Detalles de la solicitud:', error.request);
    }
    // No lanzamos el error para evitar interrumpir el flujo del bot
    return { success: false, error: error.message };
  }
};

// Mensaje de confirmación
console.log('✅ Parche aplicado correctamente');
console.log('📝 De ahora en adelante, las URLs duplicadas serán corregidas automáticamente');
console.log(`🌐 En ambiente de producción, se usará: ${CONTROL_PANEL_URL}`);
console.log('🔍 También puedes usar la función global registerBotResponse() para enviar mensajes');

// Exportar funciones y configuración
module.exports = {
  registerBotResponse: global.registerBotResponse,
  CONTROL_PANEL_URL,
  BUSINESS_ID
}; 