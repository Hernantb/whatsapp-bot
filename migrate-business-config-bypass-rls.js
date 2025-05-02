const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Usar configuración actual
const { SUPABASE_URL, SUPABASE_KEY, BUSINESS_ID } = require('./supabase-config');

// Para este script, necesitamos credenciales de servicio (service_role key)
// Esta clave debe tener permisos para deshabilitar RLS
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Si no hay una clave de servicio, usar la anónima como fallback (que probablemente fallará)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY || SUPABASE_KEY);

async function migrateConfig() {
  try {
    console.log('Iniciando migración de configuración del negocio (bypass RLS)...');
    console.log(`SUPABASE_URL: ${SUPABASE_URL}`);
    console.log(`BUSINESS_ID: ${BUSINESS_ID}`);
    
    // 1. Intentar deshabilitar temporalmente RLS (solo funcionará con service_role key)
    console.log('Intentando deshabilitar temporalmente RLS...');
    
    // Si no tienes una service_role key, esto fallará y tendrás que ejecutar manualmente:
    // ALTER TABLE business_config DISABLE ROW LEVEL SECURITY;
    try {
      const { error: disableRlsError } = await supabase.rpc('disable_rls', {
        table_name: 'business_config'
      });
      
      if (disableRlsError) {
        console.warn('⚠️ No se pudo deshabilitar RLS automáticamente:', disableRlsError.message);
        console.warn('Por favor, ejecuta esta SQL manualmente en Supabase:');
        console.warn('ALTER TABLE business_config DISABLE ROW LEVEL SECURITY;');
        console.warn('Intentando continuar de todos modos...');
      } else {
        console.log('✅ RLS deshabilitado temporalmente');
      }
    } catch (rlsError) {
      console.warn('⚠️ Error al intentar deshabilitar RLS:', rlsError.message);
      console.warn('Intentando continuar de todos modos...');
    }
    
    // 2. Datos del negocio actual
    const businessConfig = {
      id: BUSINESS_ID, // Usar el ID existente
      business_name: "Empresa Original", 
      gupshup_api_key: process.env.GUPSHUP_API_KEY,
      gupshup_number: process.env.GUPSHUP_NUMBER,
      gupshup_userid: process.env.GUPSHUP_USERID,
      openai_api_key: process.env.OPENAI_API_KEY,
      openai_assistant_id: process.env.ASSISTANT_ID || 'asst_bdJlX30wF1qQH3Lf8ZoiptVx',
      system_prompt: process.env.SYSTEM_PROMPT || `Eres un asistente de ventas amigable y profesional para concesionarios SEAT y CUPRA. Tu objetivo es ayudar a los clientes a encontrar el vehículo que mejor se adapte a sus necesidades, responder preguntas sobre modelos específicos, características, financiamiento y promociones.

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

    console.log('Configuración a migrar:');
    console.log(JSON.stringify(businessConfig, null, 2));

    // 3. Insertar en la nueva tabla
    const { data, error } = await supabase
      .from('business_config')
      .upsert(businessConfig)
      .select();

    if (error) {
      console.error('❌ Error al migrar la configuración:', error);
      return;
    }

    console.log('✅ Configuración migrada correctamente:', data);
    
    // 4. Re-habilitar RLS
    try {
      const { error: enableRlsError } = await supabase.rpc('enable_rls', {
        table_name: 'business_config'
      });
      
      if (enableRlsError) {
        console.warn('⚠️ No se pudo re-habilitar RLS automáticamente:', enableRlsError.message);
        console.warn('Por favor, ejecuta esta SQL manualmente en Supabase:');
        console.warn('ALTER TABLE business_config ENABLE ROW LEVEL SECURITY;');
      } else {
        console.log('✅ RLS re-habilitado correctamente');
      }
    } catch (rlsError) {
      console.warn('⚠️ Error al intentar re-habilitar RLS:', rlsError.message);
      console.warn('Asegúrate de ejecutar manualmente: ALTER TABLE business_config ENABLE ROW LEVEL SECURITY;');
    }
  } catch (err) {
    console.error('❌ Error en el proceso de migración:', err);
  }
}

migrateConfig(); 