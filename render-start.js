#!/usr/bin/env node

/**
 * Script de inicio para Render
 * 
 * Este archivo sirve como punto de entrada para la plataforma Render,
 * asegurando que las variables de entorno estén correctamente configuradas
 * antes de iniciar el servidor principal.
 */

const { exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

console.log('🚀 Iniciando WhatsApp Bot en Render...');

// Configurar variables de entorno para Render
process.env.RENDER = 'true';
process.env.NODE_ENV = 'production';

// Limpiar procesos existentes
try {
  console.log('🧹 Limpiando procesos previos...');
  execSync('ps aux | grep node | grep -v grep', { stdio: 'pipe' })
    .toString()
    .split('\n')
    .forEach(line => {
      if (line && !line.includes('render-start.js')) {
        const pid = line.split(/\s+/)[1];
        if (pid) {
          try {
            console.log(`🔫 Terminando proceso ${pid}`);
            execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
          } catch (e) {
            // Ignorar errores al matar procesos
          }
        }
      }
    });
  console.log('✅ Limpieza de procesos completada');
} catch (err) {
  console.log('ℹ️ No se encontraron procesos previos para limpiar');
}

// Ruta del archivo PID
const PID_FILE = path.join(__dirname, 'server.pid');

// Manejar el puerto
// Forzar un puerto diferente al 3000 (ya que parece que está siempre en uso en Render)
const DEFAULT_PORT = 10000;  // Un puerto alto para evitar conflictos
const PORT = process.env.FORCE_PORT || process.env.PORT || DEFAULT_PORT;

console.log(`📡 Configurando puerto: ${PORT}`);

// Forzar un puerto específico para evitar conflictos
process.env.FORCE_PORT = PORT;
process.env.PORT = PORT;

// Verificar que el puerto NO esté en uso
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = http.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`❌ Puerto ${port} ya está en uso`);
        resolve(true);
      } else {
        resolve(false);
      }
      server.close();
    });
    
    server.once('listening', () => {
      console.log(`✅ Puerto ${port} está disponible`);
      server.close();
      resolve(false);
    });
    
    server.listen(port);
  });
}

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

// Función para encontrar un puerto disponible
async function findAvailablePort(startPort) {
  let port = startPort;
  const maxPort = startPort + 1000;
  
  while (port < maxPort) {
    const inUse = await isPortInUse(port);
    if (!inUse) {
      return port;
    }
    port++;
    console.log(`🔍 Probando con puerto: ${port}`);
  }
  
  // Si llegamos aquí, no encontramos puerto disponible
  console.error(`❌ No se pudo encontrar un puerto disponible entre ${startPort} y ${maxPort}`);
  return startPort;
}

// Función para manejar errores de puerto
async function handleServerError(error) {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Error: Puerto ${PORT} ya está en uso`);
    
    // Buscar un puerto disponible
    const newPort = await findAvailablePort(DEFAULT_PORT);
    console.log(`🔄 Encontrado puerto disponible: ${newPort}`);
    
    process.env.PORT = newPort.toString();
    process.env.FORCE_PORT = newPort.toString();
    
    // Reintentar con el nuevo puerto
    await clearPort(newPort);
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
    
    // Configurar escuchador de eventos de proceso
    process.on('SIGTERM', () => {
      console.log('🛑 Recibida señal SIGTERM, cerrando servidor...');
      process.exit(0);
    });
    
    process.on('SIGINT', () => {
      console.log('🛑 Recibida señal SIGINT, cerrando servidor...');
      process.exit(0);
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
    
    // Verificar si el puerto está en uso
    const inUse = await isPortInUse(PORT);
    if (inUse) {
      // Buscar un puerto disponible
      const newPort = await findAvailablePort(DEFAULT_PORT);
      console.log(`🔄 Puerto ${PORT} en uso, usando puerto alternativo: ${newPort}`);
      process.env.PORT = newPort.toString();
      process.env.FORCE_PORT = newPort.toString();
    }
    
    // Iniciar el servidor
    startServer();
  } catch (error) {
    console.error('❌ Error durante la inicialización:', error.message);
    process.exit(1);
  }
})(); 