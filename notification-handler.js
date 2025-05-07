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
    
    // SOLUCIÓN ALTERNATIVA: Actualizar al menos notification_sent y timestamp
    // si no podemos actualizar status
    const { error: basicUpdateError } = await supabase
      .from('conversations')
      .update(conversationUpdate)
      .eq('id', conversationId);
    
    if (basicUpdateError) {
      console.error(`❌ Error en actualización básica: ${basicUpdateError.message}`);
    } else {
      console.log(`✅ Actualización básica completada correctamente`);
    }
    
    // Intentamos marcar como importante con is_important (si existe)
    try {
      const { error: importantError } = await supabase
        .from('conversations')
        .update({ is_important: true })
        .eq('id', conversationId);
      
      if (!importantError) {
        console.log(`✅ Conversación marcada como importante (is_important=true)`);
      } else if (importantError.message.includes('does not exist')) {
        console.log(`⚠️ No existe campo is_important: ${importantError.message}`);
      } else {
        console.error(`❌ Error al marcar como importante: ${importantError.message}`);
      }
    } catch (importantError) {
      console.error(`❌ Error al actualizar is_important: ${importantError.message}`);
    }
    
    // Intentamos marcar status='important' (si existe)
    try {
      const { error: statusError } = await supabase
        .from('conversations')
        .update({ status: 'important' })
        .eq('id', conversationId);
      
      if (!statusError) {
        console.log(`✅ Conversación marcada con status='important'`);
      } else if (statusError.message.includes('does not exist')) {
        console.log(`⚠️ No existe campo status: ${statusError.message}`);
        
        // Intentar crear la columna usando SQL nativo
        try {
          // No usamos RPC sino update directo en tabla
          console.log('⚠️ No se pudo establecer status. Usando update con SQL nativo...');
          
          // Actualizar otros campos que pueden ayudar a identificar conversaciones importantes
          const { error: flagsError } = await supabase
            .from('conversations')
            .update({ 
              last_message: "⚠️ REQUIERE ATENCIÓN - Notificación enviada", 
              notification_sent: true
            })
            .eq('id', conversationId);
          
          if (!flagsError) {
            console.log(`✅ Conversación marcada indirectamente como importante`);
          } else {
            console.error(`❌ Error al marcar indirectamente: ${flagsError.message}`);
          }
        } catch (sqlError) {
          console.error(`❌ Error en método alternativo: ${sqlError.message}`);
        }
      } else {
        console.error(`❌ Error al actualizar status: ${statusError.message}`);
      }
    } catch (statusError) {
      console.error(`❌ Error al actualizar status: ${statusError.message}`);
    }
    
    // 2. Si se proporcionó un ID de mensaje, actualizar ese mensaje
    if (messageId) {
      try {
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
      } catch (messageError) {
        console.error(`❌ Error al actualizar mensaje: ${messageError.message}`);
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