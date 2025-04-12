#!/usr/bin/env node

/**
 * Script de inicio para Render
 * 
 * Este archivo sirve como punto de entrada para la plataforma Render,
 * asegurando que las variables de entorno estén correctamente configuradas
 * antes de iniciar el servidor principal.
 */

console.log('🚀 Iniciando WhatsApp Bot en Render...');

// Configurar variables de entorno para Render
process.env.RENDER = 'true';
process.env.NODE_ENV = 'production';

// Manejar el puerto
const PORT = process.env.PORT || 10000;
console.log(`📡 Configurando puerto: ${PORT}`);
// Forzar un puerto específico para evitar conflictos
process.env.FORCE_PORT = PORT;

// Verificar variables críticas
const requiredVars = [
  'OPENAI_API_KEY',
  'GUPSHUP_API_KEY',
  'GUPSHUP_APP_NAME',
  'GUPSHUP_PHONE_NUMBER',
  'SUPABASE_URL',
  'SUPABASE_KEY'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Error: Faltan variables de entorno requeridas:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('Por favor, configura estas variables en el panel de Render.');
  
  // En producción, terminar si faltan variables críticas
  if (process.env.NODE_ENV === 'production') {
    console.error('Terminando el proceso debido a configuración incompleta.');
    process.exit(1);
  } else {
    console.warn('⚠️ Continuando en modo de desarrollo con configuración incompleta.');
  }
}

// Función para manejar errores de puerto
function handleServerError(error) {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Error: Puerto ${PORT} ya está en uso`);
    // Intentar con un puerto aleatorio entre 10000 y 20000
    const newPort = Math.floor(Math.random() * 10000) + 10000;
    console.log(`🔄 Intentando con puerto alternativo: ${newPort}`);
    process.env.PORT = newPort;
    process.env.FORCE_PORT = newPort;
    
    // Reintentar con el nuevo puerto
    startServer();
  } else {
    console.error('❌ Error al iniciar el servidor:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Función para iniciar el servidor
function startServer() {
  try {
    console.log('📡 Puerto configurado:', process.env.PORT || '(usando puerto por defecto)');
    console.log('🌐 Iniciando servidor principal...');
    
    // Configurar listener para errores no manejados
    process.on('uncaughtException', (error) => {
      if (error.code === 'EADDRINUSE') {
        handleServerError(error);
      } else {
        console.error('❌ Error no manejado:', error.message);
        console.error(error.stack);
        process.exit(1);
      }
    });
    
    // Importar y ejecutar el archivo principal
    require('./index.js');
    
    console.log('✅ Servidor principal iniciado correctamente');
  } catch (error) {
    handleServerError(error);
  }
}

// Iniciar el servidor
startServer(); 