/**
 * Script para verificar la estructura de las tablas de Supabase
 * Este script listará todas las columnas de las tablas conversations y messages
 */

const axios = require('axios');

// Cargar configuración de Supabase
const SUPABASE_URL = 'https://wscijkxwevgxbgwhbqtm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI';

// Headers para las solicitudes a Supabase
const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function checkSupabaseTables() {
  console.log('🔍 Verificando estructura de tablas en Supabase...');
  
  try {
    // Verificar tabla conversations
    console.log('\n📋 TABLA: conversations');
    
    try {
      // Obtener un registro de ejemplo para ver la estructura
      const { data: conversations } = await axios.get(
        `${SUPABASE_URL}/rest/v1/conversations?limit=1`, 
        { headers }
      );
      
      if (conversations && conversations.length > 0) {
        console.log('✅ Tabla existe y contiene datos');
        console.log('📊 Estructura de columnas:');
        
        const columns = Object.keys(conversations[0]);
        columns.forEach(col => {
          const value = conversations[0][col];
          const type = typeof value;
          console.log(`  - ${col}: ${type} (ejemplo: ${JSON.stringify(value).substring(0, 30)}${JSON.stringify(value).length > 30 ? '...' : ''})`);
        });
      } else {
        console.log('✅ Tabla existe pero no tiene datos');
      }
    } catch (error) {
      console.error('❌ Error accediendo a tabla conversations:', error.message);
      if (error.response) {
        console.error(`Status: ${error.response.status}, Mensaje: ${JSON.stringify(error.response.data)}`);
      }
    }
    
    // Verificar tabla messages
    console.log('\n📋 TABLA: messages');
    
    try {
      // Obtener un registro de ejemplo para ver la estructura
      const { data: messages } = await axios.get(
        `${SUPABASE_URL}/rest/v1/messages?limit=1`, 
        { headers }
      );
      
      if (messages && messages.length > 0) {
        console.log('✅ Tabla existe y contiene datos');
        console.log('📊 Estructura de columnas:');
        
        const columns = Object.keys(messages[0]);
        columns.forEach(col => {
          const value = messages[0][col];
          const type = typeof value;
          console.log(`  - ${col}: ${type} (ejemplo: ${JSON.stringify(value).substring(0, 30)}${JSON.stringify(value).length > 30 ? '...' : ''})`);
        });
      } else {
        console.log('✅ Tabla existe pero no tiene datos');
      }
    } catch (error) {
      console.error('❌ Error accediendo a tabla messages:', error.message);
      if (error.response) {
        console.error(`Status: ${error.response.status}, Mensaje: ${JSON.stringify(error.response.data)}`);
      }
    }
  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

// Ejecutar la función principal
checkSupabaseTables().catch(error => {
  console.error('❌ Error no controlado:', error);
}); 