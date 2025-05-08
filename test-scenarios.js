const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');

dotenv.config({ path: '.env.local' });

// Configuración de Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Test de escenarios para mensajes de seguimiento:
 * 
 * Escenario 1: Cliente no responde al mensaje de seguimiento
 * - Crear conversación con último mensaje del bot (2 minutos atrás)
 * - El sistema debe enviar mensaje de seguimiento
 * - Al no haber respuesta, el sistema NO debe enviar un segundo mensaje de seguimiento
 * 
 * Escenario 2: Cliente responde al mensaje de seguimiento, luego no contesta
 * - Crear conversación con último mensaje del bot (2 minutos atrás)
 * - El sistema debe enviar mensaje de seguimiento
 * - Simular respuesta del cliente
 * - Simular respuesta del bot
 * - Dejar pasar tiempo sin respuesta del cliente
 * - El sistema debe enviar un segundo mensaje de seguimiento
 */

// Obtener el business_id (implementado según el código existente)
async function getBusinessId() {
  try {
    console.log('🔍 Buscando business con número +15557033313...');
    
    // Buscamos el business con el número específico
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('whatsapp_number', '+15557033313')
      .single();

    if (error) {
      console.error('❌ Error buscando business:', JSON.stringify(error, null, 2));
      
      // Intentar obtener cualquier negocio de la base de datos
      const { data: anyBusiness, error: anyError } = await supabase
        .from('businesses')
        .select('id, name')
        .limit(1)
        .single();
        
      if (anyError || !anyBusiness) {
        console.error('❌ No se encontró ningún negocio en la base de datos');
        return null;
      }
      
      console.log('✅ Se utilizará el negocio:', anyBusiness.name, 'con ID:', anyBusiness.id);
      return anyBusiness.id;
    }

    console.log('✅ Business encontrado:', data);
    return data.id;
  } catch (error) {
    console.error('❌ Error general en getBusinessId:', error);
    return null;
  }
}

// Verificar si el sistema envía mensaje de seguimiento
async function checkFollowUpMessage(conversationId, expectedFollowUpCount) {
  try {
    console.log(`\n🔍 Verificando mensajes de seguimiento para conversación ${conversationId}...`);
    
    // Obtener todos los mensajes de la conversación
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('❌ Error al obtener mensajes:', error);
      return false;
    }
    
    console.log(`📊 Mensajes en la conversación: ${messages.length}`);
    
    // Contar los mensajes de seguimiento
    const followUpMessages = messages.filter(msg => 
      msg.sender_type === 'bot' && 
      (msg.content.includes('¿Te fue útil') || 
       msg.content.includes('no has respondido') ||
       msg.content.includes('¿Te gustaría') || 
       msg.content.includes('Noté que') ||
       msg.content.includes('¿Hay algo más'))
    );
    
    console.log(`📊 Mensajes de seguimiento detectados: ${followUpMessages.length}`);
    console.log(`📊 Mensajes de seguimiento esperados: ${expectedFollowUpCount}`);
    
    if (followUpMessages.length === expectedFollowUpCount) {
      console.log('✅ El sistema envió la cantidad esperada de mensajes de seguimiento');
      
      if (followUpMessages.length > 0) {
        // Mostrar el último mensaje de seguimiento
        const lastFollowUp = followUpMessages[followUpMessages.length - 1];
        console.log(`📝 Último mensaje de seguimiento: "${lastFollowUp.content}"`);
      }
      
      return true;
    } else {
      console.log('❌ El sistema no envió la cantidad esperada de mensajes de seguimiento');
      return false;
    }
  } catch (error) {
    console.error('❌ Error al verificar mensajes de seguimiento:', error);
    return false;
  }
}

// Ejecutar un ciclo de verificación de seguimiento en el servidor
async function triggerFollowUpCheck() {
  try {
    console.log('\n⏱️ Ejecutando verificación de mensajes de seguimiento en el servidor...');
    
    // Hacer una petición al endpoint que acabamos de crear para forzar la verificación
    const response = await fetch('http://localhost:7777/api/simulate-followup', {
      method: 'GET'
    });
    
    const result = await response.json();
    console.log('📊 Resultado de la petición:', result);
    
    return result.success;
  } catch (error) {
    console.error('❌ Error al ejecutar verificación de seguimiento:', error);
    return false;
  }
}

// Escenario 1: Cliente no responde al mensaje de seguimiento
async function testScenario1() {
  try {
    console.log('\n🧪 === ESCENARIO 1: CLIENTE NO RESPONDE AL MENSAJE DE SEGUIMIENTO ===');
    
    // Crear una conversación de prueba
    const conversationId = uuidv4();
    const phoneNumber = '5215512345678';
    const businessId = await getBusinessId();
    
    console.log(`🔍 Creando conversación de prueba con ID: ${conversationId}`);
    
    // Tiempos para la simulación
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const fourMinAgo = new Date(now.getTime() - 4 * 60 * 1000);
    const threeMinAgo = new Date(now.getTime() - 3 * 60 * 1000);
    const twoMinAgo = new Date(now.getTime() - 2 * 60 * 1000);
    
    // Insertar conversación de prueba
    const { error: convoError } = await supabase
      .from('conversations')
      .insert([{
        id: conversationId,
        user_id: phoneNumber,
        business_id: businessId,
        last_message: 'Nuestra agencia está ubicada en Av. Universidad 1000, Col. Del Valle.',
        last_message_time: twoMinAgo.toISOString(),
        is_bot_active: true,
        sender_name: 'Usuario Prueba Escenario 1',
        created_at: fiveMinAgo.toISOString()
      }]);
    
    if (convoError) {
      console.error('❌ Error al crear conversación:', convoError);
      return false;
    }
    
    // Mensajes iniciales
    const messages = [
      {
        content: '¿Dónde está ubicada su agencia?',
        sender_type: 'user',
        created_at: threeMinAgo.toISOString()
      },
      {
        content: 'Nuestra agencia está ubicada en Av. Universidad 1000, Col. Del Valle.',
        sender_type: 'bot',
        created_at: twoMinAgo.toISOString()
      }
    ];
    
    // Insertar mensajes
    for (const msg of messages) {
      const { error: msgError } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          content: msg.content,
          sender_type: msg.sender_type,
          read: true,
          created_at: msg.created_at
        }]);
      
      if (msgError) {
        console.error('❌ Error al insertar mensaje:', msgError);
        return false;
      }
    }
    
    console.log('✅ Conversación y mensajes creados correctamente');
    
    // Ejecutar verificación para generar primer mensaje de seguimiento
    await triggerFollowUpCheck();
    
    // Verificar que se generó el mensaje de seguimiento
    let result = await checkFollowUpMessage(conversationId, 1);
    
    if (!result) {
      console.log('❌ No se generó el primer mensaje de seguimiento');
      return false;
    }
    
    console.log('✅ Primer mensaje de seguimiento enviado correctamente');
    console.log('\n⏱️ Simulando paso del tiempo (2 minutos) sin respuesta del cliente...');
    
    // Ejecutar nuevamente la verificación para comprobar que NO se genera un segundo mensaje
    await triggerFollowUpCheck();
    
    // Verificar que NO se generó un segundo mensaje de seguimiento
    result = await checkFollowUpMessage(conversationId, 1);
    
    if (result) {
      console.log('✅ CORRECTO: El sistema NO envió un segundo mensaje de seguimiento');
      return true;
    } else {
      console.log('❌ INCORRECTO: El sistema envió más mensajes de los esperados');
      return false;
    }
  } catch (error) {
    console.error('❌ Error en el escenario 1:', error);
    return false;
  }
}

// Escenario 2: Cliente responde al mensaje de seguimiento, luego no contesta
async function testScenario2() {
  try {
    console.log('\n🧪 === ESCENARIO 2: CLIENTE RESPONDE Y LUEGO NO CONTESTA ===');
    
    // Crear una conversación de prueba
    const conversationId = uuidv4();
    const phoneNumber = '5215587654321';
    const businessId = await getBusinessId();
    
    console.log(`🔍 Creando conversación de prueba con ID: ${conversationId}`);
    
    // Tiempos para la simulación
    const now = new Date();
    const sevenMinAgo = new Date(now.getTime() - 7 * 60 * 1000);
    const sixMinAgo = new Date(now.getTime() - 6 * 60 * 1000);
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const fourMinAgo = new Date(now.getTime() - 4 * 60 * 1000);
    const threeMinAgo = new Date(now.getTime() - 3 * 60 * 1000);
    const twoMinAgo = new Date(now.getTime() - 2 * 60 * 1000);
    
    // Insertar conversación de prueba
    const { error: convoError } = await supabase
      .from('conversations')
      .insert([{
        id: conversationId,
        user_id: phoneNumber,
        business_id: businessId,
        last_message: 'Me encantaría mostrarte todos nuestros modelos disponibles. ¿Te interesa alguno en particular?',
        last_message_time: twoMinAgo.toISOString(),
        is_bot_active: true,
        sender_name: 'Usuario Prueba Escenario 2',
        created_at: sevenMinAgo.toISOString()
      }]);
    
    if (convoError) {
      console.error('❌ Error al crear conversación:', convoError);
      return false;
    }
    
    // Mensajes iniciales
    const messages = [
      {
        content: '¿Tienen autos SEAT disponibles para entrega inmediata?',
        sender_type: 'user',
        created_at: sixMinAgo.toISOString()
      },
      {
        content: 'Sí, tenemos varios modelos disponibles para entrega inmediata.',
        sender_type: 'bot',
        created_at: fiveMinAgo.toISOString()
      },
      // Primer mensaje de seguimiento (simulado)
      {
        content: '¿Te gustaría conocer qué modelos tenemos disponibles para entrega inmediata?',
        sender_type: 'bot',
        created_at: fourMinAgo.toISOString()
      },
      // Respuesta del cliente al seguimiento
      {
        content: 'Sí, me gustaría saber qué modelos tienen.',
        sender_type: 'user',
        created_at: threeMinAgo.toISOString()
      },
      // Respuesta del bot al cliente
      {
        content: 'Me encantaría mostrarte todos nuestros modelos disponibles. ¿Te interesa alguno en particular?',
        sender_type: 'bot',
        created_at: twoMinAgo.toISOString()
      }
    ];
    
    // Insertar mensajes
    for (const msg of messages) {
      const { error: msgError } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          content: msg.content,
          sender_type: msg.sender_type,
          read: true,
          created_at: msg.created_at
        }]);
      
      if (msgError) {
        console.error('❌ Error al insertar mensaje:', msgError);
        return false;
      }
    }
    
    console.log('✅ Conversación y mensajes creados correctamente');
    
    // Ejecutar verificación para generar segundo mensaje de seguimiento
    // (ya que el cliente no respondió a la última pregunta del bot)
    await triggerFollowUpCheck();
    
    // Verificar que se generó un segundo mensaje de seguimiento
    // (esperamos 2 mensajes de seguimiento en total)
    const result = await checkFollowUpMessage(conversationId, 2);
    
    if (result) {
      console.log('✅ CORRECTO: El sistema envió un segundo mensaje de seguimiento');
      return true;
    } else {
      console.log('❌ INCORRECTO: El sistema no envió el segundo mensaje de seguimiento esperado');
      return false;
    }
  } catch (error) {
    console.error('❌ Error en el escenario 2:', error);
    return false;
  }
}

// Función principal para ejecutar todos los escenarios
async function runTests() {
  try {
    console.log('🚀 Iniciando pruebas de escenarios de mensajes de seguimiento...');
    
    // Ejecutar los escenarios
    const scenario1Result = await testScenario1();
    const scenario2Result = await testScenario2();
    
    // Resultados
    console.log('\n📊 === RESULTADOS DE LAS PRUEBAS ===');
    console.log(`Escenario 1 (No responde al seguimiento): ${scenario1Result ? '✅ ÉXITO' : '❌ FALLO'}`);
    console.log(`Escenario 2 (Responde y luego no contesta): ${scenario2Result ? '✅ ÉXITO' : '❌ FALLO'}`);
    
    return {
      scenario1: scenario1Result,
      scenario2: scenario2Result
    };
  } catch (error) {
    console.error('❌ Error general en las pruebas:', error);
    return {
      scenario1: false,
      scenario2: false,
      error: error.message
    };
  } finally {
    console.log('\n✅ Pruebas finalizadas');
  }
}

// Ejecutar pruebas
runTests()
  .then(results => {
    console.log('📋 Resultados finales:', JSON.stringify(results, null, 2));
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }); 