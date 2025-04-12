// Script para probar el flujo completo de envío de mensajes y notificaciones
require('dotenv').config();
const { sendBusinessNotification, checkForNotificationPhrases } = require('./index.js');
const { sendTextMessageGupShup } = require('./sendTextMessageGupShup');
const { createClient } = require('@supabase/supabase-js');

// Configuración
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
const BUSINESS_ID = process.env.BUSINESS_ID || '2d385aa5-40e0-4ec9-9360-19281bc605e4';
const TEST_PHONE = process.env.TEST_PHONE || '5212221192568';

// Inicializar Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Mapeo bidireccional para mantener relación entre números telefónicos e IDs de conversación
const phoneToConversationMap = {};
// Mapeo de IDs de conversación a números telefónicos
const conversationIdToPhoneMap = {};

console.log('🚀 Iniciando prueba de flujo completo');
console.log(`📱 Teléfono de prueba: ${TEST_PHONE}`);

// Función principal para probar el flujo completo
async function testFullFlow() {
  try {
    // 1. Buscar o crear una conversación para la prueba
    console.log('🔍 Buscando conversación existente...');
    let conversationId;
    
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', TEST_PHONE)
        .eq('business_id', BUSINESS_ID)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (data && data.length > 0) {
        conversationId = data[0].id;
        console.log(`✅ Conversación existente encontrada: ${conversationId}`);
      } else {
        console.log('ℹ️ No se encontró conversación existente, creando una nueva...');
        const { data: newConv, error: createError } = await supabase
          .from('conversations')
          .insert([{
            user_id: TEST_PHONE,
            business_id: BUSINESS_ID,
            created_at: new Date().toISOString()
          }])
          .select();
        
        if (createError) {
          throw new Error(`Error creando conversación: ${createError.message}`);
        }
        
        conversationId = newConv[0].id;
        console.log(`✅ Nueva conversación creada: ${conversationId}`);
      }
      
      // Actualizar mapeos
      phoneToConversationMap[TEST_PHONE] = conversationId;
      conversationIdToPhoneMap[conversationId] = TEST_PHONE;
      
    } catch (error) {
      console.error(`❌ Error al gestionar conversación: ${error.message}`);
      return;
    }
    
    // 2. Crear mensajes de prueba
    const testMessages = [
      "Gracias por tu consulta, te ayudaré con información sobre nuestros modelos.",
      "¡Perfecto! Tu cita ha sido confirmada para hoy a las 10. Estoy aquí si requieres algo más.",
      "Lamento que no hayas podido venir hoy, podemos reagendar tu cita si lo deseas.",
      "¡Perfecto! Un asesor te contactará pronto para resolver tus dudas sobre el Cupra León."
    ];
    
    // 3. Probar cada mensaje
    console.log('\n===== INICIANDO PRUEBAS DE MENSAJES =====');
    
    for (const [index, message] of testMessages.entries()) {
      console.log(`\n🧪 PRUEBA ${index + 1}: "${message.substring(0, 30)}..."`);
      
      // Verificar si requiere notificación
      console.log('🔍 Verificando si requiere notificación...');
      const requiresNotification = checkForNotificationPhrases(message);
      console.log(`🔍 Resultado: ${requiresNotification ? '✅ REQUIERE NOTIFICACIÓN' : '❌ NO REQUIERE NOTIFICACIÓN'}`);
      
      // Simular envío de mensaje (sin enviar realmente a WhatsApp)
      console.log('💬 Simulando envío a WhatsApp...');
      // Comentar la siguiente línea para no enviar realmente a WhatsApp
      // const whatsappResult = await sendTextMessageGupShup(TEST_PHONE, message);
      console.log('✅ Mensaje simulado enviado a WhatsApp');
      
      // Si requiere notificación, enviar correo
      if (requiresNotification) {
        console.log('📧 Mensaje requiere notificación, enviando correo...');
        try {
          const result = await sendBusinessNotification(conversationId, message, TEST_PHONE);
          console.log(`📧 Resultado de notificación: ${result ? '✅ ENVIADA EXITOSAMENTE' : '❌ FALLÓ EL ENVÍO'}`);
        } catch (error) {
          console.error(`❌ Error enviando notificación: ${error.message}`);
        }
      }
      
      // Simular registro en base de datos
      console.log('🗄️ Simulando registro en base de datos...');
      try {
        const { data, error } = await supabase
          .from('messages')
          .insert([{
            conversation_id: conversationId,
            content: message,
            sender_type: 'bot',
            created_at: new Date().toISOString(),
            business_id: BUSINESS_ID,
            sent_to_whatsapp: true
          }])
          .select();
        
        if (error) {
          console.error(`❌ Error registrando mensaje: ${error.message}`);
        } else {
          console.log(`✅ Mensaje registrado en base de datos, ID: ${data[0].id}`);
        }
      } catch (dbError) {
        console.error(`❌ Error de base de datos: ${dbError.message}`);
      }
      
      // Breve pausa entre mensajes
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n✅ PRUEBAS COMPLETADAS EXITOSAMENTE');
    console.log(`📊 Total mensajes probados: ${testMessages.length}`);
    console.log(`🔍 Verifica tu correo (${process.env.NOTIFICATION_EMAIL || 'joaquinisaza@hotmail.com'}) para las notificaciones`);
    
  } catch (error) {
    console.error('❌ ERROR GENERAL:', error);
    console.error(error.stack);
  }
}

// Ejecutar la prueba
testFullFlow(); 