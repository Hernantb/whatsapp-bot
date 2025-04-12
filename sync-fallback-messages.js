/**
 * Script de sincronización de mensajes locales a Supabase
 * Este script lee los mensajes almacenados localmente en el directorio fallback_messages
 * y los envía a Supabase cuando la conectividad está disponible.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Cargar dependencias
let nodeFetch;
try {
  nodeFetch = require('node-fetch');
} catch (e) {
  console.log('⚠️ node-fetch no disponible, usando alternativas...');
}

// Configuración de Supabase
const SUPABASE_URL = 'https://wscijkxwevgxbgwhbqtm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI';

// Headers para las solicitudes a Supabase
const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

// Función para sincronizar un solo mensaje
async function syncSingleMessage(messageData) {
  const { conversationId, message, business_id } = messageData;
  
  try {
    console.log(`🔄 Sincronizando mensaje para ${conversationId}...`);
    
    // 1. Buscar conversación existente
    console.log('🔍 Buscando conversación existente...');
    const searchUrl = `${SUPABASE_URL}/rest/v1/conversations?user_id=eq.${encodeURIComponent(conversationId)}&business_id=eq.${encodeURIComponent(business_id)}&select=id`;
    
    const { data: conversations } = await axios.get(searchUrl, { headers });
    
    let conversationDbId;
    
    // 2. Crear conversación si no existe
    if (!conversations || conversations.length === 0) {
      console.log('🆕 Creando nueva conversación...');
      
      const createUrl = `${SUPABASE_URL}/rest/v1/conversations`;
      const newConversation = {
        user_id: conversationId,
        business_id: business_id,
        sender_name: 'Usuario',
        last_message: message
      };
      
      const { data: createdConversation } = await axios.post(
        createUrl, 
        newConversation,
        { 
          headers: { ...headers, 'Prefer': 'return=representation' }
        }
      );
      
      conversationDbId = createdConversation[0].id;
      console.log('✅ Nueva conversación creada con ID:', conversationDbId);
    } else {
      conversationDbId = conversations[0].id;
      console.log('ℹ️ Usando conversación existente con ID:', conversationDbId);
    }
    
    // 3. Guardar mensaje
    const messageUrl = `${SUPABASE_URL}/rest/v1/messages`;
    const newMessage = {
      conversation_id: conversationDbId,
      content: message,
      sender_type: 'bot',
      created_at: new Date().toISOString()
    };
    
    await axios.post(messageUrl, newMessage, { headers });
    console.log('✅ Mensaje guardado correctamente');
    
    // 4. Actualizar última actividad de la conversación
    const updateUrl = `${SUPABASE_URL}/rest/v1/conversations?id=eq.${conversationDbId}`;
    const update = {
      last_message: message,
      updated_at: new Date().toISOString()
    };
    
    await axios.patch(updateUrl, update, { headers });
    console.log('✅ Conversación actualizada correctamente');
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error al sincronizar mensaje:', error.message);
    if (error.response) {
      console.error('⚠️ Respuesta del servidor:', error.response.status, error.response.statusText);
    }
    return { success: false, error: error.message };
  }
}

// Función principal para sincronizar todos los mensajes pendientes
async function syncFallbackMessages() {
  console.log('🔄 Iniciando sincronización de mensajes pendientes...');
  
  // Verificar si Supabase está accesible
  try {
    console.log('🔍 Verificando conectividad con Supabase...');
    await axios.get(`${SUPABASE_URL}/rest/v1/conversations?limit=1`, { 
      headers, 
      timeout: 5000 
    });
    console.log('✅ Supabase está accesible, procediendo con la sincronización');
  } catch (error) {
    console.error('❌ No se puede conectar a Supabase:', error.message);
    console.log('❌ No se pueden sincronizar los mensajes en este momento');
    return;
  }
  
  // Leer directorio de mensajes pendientes
  const fallbackDir = path.join(__dirname, 'fallback_messages');
  
  if (!fs.existsSync(fallbackDir)) {
    console.log('ℹ️ No hay directorio de fallback, no hay mensajes pendientes');
    return;
  }
  
  // Leer archivos
  const files = fs.readdirSync(fallbackDir)
    .filter(file => file.endsWith('.json') && !file.includes('pending_count'));
  
  if (files.length === 0) {
    console.log('ℹ️ No hay mensajes pendientes para sincronizar');
    return;
  }
  
  console.log(`🔍 Encontrados ${files.length} mensajes pendientes para sincronizar`);
  
  // Sincronizar cada mensaje
  for (const file of files) {
    const messageData = require(path.join(fallbackDir, file));
    await syncSingleMessage(messageData);
  }
}

// Ejecutar la función principal
syncFallbackMessages();