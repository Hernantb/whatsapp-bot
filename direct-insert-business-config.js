/**
 * Este script intenta insertar directamente en la tabla business_config
 * usando la API REST de Supabase, evitando las restricciones de RLS
 */

const axios = require('axios');
require('dotenv').config();

// Usar configuración actual
const { SUPABASE_URL, SUPABASE_KEY, BUSINESS_ID } = require('./supabase-config');

async function insertBusinessConfig() {
  try {
    console.log('Iniciando inserción directa a business_config con API REST...');
    console.log(`SUPABASE_URL: ${SUPABASE_URL}`);
    console.log(`BUSINESS_ID: ${BUSINESS_ID}`);
    
    // Datos del negocio actual
    const businessConfig = {
      id: BUSINESS_ID, // Usar el ID existente
      business_name: "Empresa Original", 
      gupshup_api_key: process.env.GUPSHUP_API_KEY || 'sk_58a31041fdeb4d98b9f0e073792a6e6b',
      gupshup_number: process.env.GUPSHUP_NUMBER || '15557033313',
      gupshup_userid: process.env.GUPSHUP_USERID || 'crxty1qflktvwvm7sodtrfe9dpvoowm1',
      openai_api_key: process.env.OPENAI_API_KEY || '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',
      openai_assistant_id: process.env.ASSISTANT_ID || 'asst_bdJlX30wF1qQH3Lf8ZoiptVx',
      system_prompt: `Eres un asistente de ventas amigable y profesional para concesionarios SEAT y CUPRA. Tu objetivo es ayudar a los clientes a encontrar el vehículo que mejor se adapte a sus necesidades, responder preguntas sobre modelos específicos, características, financiamiento y promociones.

Reglas importantes:
1. Sé respetuoso y profesional en todo momento.
2. Proporciona información precisa sobre vehículos SEAT y CUPRA.
3. Si no conoces la respuesta, sugiérele al cliente que visite el concesionario o hable con un asesor humano.
4. No inventes información sobre precios exactos, promociones o disponibilidad.
5. Mantén tus respuestas concisas y directas.
6. No uses emojis.
7. Cuando sugieras un modelo, menciona brevemente sus características principales.`,
      webhook_url: process.env.CONTROL_PANEL_URL || 'https://whatsapp-bot-if6z.onrender.com/api/register-bot-response',
      is_active: true
    };

    console.log('Configuración a insertar:');
    console.log(JSON.stringify(businessConfig, null, 2));

    // Construir URL para inserción directa
    const apiUrl = `${SUPABASE_URL}/rest/v1/business_config`;
    
    // Configurar headers requeridos
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    // Intento 1: Usar API REST estándar con upsert
    try {
      console.log('Intento 1: Insertando usando upsert...');
      const response = await axios.post(apiUrl, businessConfig, { 
        headers: {
          ...headers,
          'Prefer': 'resolution=merge-duplicates,return=representation'
        }
      });
      
      console.log('✅ Inserción exitosa (intento 1):', response.data);
      return;
    } catch (error) {
      console.warn('⚠️ Falló intento 1:', error.response?.data || error.message);
    }

    // Intento 2: Usar API REST con método PUT explícito
    try {
      console.log('Intento 2: Insertando usando PUT explícito...');
      const putUrl = `${apiUrl}?id=eq.${BUSINESS_ID}`;
      const response = await axios.put(putUrl, businessConfig, { headers });
      
      console.log('✅ Inserción exitosa (intento 2):', response.data);
      return;
    } catch (error) {
      console.warn('⚠️ Falló intento 2:', error.response?.data || error.message);
    }

    // Intento 3: Solución alternativa - usar RPC personalizada
    try {
      console.log('Intento 3: Usando RPC personalizada...');
      const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/insert_business_config`;
      const response = await axios.post(rpcUrl, businessConfig, { headers });
      
      console.log('✅ Inserción exitosa (intento 3):', response.data);
      return;
    } catch (error) {
      console.warn('⚠️ Falló intento 3:', error.response?.data || error.message);
    }

    console.error('❌ Todos los intentos de inserción fallaron. Por favor:');
    console.error('1. Ve al SQL Editor de Supabase y ejecuta:');
    console.error('   ALTER TABLE business_config DISABLE ROW LEVEL SECURITY;');
    console.error('2. Ejecuta este script nuevamente');
    console.error('3. Vuelve a habilitar RLS:');
    console.error('   ALTER TABLE business_config ENABLE ROW LEVEL SECURITY;');
    
  } catch (err) {
    console.error('❌ Error en el proceso de inserción:', err);
  }
}

insertBusinessConfig(); 