/**
 * Script de inicio específico para Render
 * Resuelve conflictos de puerto y configura entorno
 */

console.log('🚀 Iniciando script para entorno Render...');

// Establecer puerto explícitamente para evitar conflictos
process.env.PORT = process.env.PORT || '10000';
console.log(`✅ Puerto configurado: ${process.env.PORT}`);

// Detectar y establecer variables de entorno
process.env.NODE_ENV = 'production';
process.env.RENDER = 'true';

// Comprobar que tenemos las variables críticas
console.log('🔍 Verificando variables de entorno críticas:');
console.log(`- SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅' : '❌'}`);
console.log(`- OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅' : '❌'}`);
console.log(`- GUPSHUP_API_KEY: ${process.env.GUPSHUP_API_KEY ? '✅' : '❌'}`);

// Iniciar la aplicación
console.log('🚀 Iniciando aplicación con nuevo puerto...');
require('./index.js');
