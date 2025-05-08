const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

// Configuración de Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Número de teléfono a limpiar
const TARGET_PHONE = '5212221192568';
const TARGET_NAME = 'Juanito perez';

/**
 * Función principal que limpia las conversaciones duplicadas
 */
async function cleanupDuplicateConversations() {
  try {
    console.log(`\n🧹 === INICIANDO LIMPIEZA DE CONVERSACIONES DUPLICADAS ===`);
    console.log(`🔍 Buscando conversaciones para el número: ${TARGET_PHONE}`);
    
    // Obtener todas las conversaciones con el número objetivo
    const { data: conversations, error: fetchError } = await supabase
      .from('conversations')
      .select('id, user_id, sender_name, last_message_time')
      .eq('user_id', TARGET_PHONE)
      .order('last_message_time', { ascending: false });
    
    if (fetchError) {
      console.error(`❌ Error al buscar conversaciones: ${fetchError.message}`);
      return;
    }
    
    if (!conversations || conversations.length === 0) {
      console.log(`ℹ️ No se encontraron conversaciones para el número ${TARGET_PHONE}`);
      return;
    }
    
    console.log(`✅ Se encontraron ${conversations.length} conversaciones para el número ${TARGET_PHONE}:`);
    
    // Mostrar todas las conversaciones encontradas
    conversations.forEach((conv, idx) => {
      console.log(`${idx + 1}. ID: ${conv.id}, Nombre: ${conv.sender_name}, Fecha: ${conv.last_message_time}`);
    });
    
    // Identificar la conversación a mantener (la que coincide con el nombre o la más reciente)
    let conversationToKeep = conversations.find(conv => conv.sender_name === TARGET_NAME);
    
    if (!conversationToKeep) {
      console.log(`⚠️ No se encontró conversación con nombre "${TARGET_NAME}", se usará la más reciente`);
      conversationToKeep = conversations[0]; // La más reciente, ya que ordenamos por last_message_time desc
    }
    
    console.log(`\n🔒 Se conservará la conversación:`);
    console.log(`ID: ${conversationToKeep.id}, Nombre: ${conversationToKeep.sender_name}, Fecha: ${conversationToKeep.last_message_time}`);
    
    // Filtrar las conversaciones a eliminar
    const conversationsToDelete = conversations
      .filter(conv => conv.id !== conversationToKeep.id)
      .map(conv => conv.id);
    
    if (conversationsToDelete.length === 0) {
      console.log(`ℹ️ No hay conversaciones duplicadas para eliminar`);
      return;
    }
    
    console.log(`\n🗑️ Se eliminarán ${conversationsToDelete.length} conversaciones:`);
    
    // Para cada conversación a eliminar, primero mover los mensajes a la conversación que se conservará
    for (const convId of conversationsToDelete) {
      console.log(`\n📦 Procesando conversación ${convId}...`);
      
      // Obtener los mensajes de la conversación a eliminar
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId);
      
      if (msgError) {
        console.error(`❌ Error al obtener mensajes de conversación ${convId}: ${msgError.message}`);
        continue;
      }
      
      console.log(`📨 Se encontraron ${messages?.length || 0} mensajes en la conversación ${convId}`);
      
      if (messages && messages.length > 0) {
        console.log(`🔄 Migrando mensajes a la conversación ${conversationToKeep.id}...`);
        
        // Actualizar cada mensaje para que pertenezca a la conversación que se conservará
        for (const msg of messages) {
          const { error: updateError } = await supabase
            .from('messages')
            .update({ conversation_id: conversationToKeep.id })
            .eq('id', msg.id);
          
          if (updateError) {
            console.error(`❌ Error al migrar mensaje ${msg.id}: ${updateError.message}`);
          }
        }
        
        console.log(`✅ Mensajes migrados correctamente`);
      }
      
      // Eliminar la conversación vacía
      console.log(`🗑️ Eliminando conversación ${convId}...`);
      const { error: deleteError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', convId);
      
      if (deleteError) {
        console.error(`❌ Error al eliminar conversación ${convId}: ${deleteError.message}`);
      } else {
        console.log(`✅ Conversación ${convId} eliminada correctamente`);
      }
    }
    
    console.log(`\n✅ Proceso de limpieza completado`);
    console.log(`📝 Ahora solo existe una conversación para el número ${TARGET_PHONE}: ${conversationToKeep.id}`);
    
    // Actualizar el nombre si es necesario
    if (conversationToKeep.sender_name !== TARGET_NAME) {
      console.log(`📝 Actualizando nombre de la conversación a "${TARGET_NAME}"...`);
      
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ sender_name: TARGET_NAME })
        .eq('id', conversationToKeep.id);
      
      if (updateError) {
        console.error(`❌ Error al actualizar nombre: ${updateError.message}`);
      } else {
        console.log(`✅ Nombre actualizado correctamente`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Error general: ${error.message}`);
  }
}

// Ejecutar la función principal
cleanupDuplicateConversations()
  .then(() => {
    console.log('🏁 Proceso finalizado');
    process.exit(0);
  })
  .catch(err => {
    console.error(`❌ Error fatal: ${err.message}`);
    process.exit(1);
  }); 