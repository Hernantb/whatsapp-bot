/**
 * Script para limpiar mensajes antiguos de Supabase
 * 
 * Este script permite eliminar mensajes antiguos para liberar espacio:
 * - Elimina mensajes anteriores a cierta fecha (configurable)
 * - Opcionalmente mantiene un número máximo de mensajes por conversación
 * - Incluye salvaguardas para evitar eliminaciones accidentales
 * 
 * Uso: node cleanup-messages.js [--days=30] [--keep=100] [--dry-run] [--all] [--force]
 * 
 * Opciones:
 *   --days=N    Mantener mensajes de los últimos N días (por defecto: 30)
 *   --keep=N    Mantener al menos N mensajes por conversación (por defecto: 100)
 *   --dry-run   Mostrar qué se eliminaría sin hacerlo realmente
 *   --all       Limpiar todas las conversaciones (por defecto solo inactivas +30 días)
 *   --force     Ignorar fecha de corte y eliminar todos los mensajes hasta dejar solo los últimos N
 */

// Cargar variables de entorno
require('dotenv').config();

// Importar Supabase
const { createClient } = require('@supabase/supabase-js');

// Obtener argumentos de línea de comandos
const args = process.argv.slice(2);
const daysToKeep = parseInt(args.find(arg => arg.startsWith('--days='))?.split('=')[1] || '30');
const messagesToKeep = parseInt(args.find(arg => arg.startsWith('--keep='))?.split('=')[1] || '100');
const dryRun = args.includes('--dry-run');
const cleanAll = args.includes('--all');
const forceCleanup = args.includes('--force');

// Crear cliente Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERROR: Faltan credenciales de Supabase en .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Función principal
async function cleanupMessages() {
  console.log('🧹 Iniciando limpieza de mensajes...');
  console.log(`📆 Manteniendo mensajes de los últimos ${daysToKeep} días`);
  console.log(`🔢 Manteniendo al menos ${messagesToKeep} mensajes por conversación`);
  
  if (forceCleanup) {
    console.log('⚠️ MODO FORZADO: Se ignorará la fecha de corte y se eliminarán mensajes hasta dejar solo los últimos N');
  }
  
  if (dryRun) {
    console.log('🔍 MODO SIMULACIÓN: No se eliminarán mensajes realmente');
  }
  
  try {
    // 1. Obtener todas las conversaciones (o solo inactivas, según configuración)
    console.log('🔍 Obteniendo conversaciones...');
    
    let query = supabase.from('conversations').select('id, user_id, last_message_time');
    
    // Si no es limpieza total, filtrar solo conversaciones inactivas por más de 30 días
    if (!cleanAll) {
      const inactiveDate = new Date();
      inactiveDate.setDate(inactiveDate.getDate() - 30); // Inactivo por 30 días
      const inactiveDateStr = inactiveDate.toISOString();
      
      query = query.lt('last_message_time', inactiveDateStr);
      console.log(`🕰️ Filtrando conversaciones inactivas desde: ${inactiveDateStr}`);
    }
    
    const { data: conversations, error: convError } = await query;
    
    if (convError) {
      console.error('❌ Error obteniendo conversaciones:', convError.message);
      return;
    }
    
    console.log(`📊 Encontradas ${conversations.length} conversaciones para procesar`);
    
    if (conversations.length === 0) {
      console.log('✅ No hay conversaciones para limpiar');
      return;
    }
    
    // Fecha de corte para mantener mensajes
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffDateStr = cutoffDate.toISOString();
    console.log(`📅 Fecha de corte para mensajes antiguos: ${cutoffDateStr}`);
    
    // 2. Para cada conversación, eliminar mensajes antiguos
    let totalMessagesDeleted = 0;
    let totalSpaceFreed = 0;
    
    for (const conversation of conversations) {
      console.log(`\n🔄 Procesando conversación: ${conversation.id} (usuario: ${conversation.user_id})`);
      
      // Obtener recuento total de mensajes
      const { count: totalMessages, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversation.id);
      
      if (countError) {
        console.error(`❌ Error contando mensajes para conversación ${conversation.id}:`, countError.message);
        continue;
      }
      
      console.log(`📊 Total de mensajes en la conversación: ${totalMessages}`);
      
      if (totalMessages <= messagesToKeep) {
        console.log(`ℹ️ Conversación tiene menos de ${messagesToKeep} mensajes, omitiendo...`);
        continue;
      }
      
      // Obtener mensajes a eliminar (antiguos, pero manteniendo el mínimo)
      const messagesToDelete = totalMessages - messagesToKeep;
      console.log(`🗑️ Mensajes a eliminar: ${messagesToDelete}`);
      
      // Construir la consulta según el modo de limpieza
      let messageQuery = supabase
        .from('messages')
        .select('id, created_at, content')
        .eq('conversation_id', conversation.id);
      
      // Si no está en modo forzado, aplicar filtro de fecha
      if (!forceCleanup) {
        messageQuery = messageQuery.lt('created_at', cutoffDateStr);
      }
      
      // Ordenar y limitar
      const { data: messagesToDeleteData, error: messagesError } = await messageQuery
        .order('created_at', { ascending: true })
        .limit(messagesToDelete);
      
      if (messagesError) {
        console.error(`❌ Error obteniendo mensajes a eliminar para conversación ${conversation.id}:`, messagesError.message);
        continue;
      }
      
      const messageIdsToDelete = messagesToDeleteData.map(msg => msg.id);
      const messageSpaceFreed = messagesToDeleteData.reduce((total, msg) => total + (msg.content?.length || 0), 0);
      
      console.log(`🗑️ Encontrados ${messageIdsToDelete.length} mensajes que cumplen criterios de eliminación`);
      console.log(`💾 Espacio aproximado a liberar: ${(messageSpaceFreed / 1024).toFixed(2)} KB`);
      
      // Eliminar mensajes en lotes de 100 para evitar problemas de rendimiento
      if (messageIdsToDelete.length > 0 && !dryRun) {
        const BATCH_SIZE = 100;
        let deletedCount = 0;
        
        for (let i = 0; i < messageIdsToDelete.length; i += BATCH_SIZE) {
          const batch = messageIdsToDelete.slice(i, i + BATCH_SIZE);
          const { error: deleteError } = await supabase
            .from('messages')
            .delete()
            .in('id', batch);
          
          if (deleteError) {
            console.error(`❌ Error eliminando lote de mensajes:`, deleteError.message);
          } else {
            deletedCount += batch.length;
            console.log(`✅ Eliminado lote ${Math.floor(i/BATCH_SIZE) + 1}: ${batch.length} mensajes`);
          }
        }
        
        console.log(`✅ Eliminados ${deletedCount} mensajes para conversación ${conversation.id}`);
        totalMessagesDeleted += deletedCount;
        totalSpaceFreed += messageSpaceFreed;
      } else if (dryRun) {
        console.log(`🔍 [SIMULACIÓN] Se eliminarían ${messageIdsToDelete.length} mensajes`);
        totalMessagesDeleted += messageIdsToDelete.length;
        totalSpaceFreed += messageSpaceFreed;
      }
    }
    
    // Resumen
    console.log('\n📊 RESUMEN DE LIMPIEZA');
    console.log('====================');
    console.log(`🧹 Total de mensajes ${dryRun ? 'que se eliminarían' : 'eliminados'}: ${totalMessagesDeleted}`);
    console.log(`💾 Espacio aproximado ${dryRun ? 'que se liberaría' : 'liberado'}: ${(totalSpaceFreed / 1024 / 1024).toFixed(2)} MB`);
    
    if (dryRun) {
      console.log('\n⚠️ Esto fue una SIMULACIÓN. Para eliminar realmente, ejecuta sin --dry-run');
    }
    
  } catch (error) {
    console.error('❌ Error general durante la limpieza:', error.message);
  }
}

// Ejecutar la limpieza
cleanupMessages()
  .then(() => {
    console.log('✅ Proceso de limpieza completado');
  })
  .catch(err => {
    console.error('❌ Error fatal:', err);
    process.exit(1);
  });
