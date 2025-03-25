/**
 * FIX DIRECTO PARA BOT WHATSAPP
 * 
 * Este script corrige el problema de URLs duplicadas en las peticiones al panel de control.
 * Debe ser incluido al inicio del archivo principal del bot (index.js).
 */

// Configuración
const CONTROL_PANEL_URL = 'https://panel-control-whatsapp.onrender.com'; // URL correcta del panel
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
        let correctUrl = `${CONTROL_PANEL_URL}/register-bot-response`;
        
        // Eliminar cualquier duplicación de ruta
        correctUrl = correctUrl.replace(/\/register-bot-response\/register-bot-response$/, '/register-bot-response');
        
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
    console.log(`🤖 Registrando respuesta para ${phoneNumber}`);
    
    const correctUrl = `${CONTROL_PANEL_URL}/register-bot-response`;
    console.log(`📤 Enviando a: ${correctUrl}`);
    
    const payload = {
      conversationId: phoneNumber,
      message: message,
      business_id: businessId
    };
    
    const response = await axios.post(correctUrl, payload);
    console.log('✅ Respuesta registrada correctamente:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error al registrar respuesta:', error.message);
    if (error.response) {
      console.error('Detalles de error:', error.response.data);
    }
    throw error;
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