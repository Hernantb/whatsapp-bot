/**
 * Test para verificar la función verifyConversationExists
 * 
 * Este script permite probar la función sin iniciar el servidor completo
 */

// Importamos solo lo necesario para la prueba
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

// Configuración de Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Verifica si una conversación existe en la base de datos
 * @param {string} conversationId - El ID de la conversación a verificar
 * @returns {Promise<boolean>} - true si la conversación existe, false en caso contrario
 */
async function verifyConversationExists(conversationId) {
  try {
    if (!conversationId) {
      console.error('❌ verifyConversationExists: Se requiere un ID de conversación');
      return false;
    }
    
    console.log(`🔍 Verificando existencia de conversación: ${conversationId}`);
    
    const { data, error } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .maybeSingle();
    
    if (error) {
      console.error(`❌ Error verificando conversación: ${error.message}`);
      return false;
    }
    
    const exists = !!data;
    console.log(`${exists ? '✅' : '❌'} Conversación ${conversationId} ${exists ? 'existe' : 'no existe'}`);
    return exists;
  } catch (error) {
    console.error(`❌ Error en verifyConversationExists: ${error.message}`);
    return false;
  }
}

/**
 * Función principal que ejecuta las pruebas
 */
async function runTests() {
  console.log('🧪 Iniciando pruebas de verifyConversationExists...');
  
  // Primero probar con un ID inválido
  console.log('\n🧪 Prueba 1: ID de conversación inválido');
  const invalidResult = await verifyConversationExists('test-id-invalid');
  console.log(`Resultado con ID inválido: ${invalidResult}`);
  
  // Obtener un ID válido de la base de datos para probar
  console.log('\n🧪 Prueba 2: Buscando un ID válido para pruebas');
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('id')
      .limit(1)
      .single();
    
    if (error) {
      console.error(`❌ Error al buscar una conversación válida: ${error.message}`);
    } else if (data) {
      console.log(`✅ ID de conversación válido encontrado: ${data.id}`);
      
      // Probar con un ID válido
      console.log('\n🧪 Prueba 3: ID de conversación válido');
      const validResult = await verifyConversationExists(data.id);
      console.log(`Resultado con ID válido: ${validResult}`);
    } else {
      console.log('⚠️ No se encontraron conversaciones en la base de datos');
    }
  } catch (error) {
    console.error(`❌ Error general en las pruebas: ${error.message}`);
  }
  
  console.log('\n✅ Pruebas completadas');
}

// Ejecutar las pruebas
runTests()
  .catch(error => {
    console.error(`❌ Error en el script de prueba: ${error.message}`);
  })
  .finally(() => {
    console.log('👋 Fin del script de prueba');
    // Cerrar la conexión explícitamente para que el script termine
    process.exit(0);
  }); 