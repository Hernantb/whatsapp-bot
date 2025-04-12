/**
 * Helper específico para resolver problemas de Supabase en Render
 * 
 * Este archivo debe ser importado al inicio de index.js en Render:
 * require('./supabase-render-helper');
 */

console.log('🔧 Supabase Render Helper: Iniciando...');

// 1. Asegurar que las variables de entorno estén disponibles
if (!process.env.SUPABASE_KEY && process.env.SUPABASE_ANON_KEY) {
  console.log('🔑 Supabase Render Helper: Copiando SUPABASE_ANON_KEY a SUPABASE_KEY');
  process.env.SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
}

if (!process.env.SUPABASE_URL) {
  console.log('🔗 Supabase Render Helper: Configurando URL predeterminada');
  process.env.SUPABASE_URL = 'https://wscijkxwevgxbgwhbqtm.supabase.co';
}

// 2. Sobreescribir createClient para normalizar las opciones
const originalCreateClient = require('@supabase/supabase-js').createClient;
const supabaseModule = require('@supabase/supabase-js');

supabaseModule.createClient = function(url, key, options = {}) {
  console.log('🔄 Supabase Render Helper: Interceptando createClient con opciones seguras');
  
  // Crear opciones seguras
  const safeOptions = {
    ...options,
    auth: {
      ...(options.auth || {}),
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      ...(options.global || {}),
      headers: {
        ...(options.global?.headers || {}),
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      }
    }
  };
  
  // Eliminar apikey si existe
  if (safeOptions.global?.headers?.apikey) {
    delete safeOptions.global.headers.apikey;
  }
  
  return originalCreateClient(url, key, safeOptions);
};

// 3. Parche para fetch y node-fetch
const originalFetch = global.fetch;
if (originalFetch) {
  global.fetch = function(url, options = {}) {
    // Si es una URL de Supabase y hay headers con apikey
    if (url.includes('supabase') && options.headers && 
        (options.headers.apikey || options.headers['apikey'])) {
      
      console.log('🔄 Supabase Render Helper: Interceptando fetch con cabeceras seguras');
      
      // Obtener la apikey
      const apiKey = options.headers.apikey || options.headers['apikey'];
      
      // Crear headers seguros
      options.headers = {
        ...options.headers,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };
      
      // Eliminar apikey
      delete options.headers.apikey;
      delete options.headers['apikey'];
    }
    
    return originalFetch(url, options);
  };
}

console.log('✅ Supabase Render Helper: Inicializado correctamente');
