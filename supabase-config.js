/**
 * Configuración para Supabase
 * 
 * Este archivo contiene las credenciales para conectarse a Supabase.
 * IMPORTANTE: Reemplazar la clave anónima con la correcta.
 */

// URL de tu proyecto Supabase - ¡CONFIRMADO COMO EXISTENTE!
const SUPABASE_URL = 'https://wscijkxwevgxbgwhbqtm.supabase.co';

// Clave anónima de tu proyecto Supabase
// Para obtener esta clave:
// 1. Inicia sesión en https://supabase.com
// 2. Selecciona tu proyecto (wscijkxwevgxbgwhbqtm)
// 3. Ve a Settings -> API
// 4. Copia la "anon public" key y pégala aquí
const SUPABASE_KEY = 'tu-clave-anonima';

// ID del negocio para las conversaciones
const BUSINESS_ID = '2d385aa5-40e0-4ec9-9360-19281bc605e4';

module.exports = {
  SUPABASE_URL,
  SUPABASE_KEY,
  BUSINESS_ID
}; 