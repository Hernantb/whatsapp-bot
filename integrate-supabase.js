/**
 * INTEGRADOR DE SUPABASE CON BOT WHATSAPP
 * 
 * Este archivo integra las funciones de fix-real-bot.js con el bot principal
 * para permitir el correcto registro de mensajes en Supabase.
 */

// Importar las funciones de fix-real-bot.js
const { registerBotResponse, saveMessageToSupabase, SUPABASE_URL, SUPABASE_KEY } = require('./fix-real-bot');

// Hacer disponible la función registerBotResponse globalmente con un nombre diferente
// para evitar conflictos con la función existente en index.js
global.saveToSupabase = registerBotResponse;

// Mostrar confirmación de integración
console.log('🔄 Integrador de Supabase cargado correctamente');
console.log('✅ Función saveToSupabase disponible globalmente');
console.log(`ℹ️ Usando Supabase en: ${SUPABASE_URL}`);

// Exportar las funciones para que puedan ser importadas directamente
module.exports = {
  saveToSupabase: registerBotResponse,
  saveMessageToSupabase
}; 