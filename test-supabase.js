const axios = require('axios');
const supabaseConfig = require('./supabase-config');

// Valores de configuración
const supabaseUrl = supabaseConfig.SUPABASE_URL;
const supabaseKey = supabaseConfig.SUPABASE_KEY;

async function testSupabaseConnection() {
  console.log('📡 VERIFICACIÓN DE ACCESO A SUPABASE');
  console.log(`URL: ${supabaseUrl}`);
  console.log(`API Key: ${supabaseKey.substring(0, 10)}...`);

  try {
    console.log(`🔍 Intentando acceder a Supabase con Axios...`);
    const response = await axios.get(`${supabaseUrl}/rest/v1/conversations?limit=1`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
    
    console.log('✅ SUPABASE ACCESIBLE VIA AXIOS:', response.status);
    console.log('✅ CONTENIDO DE RESPUESTA:', JSON.stringify(response.data).substring(0, 100) + '...');
    
    // Crear un mensaje de prueba
    console.log('\n📝 INTENTANDO CREAR UN MENSAJE DE PRUEBA');
    
    const messageData = {
      conversation_id: "4a42aa05-2ffd-418b-aa52-29e7c571eee8",
      content: "Este es un mensaje de prueba desde test-supabase.js",
      sender_type: "bot",
      read: false,
      created_at: new Date().toISOString()
    };
    
    const messageResponse = await axios.post(`${supabaseUrl}/rest/v1/messages`, messageData, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    });
    
    console.log('✅ MENSAJE CREADO EXITOSAMENTE:', messageResponse.status);
    
  } catch (error) {
    console.error('❌ ERROR ACCEDIENDO A SUPABASE:', error.message);
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', JSON.stringify(error.response.data));
    }
  }
}

testSupabaseConnection(); 