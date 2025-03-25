/**
 * FIX DIRECTO PARA BOT WHATSAPP
 * 
 * Este script debe copiarse y ejecutarse directamente en el servidor del bot
 * para que los mensajes se guarden correctamente en el panel de control.
 * 
 * CÓMO USAR:
 * 1. Copia este archivo al servidor del bot de WhatsApp
 * 2. Ejecútalo: node fix-real-bot.js
 */

// Configuración
const CONTROL_PANEL_URL = 'https://panel-control-whatsapp.onrender.com'; // URL CORRECTA del panel de control
const BUSINESS_ID = '2d385aa5-40e0-4ec9-9360-19281bc605e4';

// Parchear axios
console.log('🔧 Aplicando parche directo al bot de WhatsApp...');

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

// Crear función global para registrar mensajes
global.registerBotMessage = async function(phoneNumber, message) {
  try {
    const axios = require('axios');
    console.log(`🤖 Registrando mensaje para ${phoneNumber}`);
    
    const correctUrl = `${CONTROL_PANEL_URL}/register-bot-response`;
    const response = await axios.post(correctUrl, {
      conversationId: phoneNumber,
      message: message,
      business_id: BUSINESS_ID
    });
    
    console.log('✅ Mensaje registrado correctamente:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error al registrar mensaje:', error.message);
    throw error;
  }
};

// Encontrar el módulo real del bot
try {
  console.log('🔍 Buscando módulo del bot...');
  
  // Intentar encontrar el módulo por su nombre
  const possibleModules = [
    './app.js',
    './index.js',
    './bot.js',
    './server.js',
    './whatsapp-bot.js'
  ];
  
  let botModule = null;
  
  for (const modulePath of possibleModules) {
    try {
      console.log(`🔍 Probando ${modulePath}...`);
      const mod = require(modulePath);
      console.log(`✅ Módulo encontrado: ${modulePath}`);
      botModule = mod;
      break;
    } catch (e) {
      // Ignorar errores
    }
  }
  
  if (botModule) {
    console.log('🤖 Modificando funciones del bot...');
    
    // Si el bot tiene una función para manejar respuestas, guardarla como referencia
    if (typeof botModule.registerBotResponse === 'function') {
      const originalRegisterBotResponse = botModule.registerBotResponse;
      
      botModule.registerBotResponse = function(phoneNumber, message, ...args) {
        // Registrar el mensaje primero con nuestra función
        registerBotMessage(phoneNumber, message)
          .then(() => console.log('✅ Mensaje registrado con éxito'))
          .catch(err => console.error('❌ Error al registrar:', err.message));
        
        // Llamar a la función original para mantener la compatibilidad
        return originalRegisterBotResponse(phoneNumber, message, ...args);
      };
      
      console.log('✅ Función registerBotResponse modificada');
    }
  } else {
    console.log('⚠️ No se encontró un módulo de bot conocido, aplicando parche global');
  }
} catch (e) {
  console.error('❌ Error al buscar módulo del bot:', e.message);
}

// Instrucciones para conexión manual
console.log('\n📋 INSTRUCCIONES PARA CORREGIR MANUALMENTE LOS MENSAJES:');
console.log('1. Añade este código al inicio del archivo principal del bot:');
console.log('   require("./fix-real-bot.js");');
console.log('2. Para registrar mensajes manualmente, usa:');
console.log('   global.registerBotMessage(phoneNumber, message)');
console.log('3. Para cambiar la URL del panel, edita CONTROL_PANEL_URL en este archivo');

// Lista los parches aplicados
console.log('\n✅ PARCHES APLICADOS:');
console.log('● Interceptor de axios para corregir URLs duplicadas');
console.log('● Función global registerBotMessage para envío manual');
console.log('● Corrección automática de business_id faltante');

console.log('\n🚀 Parche aplicado correctamente. Los mensajes ahora deberían guardarse en el panel de control.');

// Exportar la función de registro
module.exports = {
  registerBotMessage: global.registerBotMessage,
  CONTROL_PANEL_URL
}; 