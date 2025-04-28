// Test script para verificar el envío de notificaciones por email
const axios = require('axios');

// Configuración
const SERVER_URL = 'http://localhost:7777';
const WHATSAPP_BOT_URL = 'http://localhost:3095';
const TEST_CONVERSATION_ID = '4a42aa05-2ffd-418b-aa52-29e7c571eee8';
const TEST_PHONE_NUMBER = '5212221192568';

// Mensaje de prueba con la frase que debe activar notificación
const TEST_MESSAGE = '¡Perfecto! Tu cita ha sido confirmada para mañana a la 1:23.';

// Función principal
async function main() {
  console.log('\n🧪 INICIANDO TEST DE NOTIFICACIÓN');
  console.log(`🧪 Mensaje a probar: "${TEST_MESSAGE}"`);
  console.log(`🧪 ID de conversación: ${TEST_CONVERSATION_ID}`);
  console.log(`🧪 Número de teléfono: ${TEST_PHONE_NUMBER}`);
  
  try {
    // 1. Probar directamente el endpoint del servidor principal
    console.log('\n📡 Probando endpoint de servidor principal...');
    const serverResponse = await axios.post(`${SERVER_URL}/api/test-notification`, {
      conversationId: TEST_CONVERSATION_ID,
      message: TEST_MESSAGE,
      clientPhone: TEST_PHONE_NUMBER
    });
    
    console.log('✅ Respuesta del servidor:');
    console.log(JSON.stringify(serverResponse.data, null, 2));
    
    // 2. Probar la API de procesamiento de mensajes
    console.log('\n📡 Probando API de procesamiento de mensajes...');
    const processResponse = await axios.post(`${SERVER_URL}/api/process-whatsapp-message`, {
      conversationId: TEST_CONVERSATION_ID,
      message: TEST_MESSAGE,
      isFromBot: true,
      phoneNumber: TEST_PHONE_NUMBER
    });
    
    console.log('✅ Respuesta del procesamiento:');
    console.log(JSON.stringify(processResponse.data, null, 2));
    
    // 3. Probar envío directo a través del bot WhatsApp
    console.log('\n📡 Probando envío desde bot WhatsApp...');
    const botResponse = await axios.post(`${WHATSAPP_BOT_URL}/api/send-notification`, {
      conversationId: TEST_CONVERSATION_ID, 
      botMessage: TEST_MESSAGE,
      clientPhoneNumber: TEST_PHONE_NUMBER
    });
    
    console.log('✅ Respuesta del bot WhatsApp:');
    console.log(JSON.stringify(botResponse.data, null, 2));
    
    console.log('\n🎉 TEST COMPLETADO CON ÉXITO');
    
  } catch (error) {
    console.error('\n❌ ERROR EN TEST DE NOTIFICACIÓN:');
    if (error.response) {
      console.error('Respuesta de error del servidor:');
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

// Ejecutar test
main(); 