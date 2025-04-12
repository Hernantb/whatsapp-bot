#!/usr/bin/env node
/**
 * Script para corregir problemas de conexión con Supabase
 * 
 * Soluciona:
 * 1. Error de cabecera inválida: "Invalid character in header content ["apikey"]"
 * 2. Formato correcto para tokens JWT en cabeceras HTTP
 */

const fs = require('fs');
const path = require('path');

// Configuración
const INDEX_FILE = path.resolve(__dirname, 'index.js');
const NOTIFICATION_PATCH_FILE = path.resolve(__dirname, 'notification-patch.js');
const BACKUP_DIR = path.resolve(__dirname, 'backups');

// Asegurar que existe el directorio de respaldos
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Hacer respaldo de archivos originales
function backupFile(filePath) {
  const fileName = path.basename(filePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `${fileName}.${timestamp}.bak`);
  
  fs.copyFileSync(filePath, backupPath);
  console.log(`✅ Respaldo creado: ${backupPath}`);
  
  return backupPath;
}

// Corregir problemas en index.js
function fixIndexFile() {
  console.log('🔧 Corrigiendo problemas en index.js...');
  
  const backupPath = backupFile(INDEX_FILE);
  let content = fs.readFileSync(INDEX_FILE, 'utf8');
  
  // Buscar código que maneja la autenticación con Supabase
  const supabaseAuthPattern = /const\s+headers\s*=\s*{\s*['"]?apikey['"]?\s*:\s*supabaseKey\s*}/g;
  
  if (content.match(supabaseAuthPattern)) {
    console.log('🔍 Encontrado patrón de autenticación Supabase que necesita corrección');
    
    // Reemplazar con versión corregida que codifica la clave
    content = content.replace(
      supabaseAuthPattern,
      `const headers = {
        'apikey': supabaseKey,
        'Authorization': \`Bearer \${supabaseKey}\`,
        'Content-Type': 'application/json'
      }`
    );
    
    console.log('✅ Patrón de autenticación corregido');
  } else {
    console.log('ℹ️ No se encontró el patrón exacto en index.js, buscando alternativas...');
    
    // Buscar patrones alternativos
    const fetchPattern = /fetch\(\s*`\${supabaseUrl}.*`,\s*{\s*headers\s*:/g;
    if (content.match(fetchPattern)) {
      console.log('🔍 Encontrado patrón de fetch que podría necesitar corrección');
      
      // Insertar una función de utilidad para sanitizar headers
      if (!content.includes('function sanitizeHeaders')) {
        const utilityFunction = `
// Función para sanitizar cabeceras HTTP
function sanitizeHeaders(key) {
  // Asegurar que la clave es válida para HTTP headers
  try {
    return {
      'apikey': key,
      'Authorization': \`Bearer \${key}\`,
      'Content-Type': 'application/json'
    };
  } catch (error) {
    console.error('❌ Error al sanitizar cabeceras:', error.message);
    return {
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json'
    };
  }
}
`;
        
        // Encontrar una posición adecuada para insertar la función
        const insertPosition = content.indexOf('const supabase = createClient');
        if (insertPosition !== -1) {
          content = content.slice(0, insertPosition) + utilityFunction + content.slice(insertPosition);
          console.log('✅ Función sanitizeHeaders agregada');
        }
      }
      
      // Reemplazar instancias de cabeceras con la función sanitizeHeaders
      content = content.replace(
        /headers\s*:\s*{\s*['"]?apikey['"]?\s*:\s*supabaseKey\s*}/g,
        'headers: sanitizeHeaders(supabaseKey)'
      );
      
      console.log('✅ Llamadas a fetch actualizadas para usar sanitizeHeaders');
    }
  }
  
  // Corregir inicialización del cliente Supabase
  const createClientPattern = /const\s+supabase\s*=\s*createClient\(\s*supabaseUrl\s*,\s*supabaseKey\s*\)/g;
  
  if (content.match(createClientPattern)) {
    console.log('🔍 Encontrada inicialización de cliente Supabase');
    
    // Agregar manejo de opciones avanzadas para el cliente Supabase
    content = content.replace(
      createClientPattern,
      `const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        },
        global: {
          headers: {
            'apikey': supabaseKey,
            'Authorization': \`Bearer \${supabaseKey}\`
          }
        }
      })`
    );
    
    console.log('✅ Inicialización del cliente Supabase mejorada');
  }
  
  // Guardar cambios
  fs.writeFileSync(INDEX_FILE, content);
  console.log('💾 Cambios guardados en index.js');
}

// Corregir problemas en notification-patch.js
function fixNotificationPatchFile() {
  if (!fs.existsSync(NOTIFICATION_PATCH_FILE)) {
    console.log('⚠️ El archivo notification-patch.js no existe, saltando...');
    return;
  }
  
  console.log('🔧 Corrigiendo problemas en notification-patch.js...');
  
  const backupPath = backupFile(NOTIFICATION_PATCH_FILE);
  let content = fs.readFileSync(NOTIFICATION_PATCH_FILE, 'utf8');
  
  // Buscar código que inicializa el cliente Supabase
  const supabaseInitPattern = /supabase\s*=\s*createClient\(\s*supabaseUrl\s*,\s*supabaseKey\s*\)/g;
  
  if (content.match(supabaseInitPattern)) {
    console.log('🔍 Encontrada inicialización de cliente Supabase');
    
    // Agregar manejo de opciones avanzadas para el cliente Supabase
    content = content.replace(
      supabaseInitPattern,
      `supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        },
        global: {
          headers: {
            'apikey': supabaseKey,
            'Authorization': \`Bearer \${supabaseKey}\`
          }
        }
      })`
    );
    
    console.log('✅ Inicialización del cliente Supabase mejorada');
  }
  
  // Guardar cambios
  fs.writeFileSync(NOTIFICATION_PATCH_FILE, content);
  console.log('💾 Cambios guardados en notification-patch.js');
}

// Ejecutar correcciones
console.log('🚀 Iniciando corrección de problemas con Supabase...');
fixIndexFile();
fixNotificationPatchFile();
console.log('✅ Correcciones completadas');
console.log('📋 Para aplicar los cambios, reinicia el servidor con: node index.js'); 