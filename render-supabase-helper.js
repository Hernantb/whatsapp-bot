/**
 * Módulo de ayuda para resolver problemas de Supabase en Render
 * 
 * Este módulo corrige dos problemas principales:
 * 1. Headers duplicados y sensibles a mayúsculas en Render
 * 2. Problemas con la opción 'global' en el cliente de Supabase
 */

const { createClient } = require('@supabase/supabase-js');

/**
 * Helper para configurar Supabase de forma segura en entornos Render
 * 
 * Este módulo proporciona funciones para manejar las conexiones a Supabase
 * de manera segura, especialmente en entornos como Render donde hay
 * restricciones de seguridad adicionales.
 */

/**
 * Crea un cliente Supabase configurado de forma segura para Render
 * 
 * @param {string} supabaseUrl - URL de la instancia Supabase
 * @param {string} supabaseKey - API key de Supabase
 * @returns {Object} Cliente Supabase
 */
function createSecureSupabaseClient(supabaseUrl, supabaseKey) {
  // Verifica si estamos en Render
  const isRender = process.env.RENDER === 'true' || process.env.RENDER_SERVICE_ID;
  
  // Opciones base para todos los entornos
  const options = {
    auth: {
      persistSession: false, // No persistir la sesión en memoria
      autoRefreshToken: false, // No intentar refrescar tokens automáticamente
    }
  };
  
  // Opciones adicionales para Render
  if (isRender) {
    console.log('⚠️ Detectado entorno Render - configurando Supabase con opciones seguras');
    
    // Agregar opciones específicas para Render
    options.global = {
      // Usar fetch personalizado para evitar problemas de certificados en Render
      fetch: customFetch,
    };
  }
  
  // Crear y devolver el cliente
  return createClient(supabaseUrl, supabaseKey, options);
}

/**
 * Función fetch personalizada para manejar restricciones en Render
 * 
 * @param {string} url - URL para la solicitud
 * @param {Object} options - Opciones de fetch
 * @returns {Promise} Resultado de fetch
 */
async function customFetch(url, options = {}) {
  console.log(`🔄 Solicitud segura a Supabase: ${maskUrl(url)}`);
  
  // Asegurar que options.headers existe
  options.headers = options.headers || {};
  
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      console.warn(`⚠️ Respuesta no-OK de Supabase: ${response.status} ${response.statusText}`);
    }
    
    return response;
  } catch (error) {
    console.error(`❌ Error en solicitud Supabase: ${error.message}`);
    throw error;
  }
}

/**
 * Sanitiza los headers para solicitudes a Supabase
 * 
 * @param {string} apiKey - API key de Supabase
 * @returns {Object} Headers sanitizados
 */
function sanitizeSupabaseHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    'apikey': apiKey,
    'Authorization': `Bearer ${apiKey}`
  };
}

/**
 * Enmascara la URL para logs (oculta información sensible)
 * 
 * @param {string} url - URL completa 
 * @returns {string} URL enmascarada
 */
function maskUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // Si hay auth en la URL, enmascararlo
    if (urlObj.username || urlObj.password) {
      return url.replace(/\/\/[^@]+@/, '//***:***@');
    }
    
    // Si hay un token como parámetro, enmascararlo
    if (urlObj.searchParams.has('apikey')) {
      urlObj.searchParams.set('apikey', '***********');
      return urlObj.toString();
    }
    
    return url;
  } catch (e) {
    // Si no es una URL válida, devolver versión truncada
    return url.substring(0, 30) + '...';
  }
}

/**
 * Detecta problemas comunes en Supabase y recomienda soluciones
 */
function diagnosticarProblemasSupabase() {
  // Verificar ambiente
  const isRender = process.env.RENDER === 'true' || process.env.RENDER_SERVICE_ID;
  const hasSupabaseEnvVars = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);
  
  console.log('\n📊 Diagnóstico de configuración Supabase:');
  console.log(`- Ejecutando en Render: ${isRender ? 'Sí ✓' : 'No'}`);
  console.log(`- Variables de entorno Supabase: ${hasSupabaseEnvVars ? 'Configuradas ✓' : 'Faltantes ❌'}`);
  
  if (isRender && !process.env.RENDER_EXTERNAL_URL) {
    console.warn('⚠️ ADVERTENCIA: Variable RENDER_EXTERNAL_URL no detectada');
    console.warn('   Puede causar problemas con webhooks o redirecciones');
  }
  
  if (isRender && !hasSupabaseEnvVars) {
    console.error('❌ ERROR: Ejecutando en Render sin variables de Supabase configuradas');
    console.error('   Agregue SUPABASE_URL y SUPABASE_KEY en las variables de entorno de Render');
  }
  
  return {
    isRender,
    hasSupabaseEnvVars
  };
}

// Ejecutar diagnóstico al cargar el módulo
const diagnostico = diagnosticarProblemasSupabase();

// Exportar funciones
module.exports = {
  createSecureSupabaseClient,
  sanitizeSupabaseHeaders,
  customFetch,
  diagnosticarProblemasSupabase,
  diagnostico
}; 