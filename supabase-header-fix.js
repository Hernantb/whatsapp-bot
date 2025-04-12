/**
 * Script avanzado para corregir problemas de cabeceras en Supabase
 * Resuelve el error "Invalid character in header content ["apikey"]"
 */

const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Crear backup del archivo antes de modificarlo
function createBackup(filePath) {
  const fileName = path.basename(filePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `${fileName}.${timestamp}.bak`);
  
  fs.copyFileSync(filePath, backupPath);
  console.log(`✅ Backup creado: ${backupPath}`);
  return backupPath;
}

// Función para analizar y corregir archivos
function analyzeAndFix(filePath) {
  console.log(`\n🔍 Analizando archivo: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: Archivo no encontrado: ${filePath}`);
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Buscar todos los patrones relacionados con Supabase
  const supabasePatterns = {
    createClient: /createClient\s*\(\s*([^,]+)\s*,\s*([^,)]+)(?:\s*,\s*({[^}]*}))?/g,
    apikey: /['"]?apikey['"]?\s*:\s*([^,}]+)/g,
    fetchHeaders: /headers\s*:\s*\{\s*([^}]+)\s*\}/g
  };
  
  // Patrones específicos en el contenido
  const createClientMatches = [...content.matchAll(supabasePatterns.createClient)];
  const apikeyMatches = [...content.matchAll(supabasePatterns.apikey)];
  const fetchHeadersMatches = [...content.matchAll(supabasePatterns.fetchHeaders)];
  
  console.log(`🔎 Encontrados:`);
  console.log(`  - createClient: ${createClientMatches.length} ocurrencias`);
  console.log(`  - headers con apikey: ${apikeyMatches.length} ocurrencias`);
  console.log(`  - fetch con headers: ${fetchHeadersMatches.length} ocurrencias`);
  
  if (createClientMatches.length === 0 && apikeyMatches.length === 0) {
    console.log(`⏩ No se encontraron patrones a corregir en ${filePath}`);
    return false;
  }
  
  // Crear backup antes de modificar
  createBackup(filePath);
  
  // 1. Corregir inicialización de cliente Supabase
  createClientMatches.forEach(match => {
    const fullMatch = match[0];
    const urlVar = match[1];
    const keyVar = match[2];
    const existingOptions = match[3] || '';
    
    if (!existingOptions.includes('headers')) {
      const replacement = `createClient(${urlVar}, ${keyVar}, {
        auth: { persistSession: false },
        global: {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + ${keyVar}
          }
        }
      })`;
      
      content = content.replace(fullMatch, replacement);
      console.log(`✅ Corregida inicialización de cliente Supabase`);
    }
  });
  
  // 2. Corregir referencias a apikey en headers
  apikeyMatches.forEach(match => {
    const fullMatch = match[0];
    const keyVar = match[1];
    
    // Evitar reemplazar dentro de comentarios
    const beforeMatch = content.substring(Math.max(0, content.indexOf(fullMatch) - 50), content.indexOf(fullMatch));
    if (!beforeMatch.includes('//') && !beforeMatch.endsWith('/*')) {
      const replacement = `'Authorization': 'Bearer ' + ${keyVar}, 'Content-Type': 'application/json'`;
      content = content.replace(fullMatch, replacement);
      console.log(`✅ Corregida cabecera apikey en headers`);
    }
  });
  
  // 3. Agregar función auxiliar para sanitizar headers
  if (apikeyMatches.length > 0 && !content.includes('function sanitizeHeaders')) {
    const helperFunction = `
// Función para sanitizar cabeceras HTTP para Supabase
function sanitizeHeaders(key) {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + key
  };
}
`;
    
    // Insertar la función después de las importaciones
    const importEndIndex = content.indexOf('require(') + 300;
    const insertPosition = content.indexOf('\n\n', importEndIndex);
    
    if (insertPosition !== -1) {
      content = content.slice(0, insertPosition) + '\n' + helperFunction + content.slice(insertPosition);
      console.log(`✅ Agregada función sanitizeHeaders para manejar cabeceras`);
    }
  }
  
  // Verificar si se hicieron cambios
  if (content === originalContent) {
    console.log(`ℹ️ No se requirieron cambios en el contenido de ${filePath}`);
    return false;
  }
  
  // Guardar cambios
  fs.writeFileSync(filePath, content);
  console.log(`💾 Guardados cambios en ${filePath}`);
  return true;
}

// Modificar el archivo global-patch.js para corregir las variables de entorno
function fixGlobalPatch() {
  const filePath = path.join(__dirname, 'global-patch.js');
  console.log(`\n🔍 Verificando configuración de variables de entorno en ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ El archivo ${filePath} no existe, saltando...`);
    return false;
  }
  
  createBackup(filePath);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Agregar código para asegurar que SUPABASE_KEY esté siempre disponible
  if (!content.includes('process.env.SUPABASE_KEY = process.env.SUPABASE_KEY ||')) {
    const supabaseKeyCode = `
// Asegurar que SUPABASE_KEY está disponible
if (!process.env.SUPABASE_KEY && process.env.SUPABASE_ANON_KEY) {
  console.log('📌 GLOBAL-PATCH: Copiando SUPABASE_ANON_KEY a SUPABASE_KEY');
  process.env.SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
}

// Si tenemos clave de Supabase pero no URL, usar la predeterminada
if (process.env.SUPABASE_KEY && !process.env.SUPABASE_URL) {
  console.log('📌 GLOBAL-PATCH: Configurando URL predeterminada de Supabase');
  process.env.SUPABASE_URL = 'https://wscijkxwevgxbgwhbqtm.supabase.co';
}

`;
    
    // Buscar una posición adecuada para insertar el código
    const insertPos = content.indexOf('console.log(') > -1 
      ? content.indexOf('console.log(') 
      : content.indexOf('module.exports');
    
    if (insertPos > -1) {
      content = content.slice(0, insertPos) + supabaseKeyCode + content.slice(insertPos);
      fs.writeFileSync(filePath, content);
      console.log(`✅ Agregada configuración adicional para variables de entorno de Supabase`);
      return true;
    }
  } else {
    console.log(`ℹ️ La configuración de variables ya existe en ${filePath}`);
  }
  
  return false;
}

// Crear helper directo para Render
function createRenderHelper() {
  const filePath = path.join(__dirname, 'supabase-render-helper.js');
  console.log(`\n🔍 Creando helper específico para Render: ${filePath}`);
  
  const helperContent = `/**
 * Helper específico para resolver problemas de Supabase en Render
 * 
 * Este archivo debe ser importado al inicio de index.js en Render:
 * require('./supabase-render-helper');
 */

console.log('🔧 Supabase Render Helper: Iniciando...');

// 1. Asegurar que las variables de entorno estén disponibles
if (!process.env.SUPABASE_KEY && process.env.SUPABASE_ANON_KEY) {
  console.log('🔑 Supabase Render Helper: Copiando SUPABASE_ANON_KEY a SUPABASE_KEY');
  process.env.SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
}

if (!process.env.SUPABASE_URL) {
  console.log('🔗 Supabase Render Helper: Configurando URL predeterminada');
  process.env.SUPABASE_URL = 'https://wscijkxwevgxbgwhbqtm.supabase.co';
}

// 2. Sobreescribir createClient para normalizar las opciones
const originalCreateClient = require('@supabase/supabase-js').createClient;
const supabaseModule = require('@supabase/supabase-js');

supabaseModule.createClient = function(url, key, options = {}) {
  console.log('🔄 Supabase Render Helper: Interceptando createClient con opciones seguras');
  
  // Crear opciones seguras
  const safeOptions = {
    ...options,
    auth: {
      ...(options.auth || {}),
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      ...(options.global || {}),
      headers: {
        ...(options.global?.headers || {}),
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${key}\`
      }
    }
  };
  
  // Eliminar apikey si existe
  if (safeOptions.global?.headers?.apikey) {
    delete safeOptions.global.headers.apikey;
  }
  
  return originalCreateClient(url, key, safeOptions);
};

// 3. Parche para fetch y node-fetch
const originalFetch = global.fetch;
if (originalFetch) {
  global.fetch = function(url, options = {}) {
    // Si es una URL de Supabase y hay headers con apikey
    if (url.includes('supabase') && options.headers && 
        (options.headers.apikey || options.headers['apikey'])) {
      
      console.log('🔄 Supabase Render Helper: Interceptando fetch con cabeceras seguras');
      
      // Obtener la apikey
      const apiKey = options.headers.apikey || options.headers['apikey'];
      
      // Crear headers seguros
      options.headers = {
        ...options.headers,
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${apiKey}\`
      };
      
      // Eliminar apikey
      delete options.headers.apikey;
      delete options.headers['apikey'];
    }
    
    return originalFetch(url, options);
  };
}

console.log('✅ Supabase Render Helper: Inicializado correctamente');
`;

  fs.writeFileSync(filePath, helperContent);
  console.log(`✅ Helper para Render creado en ${filePath}`);
  
  return true;
}

// Agregar el helper a index.js si no existe
function addHelperToIndex() {
  const filePath = path.join(__dirname, 'index.js');
  console.log(`\n🔍 Verificando si el helper está incluido en ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ El archivo ${filePath} no existe, saltando...`);
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes("require('./supabase-render-helper')")) {
    createBackup(filePath);
    
    // Insertar require al inicio del archivo después de los comentarios iniciales
    const insertPos = content.indexOf("require(") > 0 
      ? content.indexOf("require(") 
      : (content.indexOf("const ") > 0 ? content.indexOf("const ") : 0);
    
    if (insertPos > 0) {
      const newContent = content.slice(0, insertPos) + 
                        "// Fix para Supabase en Render\nrequire('./supabase-render-helper');\n\n" + 
                        content.slice(insertPos);
      
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ Helper añadido a ${filePath}`);
      return true;
    }
  } else {
    console.log(`ℹ️ El helper ya está incluido en ${filePath}`);
  }
  
  return false;
}

// Ejecutar correcciones
console.log('🚀 Iniciando corrección avanzada de problemas con Supabase...');

// Lista de archivos a analizar y corregir
const filesToFix = [
  path.join(__dirname, 'index.js'),
  path.join(__dirname, 'notification-patch.js')
];

// Analizar y corregir cada archivo
let successCount = 0;
filesToFix.forEach(file => {
  try {
    if (analyzeAndFix(file)) {
      successCount++;
    }
  } catch (error) {
    console.error(`❌ Error al procesar ${file}: ${error.message}`);
  }
});

// Arreglar global-patch.js
try {
  if (fixGlobalPatch()) {
    successCount++;
  }
} catch (error) {
  console.error(`❌ Error al procesar global-patch.js: ${error.message}`);
}

// Crear helper para Render
try {
  if (createRenderHelper()) {
    successCount++;
  }
} catch (error) {
  console.error(`❌ Error al crear helper para Render: ${error.message}`);
}

// Agregar el helper a index.js
try {
  if (addHelperToIndex()) {
    successCount++;
  }
} catch (error) {
  console.error(`❌ Error al agregar helper a index.js: ${error.message}`);
}

console.log(`\n✅ Proceso completado. Se modificaron ${successCount} archivos.`);
console.log(`\n📋 INSTRUCCIONES:
1. Sube los cambios a tu repositorio
2. Asegúrate de que estos archivos estén incluidos:
   - supabase-render-helper.js
   - index.js (modificado)
   - global-patch.js (modificado)
3. Despliega en Render
4. Si aún hay problemas, verifica los logs para identificar errores específicos`); 