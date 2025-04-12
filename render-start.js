#!/usr/bin/env node

/**
 * Script de inicio para Render
 * 
 * Este archivo sirve como punto de entrada para la plataforma Render,
 * asegurando que las variables de entorno estén correctamente configuradas
 * antes de iniciar el servidor principal.
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Iniciando WhatsApp Bot en Render...');

// Configurar variables de entorno para Render
process.env.RENDER = 'true';
process.env.NODE_ENV = 'production';

// Ruta del archivo PID
const PID_FILE = path.join(__dirname, 'server.pid');

// Liberar el puerto si está en uso
function clearPort(port) {
  return new Promise((resolve) => {
    console.log(`🔍 Verificando si el puerto ${port} está en uso...`);
    
    // En entorno Render, intentar matar cualquier proceso en el puerto
    exec(`lsof -ti:${port}`, (error, stdout) => {
      if (error) {
        // No hay procesos usando el puerto o error al verificar
        console.log(`✅ Puerto ${port} disponible`);
        resolve();
        return;
      }
      
      const pids = stdout.trim().split('\n');
      if (pids.length > 0 && pids[0]) {
        console.log(`⚠️ Puerto ${port} ocupado por los procesos: ${pids.join(', ')}`);
        
        // Intentar matar los procesos
        exec(`kill -9 ${pids.join(' ')}`, (killError) => {
          if (killError) {
            console.error(`❌ Error al liberar puerto: ${killError.message}`);
          } else {
            console.log(`✅ Procesos terminados y puerto ${port} liberado`);
          }
          resolve();
        });
      } else {
        console.log(`✅ Puerto ${port} disponible`);
        resolve();
      }
    });
  });
}

// Verificar si hay un PID previo y matarlo
function checkAndClearPid() {
  return new Promise((resolve) => {
    if (fs.existsSync(PID_FILE)) {
      try {
        const oldPid = fs.readFileSync(PID_FILE, 'utf8').trim();
        console.log(`🔍 PID anterior encontrado: ${oldPid}`);
        
        // Intentar matar el proceso anterior
        exec(`kill -9 ${oldPid}`, () => {
          console.log(`🔄 Intento de terminar el proceso anterior (PID: ${oldPid})`);
          resolve();
        });
      } catch (error) {
        console.error(`⚠️ Error al leer/matar PID anterior: ${error.message}`);
        resolve();
      }
    } else {
      resolve();
    }
  });
}

// Guardar el PID actual
function savePid() {
  try {
    fs.writeFileSync(PID_FILE, process.pid.toString());
    console.log(`✅ PID actual guardado: ${process.pid}`);
  } catch (error) {
    console.error(`⚠️ Error al guardar PID: ${error.message}`);
  }
}

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
    clearPort(newPort).then(startServer);
  } else {
    console.error('❌ Error al iniciar el servidor:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Función para iniciar el servidor
function startServer() {
  try {
    // Guardar PID del proceso actual
    savePid();
    
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

// Iniciar la secuencia de arranque
(async function() {
  try {
    // Verificar y limpiar PID anterior
    await checkAndClearPid();
    
    // Limpiar el puerto configurado
    await clearPort(PORT);
    
    // Iniciar el servidor
    startServer();
  } catch (error) {
    console.error('❌ Error durante la inicialización:', error.message);
    process.exit(1);
  }
})(); 