/**
 * Configuración de Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Configurar cliente de Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

// Verificar configuración
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('⚠️ Variables de Supabase no configuradas. Usar variables de entorno SUPABASE_URL y SUPABASE_SERVICE_KEY.');
}

// Crear cliente de Supabase con opciones
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// Exportar cliente y configuración
module.exports = {
  supabase,
  SUPABASE_URL,
  SUPABASE_KEY
}; 