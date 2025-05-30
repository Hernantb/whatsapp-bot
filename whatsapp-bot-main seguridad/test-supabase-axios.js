/**
 * Test de conexión a Supabase usando axios directamente
 * Este script prueba la viabilidad de usar axios como alternativa a fetch
 * para conectarse directamente a la API REST de Supabase.
 */

const axios = require('axios');

// Configuración de Supabase
const SUPABASE_URL = 'https://ecnimzwygbbumxdcilsb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjbmltend5Z2JidW14ZGNpbHNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDM3MTkxMTEsImV4cCI6MjAxOTI5NTExMX0.KGnGBMq0nEG6BRE2CojwhqiOIzvgEvbQ-eKlnQrIaGs';
const BUSINESS_ID = '2d385aa5-40e0-4ec9-9360-19281bc605e4';

// Headers para las solicitudes a Supabase
const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

// Datos de ejemplo
const phoneNumber = '5212221192568';
const message = 'Este es un mensaje de prueba Supabase+axios ' + new Date().toISOString();

async function testSupabaseWithAxios() {
  console.log('🧪 Iniciando prueba de Supabase con axios...');
  
  try {
    // 1. Buscar conversación existente
    console.log('🔍 Buscando conversación para:', phoneNumber);
    const searchUrl = `${SUPABASE_URL}/rest/v1/conversations?phone_number=eq.${encodeURIComponent(phoneNumber)}&business_id=eq.${encodeURIComponent(BUSINESS_ID)}&select=id`;
    
    const { data: conversations } = await axios.get(searchUrl, { headers });
    console.log('📊 Resultado de búsqueda:', JSON.stringify(conversations));
    
    let conversationId;
    
    // 2. Crear o usar conversación existente
    if (conversations && conversations.length > 0) {
      conversationId = conversations[0].id;
      console.log('✅ Conversación encontrada con ID:', conversationId);
    } else {
      console.log('🆕 Creando nueva conversación...');
      
      const createUrl = `${SUPABASE_URL}/rest/v1/conversations`;
      const newConversation = {
        phone_number: phoneNumber,
        business_id: BUSINESS_ID,
        name: 'Usuario de Prueba',
        last_message: message,
        updated_at: new Date().toISOString()
      };
      
      const { data: createdConversation } = await axios.post(createUrl, newConversation, { headers });
      console.log('📊 Respuesta de creación:', JSON.stringify(createdConversation));
      
      conversationId = createdConversation[0].id;
      console.log('✅ Nueva conversación creada con ID:', conversationId);
    }
    
    // 3. Guardar mensaje
    console.log('💬 Guardando mensaje en conversación...');
    const messageUrl = `${SUPABASE_URL}/rest/v1/messages`;
    const newMessage = {
      conversation_id: conversationId,
      message: message,
      is_from_user: false,
      created_at: new Date().toISOString()
    };
    
    const { data: savedMessage } = await axios.post(messageUrl, newMessage, { headers });
    console.log('📊 Mensaje guardado:', JSON.stringify(savedMessage));
    
    // 4. Actualizar última actividad
    console.log('🔄 Actualizando última actividad de la conversación...');
    const updateUrl = `${SUPABASE_URL}/rest/v1/conversations?id=eq.${conversationId}`;
    const update = {
      last_message: message,
      updated_at: new Date().toISOString()
    };
    
    const { data: updatedConversation } = await axios.patch(updateUrl, update, { 
      headers: { ...headers, 'Prefer': 'return=representation' } 
    });
    console.log('📊 Conversación actualizada:', JSON.stringify(updatedConversation));
    
    console.log('✅ Prueba completada con éxito');
    console.log('✅ Mensaje guardado en Supabase usando axios');
    
    // 5. Verificar que podemos obtener mensajes
    console.log('🔍 Verificando mensajes guardados...');
    const messagesUrl = `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${conversationId}&select=*&order=created_at.desc&limit=5`;
    
    const { data: recentMessages } = await axios.get(messagesUrl, { headers });
    console.log('📝 Últimos 5 mensajes:');
    
    if (recentMessages && recentMessages.length > 0) {
      recentMessages.forEach((msg, index) => {
        console.log(`  ${index + 1}. [${msg.created_at}] ${msg.is_from_user ? 'USUARIO:' : 'BOT:'} ${msg.message.substring(0, 50)}${msg.message.length > 50 ? '...' : ''}`);
      });
    } else {
      console.log('  No se encontraron mensajes recientes');
    }
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
    
    if (error.response) {
      console.error('⚠️ Error de respuesta:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
  }
}

// Ejecutar la prueba
testSupabaseWithAxios()
  .then(() => console.log('🏁 Prueba finalizada'))
  .catch(err => console.error('❌ Error general:', err)); 