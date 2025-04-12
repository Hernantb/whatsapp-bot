#!/usr/bin/env node
/**
 * Script para instalar la solución de Supabase en Render
 * Este script modifica index.js para incluir el helper al inicio.
 */

const fs = require('fs');
const path = require('path');

// Configuración
const INDEX_FILE = path.resolve(__dirname, 'index.js');
const BACKUP_DIR = path.resolve(__dirname, 'backups');

// Crear directorio de backups si no existe
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Crear backup del archivo original
function backupFile(filePath) {
  const fileName = path.basename(filePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `${fileName}.${timestamp}.bak`);
  
  fs.copyFileSync(filePath, backupPath);
  console.log(`✅ Backup creado: ${backupPath}`);
  
  return backupPath;
}

// Verificar si el helper ya está incluido
function isHelperIncluded(content) {
  return content.includes("require('./render-supabase-helper')") ||
         content.includes("require('./supabase-render-helper')");
}

// Instalar el helper en index.js
function installHelper() {
  console.log('🔧 Instalando solución de Supabase para Render...');
  
  // Verificar que el archivo existe
  if (!fs.existsSync(INDEX_FILE)) {
    console.error(`❌ ERROR: El archivo ${INDEX_FILE} no existe`);
    return false;
  }
  
  // Leer el contenido del archivo
  let content = fs.readFileSync(INDEX_FILE, 'utf8');
  
  // Verificar si el helper ya está incluido
  if (isHelperIncluded(content)) {
    console.log('✅ El helper ya está instalado en index.js');
    return true;
  }
  
  // Crear backup
  backupFile(INDEX_FILE);
  
  // Encontrar la posición para insertar el código
  // Buscamos después de las directivas de requerimiento iniciales
  const firstRequirePos = content.indexOf("require(");
  
  if (firstRequirePos === -1) {
    console.error('❌ ERROR: No se encontró un punto de inserción adecuado');
    return false;
  }
  
  // Preparar el código a insertar
  const helperCode = `
// Fix para Supabase en Render
try {
  console.log('🔧 Cargando helper para Supabase en Render...');
  const renderHelper = require('./render-supabase-helper');
  global.sanitizeSupabaseHeaders = renderHelper.sanitizeSupabaseHeaders;
  global.createSecureSupabaseClient = renderHelper.createSecureSupabaseClient;
  console.log('✅ Helper de Supabase cargado correctamente');
} catch (error) {
  console.error('❌ Error al cargar helper de Supabase:', error.message);
}

`;
  
  // Insertar el código al inicio, después de la primera instrucción require
  const endOfFirstRequire = content.indexOf('\n', firstRequirePos);
  const modifiedContent = 
    content.substring(0, endOfFirstRequire + 1) + 
    helperCode + 
    content.substring(endOfFirstRequire + 1);
  
  // Guardar el archivo modificado
  try {
    fs.writeFileSync(INDEX_FILE, modifiedContent, 'utf8');
    console.log('💾 Cambios guardados en index.js');
    return true;
  } catch (error) {
    console.error(`❌ ERROR: No se pudo guardar el archivo: ${error.message}`);
    return false;
  }
}

// Corregir llamadas a createClient en index.js
function fixCreateClientCalls() {
  console.log('🔧 Corrigiendo llamadas a createClient en index.js...');
  
  // Leer el contenido del archivo
  let content = fs.readFileSync(INDEX_FILE, 'utf8');
  
  // Buscar patrones problemáticos y corregirlos
  // 1. Patrón de inicialización de cliente Supabase
  let modified = false;
  
  // Corregir cliente Supabase con opciones problemáticas
  const badOptionsPattern = /createClient\s*\([^,]+,\s*[^,)]+\s*,\s*{[^}]*global\s*:[^}]*}\s*\)/g;
  if (content.match(badOptionsPattern)) {
    console.log('🔍 Encontrada inicialización problemática de Supabase');
    
    content = content.replace(
      badOptionsPattern,
      match => {
        const urlEnd = match.indexOf(',');
        const keyEnd = match.indexOf(',', urlEnd + 1);
        
        // Extraer URL y key de la expresión original
        const url = match.substring(match.indexOf('(') + 1, urlEnd).trim();
        const key = match.substring(urlEnd + 1, keyEnd).trim();
        
        return `createClient(${url}, ${key}, {
          auth: {
            persistSession: false
          }
        })`;
      }
    );
    
    modified = true;
    console.log('✅ Inicialización de cliente Supabase corregida');
  }
  
  // Corregir headers con apikey
  const apikeyPattern = /headers\s*:\s*{\s*['"]?apikey['"]?\s*:\s*([^}]+)\s*}/g;
  if (content.match(apikeyPattern)) {
    console.log('🔍 Encontradas cabeceras con apikey');
    
    content = content.replace(
      apikeyPattern,
      (match, keyVar) => `headers: sanitizeSupabaseHeaders(${keyVar})`
    );
    
    modified = true;
    console.log('✅ Cabeceras con apikey corregidas');
  }
  
  // Guardar los cambios si se realizaron modificaciones
  if (modified) {
    try {
      fs.writeFileSync(INDEX_FILE, content, 'utf8');
      console.log('💾 Correcciones adicionales guardadas en index.js');
      return true;
    } catch (error) {
      console.error(`❌ ERROR: No se pudo guardar el archivo: ${error.message}`);
      return false;
    }
  } else {
    console.log('ℹ️ No se encontraron configuraciones problemáticas adicionales');
    return true;
  }
}

// Ejecutar las funciones
console.log('🚀 Iniciando instalación de la solución Supabase para Render...');
const helperInstalled = installHelper();
const callsFixed = helperInstalled ? fixCreateClientCalls() : false;

if (helperInstalled && callsFixed) {
  console.log('\n✅ Instalación completada con éxito!');
  console.log('\n📋 INSTRUCCIONES:');
  console.log('1. Sube los siguientes archivos a GitHub:');
  console.log('   - index.js (modificado)');
  console.log('   - render-supabase-helper.js');
  console.log('   - fix-render-install.js (opcional)');
  console.log('2. Despliega en Render');
  console.log('3. Si encuentras algún problema, verifica los logs de Render');
} else {
  console.error('\n❌ La instalación no se completó correctamente');
} 