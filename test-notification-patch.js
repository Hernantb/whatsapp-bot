/**
 * Script para probar el funcionamiento del módulo de notificaciones
 */

// Importar el módulo de notificaciones
const notificationModule = require('./notification-patch');

console.log('🔍 TEST: Iniciando prueba del módulo de notificaciones');

// Verificar que se importó correctamente
console.log('✅ Módulo importado correctamente');
console.log('📋 Funciones disponibles:', Object.keys(notificationModule));

// Probar la función checkForNotificationPhrases
const testMessages = [
  { text: 'Hola, ¿cómo estás?', shouldTrigger: false },
  { text: 'No puedo ayudarte con eso', shouldTrigger: true },
  { text: 'Necesitarás hablar con un agente humano', shouldTrigger: true },
  { text: 'Necesitas contactar directamente', shouldTrigger: true },
  { text: 'No hay problema, lo resolveré', shouldTrigger: false }
];

console.log('\n🧪 Probando función checkForNotificationPhrases:');
testMessages.forEach(test => {
  const result = notificationModule.checkForNotificationPhrases(test.text);
  console.log(`📝 Mensaje: "${test.text}"`);
  console.log(`🔍 Resultado: ${result.requiresNotification ? '✅ REQUIERE NOTIFICACIÓN' : '❌ NO REQUIERE NOTIFICACIÓN'}`);
  if (result.requiresNotification) {
    console.log(`🔍 Coincidencias: ${result.matches.join(', ')}`);
  }
  console.log(`✓ Resultado esperado: ${test.shouldTrigger ? 'REQUIERE NOTIFICACIÓN' : 'NO REQUIERE NOTIFICACIÓN'}`);
  console.log('---');
});

// Probar la función processMessageForNotification
async function testProcessMessageForNotification() {
  console.log('\n🧪 Probando función processMessageForNotification:');
  
  const testMessage = 'No puedo ayudarte con eso, necesitas contactar directamente.';
  const conversationId = 'test-conversation-id';
  const phoneNumber = '1234567890';
  
  console.log(`📝 Mensaje: "${testMessage}"`);
  console.log(`📞 Número: ${phoneNumber}`);
  console.log(`🆔 Conversación: ${conversationId}`);
  
  try {
    const result = await notificationModule.processMessageForNotification(
      testMessage, 
      'bot', 
      conversationId, 
      phoneNumber
    );
    
    console.log('✅ Resultado:', result);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Probar la función sendBusinessNotification
async function testSendBusinessNotification() {
  console.log('\n🧪 Probando función sendBusinessNotification:');
  
  const testMessage = 'No puedo ayudarte con eso, necesitas contactar directamente.';
  const conversationId = 'test-conversation-id';
  const phoneNumber = '1234567890';
  
  console.log(`📝 Mensaje: "${testMessage}"`);
  console.log(`📞 Número: ${phoneNumber}`);
  console.log(`🆔 Conversación: ${conversationId}`);
  
  try {
    const result = await notificationModule.sendBusinessNotification(
      conversationId, 
      testMessage, 
      phoneNumber
    );
    
    console.log('✅ Resultado:', result);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ejecutar pruebas adicionales
async function runAdditionalTests() {
  await testProcessMessageForNotification();
  await testSendBusinessNotification();
  console.log('\n✅ TODAS LAS PRUEBAS COMPLETADAS');
}

// Ejecutar pruebas
runAdditionalTests(); 