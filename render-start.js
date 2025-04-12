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
console.log(`🧪 Entorno NODE_ENV: ${process.env.NODE_ENV || 'no definido'}`);
console.log(`⏱️ Timestamp: ${new Date().toISOString()}`);

// Configurar variables de entorno para Render
process.env.RENDER = 'true';
process.env.NODE_ENV = 'production';

// Limpiar procesos existentes
try {
  console.log('🧹 Limpiando procesos previos...');
  const psOutput = execSync('ps aux || ps', { stdio: 'pipe' }).toString();
  const nodeProcesses = psOutput.split('\n').filter(line => line.includes('node') && !line.includes('render-start.js'));
  
  if (nodeProcesses.length > 0) {
    console.log(`🔍 Encontrados ${nodeProcesses.length} procesos de Node.js`);
    
    nodeProcesses.forEach(line => {
      try {
        const parts = line.trim().split(/\s+/);
        const pid = parts[1];
        if (pid && /^\d+$/.test(pid)) {
          console.log(`🔫 Terminando proceso ${pid}`);
          execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
        }
      } catch (e) {
        // Ignorar errores al matar procesos
      }
    });
    
    console.log('✅ Limpieza de procesos completada');
  } else {
    console.log('ℹ️ No se encontraron procesos de Node.js para limpiar');
  }
} catch (err) {
  console.log('ℹ️ No se pudieron verificar los procesos previos');
}

// Ruta del archivo PID
const PID_FILE = path.join(__dirname, 'server.pid');

// Manejar el puerto
// En Render, el puerto se proporciona en la variable de entorno PORT
// y debemos usarlo obligatoriamente
const DEFAULT_PORT = 10000;
const RENDER_PORT = parseInt(process.env.PORT) || 3000;

console.log(`📡 Puerto proporcionado por Render: ${process.env.PORT || 'no definido'}`);
console.log(`📡 Puerto interpretado: ${RENDER_PORT}`);

// Asegurarse de que las variables de entorno sean coherentes
process.env.FORCE_PORT = RENDER_PORT.toString();
process.env.PORT = RENDER_PORT.toString();

console.log(`📡 Configurando puerto final: ${process.env.PORT}`);

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
    exec(`lsof -ti:${port} || netstat -tulpn | grep ${port} || ss -tulpn | grep ${port}`, (error, stdout) => {
      if (error) {
        // No hay procesos usando el puerto o error al verificar
        console.log(`✅ Puerto ${port} disponible o no se pudo verificar`);
        resolve();
        return;
      }
      
      if (!stdout || stdout.trim() === '') {
        console.log(`✅ Puerto ${port} disponible`);
        resolve();
        return;
      }
      
      const pids = stdout.trim().split('\n').map(line => {
        const match = line.match(/\d+/);
        return match ? match[0] : null;
      }).filter(Boolean);
      
      if (pids.length > 0) {
        console.log(`⚠️ Puerto ${port} ocupado por los procesos: ${pids.join(', ')}`);
        
        // Intentar matar los procesos
        exec(`kill -9 ${pids.join(' ')}`, (killError) => {
          if (killError) {
            console.error(`❌ Error al liberar puerto: ${killError.message}`);
          } else {
            console.log(`✅ Procesos terminados y puerto ${port} liberado`);
          }
          
          // Esperar un momento para que el puerto se libere
          setTimeout(resolve, 2000);
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
          
          // Borrar el archivo PID
          fs.unlinkSync(PID_FILE);
          console.log(`✅ Archivo PID eliminado`);
          
          // Esperar un momento para que el proceso termine
          setTimeout(resolve, 1000);
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
    
    // Registrar un manejador para borrar el archivo PID al salir
    process.on('exit', () => {
      try {
        if (fs.existsSync(PID_FILE)) {
          fs.unlinkSync(PID_FILE);
          console.log(`✅ Archivo PID eliminado al salir`);
        }
      } catch (error) {
        // Ignorar errores al borrar el archivo
      }
    });
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
    console.error(`❌ Error: Puerto ${RENDER_PORT} ya está en uso`);
    
    // En Render, usar un puerto específico es obligatorio, así que intentamos liberar
    console.log(`🔄 Intentando forzar liberación del puerto ${RENDER_PORT}...`);
    await clearPort(RENDER_PORT);
    
    // Reintento con el mismo puerto después de liberarlo
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
    
    console.log('📡 Puerto configurado:', process.env.PORT);
    console.log('🌐 Iniciando servidor principal...');
    
    // Configurar listener para errores no manejados
    process.on('uncaughtException', (error) => {
      if (error.code === 'EADDRINUSE') {
        handleServerError(error);
      } else {
        console.error('❌ Error no manejado:', error.message);
        console.error(error.stack);
        
        // En producción, reintentar en lugar de terminar
        if (process.env.NODE_ENV === 'production') {
          console.log('🔄 Reiniciando servidor después de error...');
          setTimeout(() => {
            startServer();
          }, 5000);
        } else {
          process.exit(1);
        }
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
    console.log('🔄 Iniciando secuencia de arranque...');
    
    // Verificar y limpiar PID anterior
    await checkAndClearPid();
    
    // Limpiar el puerto configurado
    await clearPort(RENDER_PORT);
    
    // Verificar si el puerto está libre ahora
    const inUse = await isPortInUse(RENDER_PORT);
    if (inUse) {
      // En Render, es obligatorio usar el puerto asignado
      console.log(`⚠️ Puerto ${RENDER_PORT} sigue ocupado después de limpieza. Forzando liberación...`);
      
      // Intentar una liberación más agresiva
      try {
        execSync(`fuser -k ${RENDER_PORT}/tcp || true`, { stdio: 'pipe' });
        console.log(`✅ Puerto ${RENDER_PORT} liberado forzosamente`);
      } catch (error) {
        console.log(`⚠️ No se pudo forzar la liberación del puerto: ${error.message}`);
      }
      
      // Esperar un poco antes de continuar
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Iniciar el servidor
    startServer();
  } catch (error) {
    console.error('❌ Error durante la inicialización:', error.message);
    process.exit(1);
  }
})(); 