#!/usr/bin/env node
/**
 * Script de despliegue para Render
 * 
 * Este script prepara la aplicación para ser desplegada en Render, realizando
 * ajustes automáticos en la configuración y verificando requisitos.
 */

const fs = require('fs');
const path = require('path');

// Configuración
const CONFIG = {
  indexPath: './index.js',
  envPath: './.env',
  renderEnvPath: './.env.render',
  backupDir: './backups',
  port: process.env.PORT || 3000
};

// Función para registrar mensajes
function log(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${timestamp}] ${message}`);
}

// Función para crear una copia de seguridad
function backupOriginalFile(filePath) {
  // Crear directorio de respaldos si no existe
  if (!fs.existsSync(CONFIG.backupDir)) {
    fs.mkdirSync(CONFIG.backupDir, { recursive: true });
  }
  
  // Generar nombre de archivo de respaldo con timestamp
  const fileName = path.basename(filePath);
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace('T', '_').split('.')[0];
  const backupFileName = `${fileName}.${timestamp}.bak`;
  const backupPath = path.join(CONFIG.backupDir, backupFileName);
  
  // Crear copia de seguridad
  fs.copyFileSync(filePath, backupPath);
  
  return backupPath;
}

// Verifica si el archivo contiene una cadena específica
function fileContains(filePath, searchString) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.includes(searchString);
  } catch (error) {
    log(`⚠️ Error al leer archivo ${filePath}: ${error.message}`);
    return false;
  }
}

// Modificaciones a realizar en el código
const MODIFICATIONS = [
  {
    name: 'Configurar puerto dinámico para Render',
    check: (content) => content.includes('const PORT = process.env.PORT || '),
    apply: (content) => {
      const portRegex = /const\s+PORT\s*=\s*\d+;/g;
      if (portRegex.test(content)) {
        return content.replace(portRegex, 'const PORT = process.env.PORT || 3095;');
      } else {
        log('⚠️ No se encontró la declaración de PORT, intentando buscar el app.listen');
        const listenRegex = /app\.listen\(\d+/g;
        return content.replace(listenRegex, 'app.listen(PORT');
      }
    }
  },
  {
    name: 'Configurar detección de ambiente Render',
    check: (content) => content.includes('process.env.RENDER'),
    apply: (content) => {
      const envCheckPosition = content.indexOf('require(\'dotenv\').config()');
      if (envCheckPosition === -1) {
        log('⚠️ No se encontró la carga de variables de entorno');
        return content;
      }
      
      const renderCheck = `
// Detectar entorno de Render
const isRender = process.env.RENDER === 'true';
const NODE_ENV = process.env.NODE_ENV || (isRender ? 'production' : 'development');
log(\`🌐 Ambiente detectado: \${NODE_ENV} (Render: \${isRender ? 'SÍ' : 'NO'})\`);

`;
      
      return content.slice(0, envCheckPosition + 'require(\'dotenv\').config();'.length) + 
             renderCheck + 
             content.slice(envCheckPosition + 'require(\'dotenv\').config();'.length);
    }
  },
  {
    name: 'Corregir manejo de errores en Supabase',
    check: (content) => content.includes('if (!supabaseUrl || !supabaseKey)'),
    apply: (content) => {
      const supabaseInitRegex = /const\s+supabase\s*=\s*createClient\(supabaseUrl,\s*supabaseKey\);/g;
      const supabaseInitCheck = `
// Verificar credenciales de Supabase
if (!supabaseUrl || !supabaseKey) {
  log('⚠️ Credenciales de Supabase no encontradas, inicializando con valores vacíos');
  supabaseUrl = process.env.SUPABASE_URL || 'https://ejemplo.supabase.co';
  supabaseKey = process.env.SUPABASE_KEY || 'clave-temporal-para-evitar-errores';
}

const supabase = createClient(supabaseUrl, supabaseKey);
`;
      
      if (supabaseInitRegex.test(content)) {
        return content.replace(supabaseInitRegex, supabaseInitCheck);
      } else {
        log('⚠️ No se encontró la inicialización de Supabase');
        return content;
      }
    }
  },
  {
    name: 'Mejorar recuperación en caso de errores',
    check: (content) => content.includes('process.on(\'uncaughtException\''),
    apply: (content) => {
      const errorHandlerPosition = content.lastIndexOf('app.listen(');
      if (errorHandlerPosition === -1) {
        log('⚠️ No se encontró app.listen para agregar manejadores de errores');
        return content;
      }
      
      const errorHandlers = `
// Manejadores de errores globales para mejor estabilidad en producción
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
  console.error('⚠️ El servidor continuará funcionando para mantener estabilidad');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada:', reason);
  console.error('⚠️ El servidor continuará funcionando para mantener estabilidad');
});

`;
      
      return content.slice(0, errorHandlerPosition) + 
             errorHandlers + 
             content.slice(errorHandlerPosition);
    }
  },
  {
    name: 'Añadir endpoint de health check para Render',
    check: (content) => content.includes('app.get(\'/health\''),
    apply: (content) => {
      const routesPosition = content.indexOf('app.listen(');
      if (routesPosition === -1) {
        log('⚠️ No se encontró app.listen para agregar rutas');
        return content;
      }
      
      const healthRoute = `
// Endpoint de health check para Render
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    render: process.env.RENDER === 'true',
    version: process.env.npm_package_version || '1.0.0'
  });
});

`;
      
      return content.slice(0, routesPosition) + 
             healthRoute + 
             content.slice(routesPosition);
    }
  }
];

// Función para crear archivo .env para Render
function createRenderEnvFile() {
  const renderEnvContent = `# Variables de entorno para Render
NODE_ENV=production
RENDER=true
PORT=10000

# GupShup (usar variables de entorno de Render)
GUPSHUP_API_KEY=
GUPSHUP_NUMBER=
GUPSHUP_USERID=

# OpenAI
OPENAI_API_KEY=

# Supabase
SUPABASE_URL=
SUPABASE_KEY=

# SMTP para notificaciones
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=
SMTP_FROM="WhatsApp Bot <notificaciones@ejemplo.com>"

# URLs de servicios
CONTROL_PANEL_URL=https://tu-dashboard.ejemplo.com
`;

  try {
    fs.writeFileSync(CONFIG.renderEnvPath, renderEnvContent, 'utf8');
    log(`✅ Archivo ${CONFIG.renderEnvPath} creado correctamente`);
    return true;
  } catch (error) {
    log(`❌ Error al crear archivo ${CONFIG.renderEnvPath}: ${error.message}`);
    return false;
  }
}

// Función principal para preparar el despliegue
async function prepareForRender() {
  log('🚀 Iniciando preparación para despliegue en Render');
  
  try {
    // Verificar que exista el archivo index.js
    if (!fs.existsSync(CONFIG.indexPath)) {
      log(`❌ Error: No se encontró el archivo ${CONFIG.indexPath}`);
      return false;
    }
    
    // Crear archivo .env para Render si no existe
    if (!fs.existsSync(CONFIG.renderEnvPath)) {
      log(`🔧 Creando archivo ${CONFIG.renderEnvPath} con configuración para Render`);
      createRenderEnvFile();
    } else {
      log(`✅ Archivo ${CONFIG.renderEnvPath} ya existe`);
    }
    
    // Leer el contenido del archivo index.js
    let indexContent = fs.readFileSync(CONFIG.indexPath, 'utf8');
    
    // Verificar si el módulo de notificaciones está instalado
    const notificationInstalled = indexContent.includes("require('./notification-patch')");
    log(`📝 Módulo de notificaciones: ${notificationInstalled ? 'Instalado ✅' : 'No instalado ❌'}`);
    
    // Crear copia de seguridad antes de modificar
    const backupPath = backupOriginalFile(CONFIG.indexPath);
    log(`📦 Copia de seguridad creada en: ${backupPath}`);
    
    // Aplicar cada modificación
    let modificationsApplied = 0;
    for (const modification of MODIFICATIONS) {
      if (!modification.check(indexContent)) {
        log(`🔄 Aplicando: ${modification.name}`);
        try {
          const oldContent = indexContent;
          indexContent = modification.apply(indexContent);
          
          if (oldContent !== indexContent) {
            modificationsApplied++;
            log(`✅ ${modification.name}: Completado`);
          } else {
            log(`⚠️ ${modification.name}: No se realizaron cambios`);
          }
        } catch (modError) {
          log(`❌ Error al aplicar ${modification.name}: ${modError.message}`);
        }
      } else {
        log(`✓ ${modification.name}: Ya aplicado, saltando`);
      }
    }
    
    // Guardar el archivo modificado
    fs.writeFileSync(CONFIG.indexPath, indexContent, 'utf8');
    log(`💾 Cambios guardados en ${CONFIG.indexPath}`);
    
    // Crear package.json para Render si no existe
    if (!fs.existsSync('./package.json')) {
      log('🔧 Creando package.json para Render');
      
      const packageJson = {
        "name": "whatsapp-bot",
        "version": "1.0.0",
        "description": "WhatsApp Bot with OpenAI integration",
        "main": "index.js",
        "scripts": {
          "start": "node index.js",
          "dev": "nodemon index.js"
        },
        "engines": {
          "node": ">=16.0.0"
        },
        "dependencies": {
          "@supabase/supabase-js": "^2.0.0",
          "axios": "^0.24.0",
          "cors": "^2.8.5",
          "dotenv": "^16.0.0",
          "express": "^4.17.1",
          "node-fetch": "^2.6.7",
          "nodemailer": "^6.7.3",
          "openai": "^4.0.0"
        }
      };
      
      fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, 2), 'utf8');
      log('✅ package.json creado correctamente');
    } else {
      log('✅ package.json ya existe');
    }
    
    log(`🎉 Preparación para Render completada (${modificationsApplied} modificaciones aplicadas)`);
    log('📝 PASOS SIGUIENTES:');
    log('1. Revisa el archivo .env.render y completa las variables de entorno');
    log('2. En Render, configura las mismas variables de entorno');
    log('3. Configura el puerto correcto en Render (normalmente se usa automáticamente)');
    log('4. Asegúrate de que el comando de inicio sea "npm start"');
    
    return true;
  } catch (error) {
    log(`❌ Error durante la preparación: ${error.message}`);
    log(`📋 Stack: ${error.stack}`);
    return false;
  }
}

// Ejecutar la función principal
prepareForRender()
  .then(success => {
    if (success) {
      log('✅ Proceso de preparación para Render finalizado correctamente');
      process.exit(0);
    } else {
      log('❌ Proceso de preparación para Render finalizado con errores');
      process.exit(1);
    }
  })
  .catch(error => {
    log(`❌ Error fatal durante la preparación: ${error.message}`);
    log(`📋 Stack: ${error.stack}`);
    process.exit(1);
  }); 