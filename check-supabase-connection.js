/**
 * Herramienta de diagnóstico para verificar la conexión con Supabase
 * Este script puede ejecutarse de manera independiente para comprobar
 * si hay acceso a Supabase desde el entorno donde se ejecuta.
 */

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Configuración de Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

// Información del sistema
console.log('📊 DIAGNÓSTICO DE CONEXIÓN A SUPABASE');
console.log(`🔗 URL: ${SUPABASE_URL ? SUPABASE_URL : 'No configurada'}`);
console.log(`🔑 Key: ${SUPABASE_KEY ? '********' : 'No configurada'}`);

// Verificar variables de entorno
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ ERROR: Variables de entorno SUPABASE_URL y/o SUPABASE_KEY no configuradas');
  console.log('👉 Por favor, configura estas variables en tu archivo .env o en el panel de Render');
  process.exit(1);
}

// Inicializar cliente de Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Función principal para verificar la conexión
async function checkConnection() {
  try {
    console.log('🔍 Verificando conexión con Supabase...');
    
    // Intentar recuperar datos de una tabla llamada 'messages'
    const { data, error } = await supabase
      .from('messages')
      .select('id')
      .limit(1);
    
    if (error) {
      throw error;
    }
    
    console.log('✅ Conexión exitosa con Supabase');
    console.log(`📝 Datos de muestra: ${JSON.stringify(data)}`);
    
    // Verificar tablas existentes
    await checkTables();
    
  } catch (error) {
    console.error(`❌ Error al conectar con Supabase: ${error.message}`);
    
    if (error.message.includes('authentication failed')) {
      console.log('👉 La clave de Supabase parece ser incorrecta');
    } else if (error.message.includes('network error')) {
      console.log('👉 No se pudo conectar a Supabase. Verifica tu conexión a internet.');
    } else if (error.message.includes('relation "messages" does not exist')) {
      console.log('👉 La tabla "messages" no existe. Verifica el nombre o crea la tabla.');
      await listTables();
    } else {
      console.log('👉 Revisa la URL de Supabase y asegúrate de que el proyecto esté activo');
    }
    
    process.exit(1);
  }
}

// Función para verificar tablas existentes
async function checkTables() {
  try {
    console.log('🔍 Verificando tablas en Supabase...');
    
    // Obtener lista de tablas usando la API REST de Supabase
    const { data, error } = await supabase.rpc('list_tables');
    
    if (error) {
      console.error(`❌ Error al listar tablas: ${error.message}`);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('📋 Tablas existentes:');
      data.forEach(table => console.log(`  - ${table}`));
      
      // Verificar tablas necesarias
      const requiredTables = ['messages', 'conversations'];
      const missingTables = requiredTables.filter(table => !data.includes(table));
      
      if (missingTables.length > 0) {
        console.warn('⚠️ Faltan tablas necesarias:');
        missingTables.forEach(table => console.log(`  - ${table}`));
      } else {
        console.log('✅ Todas las tablas necesarias están presentes');
      }
    } else {
      console.log('❌ No se encontraron tablas en la base de datos');
    }
  } catch (error) {
    console.error(`❌ Error al verificar tablas: ${error.message}`);
  }
}

// Función para listar tablas
async function listTables() {
  try {
    console.log('🔍 Intentando listar tablas disponibles...');
    
    // Usar una función RPC definida en Supabase para listar tablas
    const { data, error } = await supabase.rpc('list_tables');
    
    if (error) {
      if (error.message.includes('function "list_tables" does not exist')) {
        console.log('👉 La función "list_tables" no está definida en Supabase');
        console.log('👉 Puedes crear tablas desde el panel de Supabase o mediante SQL');
      } else {
        console.error(`❌ Error al listar tablas: ${error.message}`);
      }
      return;
    }
    
    if (data && data.length > 0) {
      console.log('📋 Tablas existentes:');
      data.forEach(table => console.log(`  - ${table}`));
    } else {
      console.log('❌ No se encontraron tablas en la base de datos');
    }
  } catch (error) {
    console.error(`❌ Error al listar tablas: ${error.message}`);
  }
}

// Ejecutar verificación
checkConnection(); 