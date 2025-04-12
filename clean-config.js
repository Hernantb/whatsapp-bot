#!/usr/bin/env node

/**
 * Script para limpiar archivos de configuración y eliminar información sensible
 * Ejecutar antes de hacer push a GitHub o desplegar en Render
 */

const fs = require('fs');
const path = require('path');

// Color para mensajes en consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

console.log(`${colors.blue}=== INICIANDO LIMPIEZA DE CONFIGURACIÓN ===${colors.reset}`);

// Archivos y directorios a eliminar
const toDelete = [
  '.env.backup',
  '.env.test',
  '.env.development',
  '.env.production',
  'node_modules',
  'bot_log.txt',
  'nohup.out',
  'server_output.log',
  'server_output_now.log',
  'server_test.log',
  'debug.log',
  'whatsapp_server.log',
  'whatsapp_log.txt',
  'whatsapp-logs.txt',
  'whatsapp_logs.txt'
];

// Eliminar archivos y directorios sensibles
console.log(`\n${colors.yellow}Eliminando archivos sensibles...${colors.reset}`);
toDelete.forEach(item => {
  const itemPath = path.join(__dirname, item);
  try {
    if (fs.existsSync(itemPath)) {
      if (fs.lstatSync(itemPath).isDirectory()) {
        console.log(`${colors.yellow}Directorio encontrado, pero no se eliminará: ${item}${colors.reset}`);
      } else {
        fs.unlinkSync(itemPath);
        console.log(`${colors.green}✓ Eliminado: ${item}${colors.reset}`);
      }
    }
  } catch (error) {
    console.error(`${colors.red}Error al eliminar ${item}: ${error.message}${colors.reset}`);
  }
});

// Busca y elimina copias de seguridad de index.js
const backupFiles = fs.readdirSync(__dirname)
  .filter(file => file.startsWith('index.js.backup') || file.endsWith('.bak') || file.endsWith('.corrupted'));

if (backupFiles.length > 0) {
  console.log(`\n${colors.yellow}Eliminando copias de seguridad de index.js...${colors.reset}`);
  backupFiles.forEach(file => {
    try {
      fs.unlinkSync(path.join(__dirname, file));
      console.log(`${colors.green}✓ Eliminado: ${file}${colors.reset}`);
    } catch (error) {
      console.error(`${colors.red}Error al eliminar ${file}: ${error.message}${colors.reset}`);
    }
  });
}

// Verificar que .env.example no contenga claves reales
console.log(`\n${colors.yellow}Verificando .env.example...${colors.reset}`);
try {
  const envExamplePath = path.join(__dirname, '.env.example');
  if (fs.existsSync(envExamplePath)) {
    const envContent = fs.readFileSync(envExamplePath, 'utf8');
    
    // Patrones de claves a buscar
    const patterns = [
      { regex: /=sk-[a-zA-Z0-9]{20,}/g, name: 'OpenAI API Key' },
      { regex: /=SG\.[a-zA-Z0-9_-]{20,}/g, name: 'SendGrid API Key' },
      { regex: /=eyJ[a-zA-Z0-9_-]{20,}/g, name: 'Supabase Key' },
      { regex: /password=[a-zA-Z0-9\s]{8,}/g, name: 'Password' }
    ];
    
    let foundSecrets = false;
    
    patterns.forEach(pattern => {
      if (pattern.regex.test(envContent)) {
        console.log(`${colors.red}⚠️ Clave real detectada: ${pattern.name}${colors.reset}`);
        foundSecrets = true;
      }
    });
    
    if (!foundSecrets) {
      console.log(`${colors.green}✓ .env.example no contiene claves reales${colors.reset}`);
    }
  } else {
    console.log(`${colors.yellow}⚠️ No se encontró archivo .env.example${colors.reset}`);
  }
} catch (error) {
  console.error(`${colors.red}Error al verificar .env.example: ${error.message}${colors.reset}`);
}

// Verificar archivos con posibles claves expuestas
console.log(`\n${colors.yellow}Buscando archivos con posibles claves expuestas...${colors.reset}`);

const suspiciousPatterns = [
  { regex: /sk-[a-zA-Z0-9]{20,}/g, name: 'OpenAI API Key' },
  { regex: /SG\.[a-zA-Z0-9_-]{20,}/g, name: 'SendGrid API Key' },
  { regex: /eyJ[a-zA-Z0-9_-]{20,}\.eyJ[a-zA-Z0-9_-]{20,}/g, name: 'JWT o Supabase Key' }
];

const filesToCheck = fs.readdirSync(__dirname)
  .filter(file => 
    file.endsWith('.js') && 
    !file.includes('node_modules') && 
    file !== 'clean-config.js' &&
    !file.startsWith('.')
  );

filesToCheck.forEach(file => {
  try {
    const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
    
    suspiciousPatterns.forEach(pattern => {
      const matches = content.match(pattern.regex);
      if (matches) {
        console.log(`${colors.red}⚠️ Posible ${pattern.name} en ${file}${colors.reset}`);
      }
    });
  } catch (error) {
    console.error(`${colors.red}Error al verificar ${file}: ${error.message}${colors.reset}`);
  }
});

console.log(`\n${colors.green}=== LIMPIEZA FINALIZADA ===${colors.reset}`);
console.log(`${colors.yellow}Recuerda actualizar tu .env en el panel de Render con las variables correctas.${colors.reset}`);
console.log(`${colors.yellow}Si encontraste claves expuestas, modifícalas o elimínalas antes de hacer push.${colors.reset}`); 