/**
 * PARCHE GLOBAL PARA EL BOT DE WHATSAPP
 * 
 * Este archivo define la función registerBotResponse globalmente
 * para garantizar que esté disponible en cualquier parte del código.
 */

// Importar las funciones de fix-real-bot.js
const { registerBotResponse: supabaseRegister, SUPABASE_URL } = require('./fix-real-bot');

// Definir la función global registerBotResponse que guardará en Supabase
global.registerBotResponse = async function(conversationId, message, business_id) {
  console.log('🔄 Llamada a global.registerBotResponse interceptada');
  
  try {
    // Guardar mensaje en Supabase
    await supabaseRegister(conversationId, message);
    console.log('✅ Mensaje guardado en Supabase correctamente');
    return { success: true, message: "Mensaje guardado en Supabase" };
  } catch (error) {
    console.error('❌ Error al guardar mensaje en Supabase:', error.message);
    return { success: false, error: error.message };
  }
};

// Mostrar confirmación
console.log('🔧 PARCHE GLOBAL APLICADO');
console.log('✅ Función global.registerBotResponse definida');
console.log(`ℹ️ Guardando mensajes en Supabase: ${SUPABASE_URL}`);

// También exportamos la función por si se quiere usar como módulo
module.exports = {
  registerBotResponse: global.registerBotResponse
}; 