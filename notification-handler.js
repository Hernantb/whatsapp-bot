/**
 * MÓDULO DE MANEJO DE NOTIFICACIONES
 * 
 * Este archivo implementa las funciones necesarias para:
 * 1. Detectar frases clave en mensajes que requieren notificación
 * 2. Actualizar el estado de las conversaciones a "importantes" en el dashboard
 * 3. Marcar mensajes como procesados para notificación
 */

const { createClient } = require('@supabase/supabase-js');

// Cargar configuración de Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI';

// Inicializar cliente Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Verifica si un mensaje contiene frases que indican necesidad de notificación
 * @param {string} message - El mensaje a verificar
 * @returns {boolean} - Verdadero si el mensaje contiene alguna de las frases de notificación
 */
function checkForNotificationPhrases(message) {
  if (!message) return false;

  // Normalizar el mensaje (convertir a minúsculas, eliminar espacios extras)
  const normalizedMessage = message.toLowerCase().trim();
  
  // Frases que indican necesidad de notificación
  const phrases = [
    "tu cita ha sido confirmada",
    "se ha confirmado tu cita",
    "tu reserva está confirmada",
    "un asesor te contactará",
    "un representante se comunicará",
    "nos pondremos en contacto",
    "gracias por tu paciencia",
    "asesor te llamará",
    "asesor te llamara",
    "perfecto"
  ];
  
  // Verificar si el mensaje contiene alguna de las frases
  for (const phrase of phrases) {
    if (normalizedMessage.includes(phrase.toLowerCase())) {
      console.log(`✅ Frase de notificación encontrada: "${phrase}" en el mensaje`);
      return true;
    }
  }
  
  return false;
}

/**
 * Actualiza el estado de notificación de una conversación
 * @param {string} conversationId - ID de la conversación
 * @param {boolean} success - Si la notificación fue exitosa
 * @param {string} messageId - ID del mensaje opcional
 * @returns {Promise<Object>} - Resultado de la operación
 */
async function handleNotificationUpdate(conversationId, success, messageId = null) {
  console.log(`🔔 NOTIFICACIÓN REQUERIDA para conversación: ${conversationId}`);
  
  try {
    // 1. Actualizar estado de la conversación (marcar como importante)
    const conversationUpdate = {
      notification_sent: success,
      notification_timestamp: new Date().toISOString()
    };
    
    // Intentar actualizar también el campo is_important si existe
    try {
      const { data: conversationCheck, error: checkError } = await supabase
        .from('conversations')
        .select('is_important')
        .eq('id', conversationId)
        .limit(1);
      
      if (!checkError && conversationCheck && conversationCheck.length > 0) {
        // Si la columna is_important existe, actualizarla
        if ('is_important' in conversationCheck[0]) {
          conversationUpdate.is_important = true;
        }
      }
    } catch (checkError) {
      console.log('⚠️ No se pudo verificar columna is_important:', checkError.message);
    }
    
    // Intentar marcar como importante usando la columna status si existe
    try {
      const { data: statusCheck, error: statusError } = await supabase
        .from('conversations')
        .select('status')
        .eq('id', conversationId)
        .limit(1);
      
      if (!statusError && statusCheck && statusCheck.length > 0) {
        // Si la columna status existe, actualizarla a 'important'
        if ('status' in statusCheck[0]) {
          conversationUpdate.status = 'important';
          console.log('✅ Actualizando campo status a "important"');
        }
      }
    } catch (statusError) {
      // Esta columna puede no existir, y estamos manejando ese caso
      console.log('⚠️ No se pudo actualizar status:', statusError.message);
      
      // Intentar crear la columna status en la tabla conversations
      try {
        await supabase.rpc('add_column_if_not_exists', {
          table_name: 'conversations',
          column_name: 'status',
          column_type: 'text'
        });
        console.log('✅ Columna status creada/verificada');
        
        // Ahora que sabemos que la columna debería existir, establecer el valor
        conversationUpdate.status = 'important';
      } catch (createColumnError) {
        console.error('❌ Error creando columna status:', createColumnError.message);
      }
    }
    
    // Actualizar la conversación con todos los campos necesarios
    const { error: updateError } = await supabase
      .from('conversations')
      .update(conversationUpdate)
      .eq('id', conversationId);
    
    if (updateError) {
      console.error(`❌ Error al actualizar estado de conversación: ${updateError.message}`);
    } else {
      console.log(`✅ Estado de conversación actualizado correctamente`);
    }
    
    // 2. Si se proporcionó un ID de mensaje, actualizar ese mensaje
    if (messageId) {
      const { error: messageError } = await supabase
        .from('messages')
        .update({ 
          notification_sent: success,
          needs_notification: false // Marcarlo como procesado
        })
        .eq('id', messageId);
      
      if (messageError) {
        console.error(`❌ Error al actualizar mensaje: ${messageError.message}`);
      } else {
        console.log(`✅ Mensaje ${messageId} actualizado correctamente`);
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error(`❌ Error general en handleNotificationUpdate:`, error);
    return { success: false, error: error.message };
  }
}

// Exportar las funciones para que puedan ser usadas por otros módulos
module.exports = {
  checkForNotificationPhrases,
  handleNotificationUpdate
}; 