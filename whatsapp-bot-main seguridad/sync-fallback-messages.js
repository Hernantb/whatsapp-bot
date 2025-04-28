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
const SUPABASE_URL = 'https://ecnimzwygbbumxdcilsb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjbmltend5Z2JidW14ZGNpbHNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDM3MTkxMTEsImV4cCI6MjAxOTI5NTExMX0.KGnGBMq0nEG6BRE2CojwhqiOIzvgEvbQ-eKlnQrIaGs';

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
    const searchUrl = `${SUPABASE_URL}/rest/v1/conversations?phone_number=eq.${encodeURIComponent(conversationId)}&business_id=eq.${encodeURIComponent(business_id)}&select=id`;
    
    const { data: conversations } = await axios.get(searchUrl, { headers });
    
    let conversationDbId;
    
    // 2. Crear conversación si no existe
    if (!conversations || conversations.length === 0) {
      console.log('🆕 Creando nueva conversación...');
      
      const createUrl = `${SUPABASE_URL}/rest/v1/conversations`;
      const newConversation = {
        phone_number: conversationId,
        business_id: business_id,
        name: 'Usuario',
        last_message: message,
        updated_at: new Date().toISOString()
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
      message: message,
      is_from_user: false,
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
  
  // Lista para llevar seguimiento de éxitos y fallos
  const results = {
    success: [],
    failed: []
  };
  
  // Procesar cada archivo
  for (const file of files) {
    try {
      const filePath = path.join(fallbackDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const messageData = JSON.parse(fileContent);
      
      console.log(`🔄 Procesando: ${file}`);
      const result = await syncSingleMessage(messageData);
      
      if (result.success) {
        console.log(`✅ Mensaje sincronizado correctamente: ${file}`);
        results.success.push(file);
        
        // Eliminar archivo sincronizado
        fs.unlinkSync(filePath);
        console.log(`🗑️ Archivo eliminado después de sincronizar: ${file}`);
      } else {
        console.error(`❌ Error al sincronizar mensaje: ${file}`);
        results.failed.push(file);
      }
    } catch (error) {
      console.error(`❌ Error al procesar archivo ${file}:`, error.message);
      results.failed.push(file);
    }
  }
  
  // Actualizar contador de pendientes
  const pendingCountFile = path.join(fallbackDir, 'pending_count.json');
  
  if (fs.existsSync(pendingCountFile)) {
    try {
      const pendingData = JSON.parse(fs.readFileSync(pendingCountFile, 'utf8'));
      
      // Filtrar los mensajes que ya se han sincronizado
      pendingData.messages = pendingData.messages.filter(msg => 
        !results.success.includes(path.basename(msg.filename))
      );
      
      pendingData.count = pendingData.messages.length;
      
      fs.writeFileSync(pendingCountFile, JSON.stringify(pendingData, null, 2));
      console.log(`✅ Archivo de conteo actualizado. Mensajes pendientes: ${pendingData.count}`);
    } catch (error) {
      console.error('❌ Error al actualizar contador de pendientes:', error.message);
    }
  }
  
  console.log('📊 Resumen de sincronización:');
  console.log(`  ✅ Mensajes sincronizados: ${results.success.length}`);
  console.log(`  ❌ Mensajes fallidos: ${results.failed.length}`);
  
  if (results.failed.length === 0 && results.success.length > 0) {
    console.log('🎉 Todos los mensajes fueron sincronizados correctamente');
  } else if (results.failed.length > 0) {
    console.log('⚠️ Algunos mensajes no pudieron ser sincronizados');
  }
}

// Ejecutar sincronización
syncFallbackMessages()
  .then(() => console.log('🏁 Proceso de sincronización finalizado'))
  .catch(error => console.error('❌ Error general en sincronización:', error.message)); 