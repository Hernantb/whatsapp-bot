// Script de prueba para el parche de URL del bot
require('./global-patch.js');

// Definir datos de prueba
const phoneNumber = '5212221192568';
const message = 'Este es un mensaje de prueba enviado a través del parche corregido.';
const businessId = '2d385aa5-40e0-4ec9-9360-19281bc605e4';

console.log('🧪 Iniciando prueba del parche...');
console.log(`📱 Número de teléfono: ${phoneNumber}`);
console.log(`💬 Mensaje: ${message}`);
console.log(`🏢 ID de negocio: ${businessId}`);
console.log(`🌐 Ambiente: ${process.env.NODE_ENV === 'production' ? 'Producción' : 'Desarrollo'}`);

// Ejecutar la prueba
async function runTest() {
  try {
    console.log('🔄 Enviando mensaje de prueba al panel de control...');
    
    // Usar la función global registerBotResponse
    const result = await global.registerBotResponse(phoneNumber, message, businessId);
    
    console.log('📋 Resultado:', result);
    
    if (result.success === false) {
      console.error('❌ La prueba falló.');
      process.exit(1);
    } else {
      console.log('✅ Prueba completada exitosamente!');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
    process.exit(1);
  }
}

// Ejecutar la prueba
runTest(); 