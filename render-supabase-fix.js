/**
 * Script para solucionar problemas de Supabase en entorno Render
 * Este script aplica una solución directa para el error:
 * "Invalid character in header content ["apikey"]"
 */

// Importamos las dependencias necesarias
const fs = require('fs');

// Definimos una función para buscar y reemplazar contenido en archivos
function fixFileContent(filePath, fixes) {
  console.log(`🔧 Aplicando correcciones a ${filePath}...`);

  // Verificar si el archivo existe
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: El archivo ${filePath} no existe`);
    return false;
  }

  // Hacer backup del archivo original
  const backupPath = `${filePath}.bak`;
  fs.copyFileSync(filePath, backupPath);
  console.log(`✅ Backup creado: ${backupPath}`);

  // Leer el contenido del archivo
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Aplicar cada corrección
  for (const fix of fixes) {
    if (content.includes(fix.search)) {
      console.log(`🔍 Encontrado: "${fix.search.substring(0, 30)}..."`);
      content = content.replace(fix.search, fix.replace);
      console.log(`✅ Reemplazado con: "${fix.replace.substring(0, 30)}..."`);
      modified = true;
    }
  }

  // Guardar cambios si se hicieron modificaciones
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`💾 Cambios guardados en ${filePath}`);
    return true;
  } else {
    console.log(`ℹ️ No se requirieron cambios en ${filePath}`);
    return false;
  }
}

// Definir las correcciones específicas
const supabaseCreateClientFix = [
  {
    search: 'createClient(supabaseUrl, supabaseKey)',
    replace: `createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false
      },
      global: {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + supabaseKey
        }
      }
    })`
  }
];

const supabaseFetchFix = [
  {
    search: `headers: {
      apikey: supabaseKey
    }`,
    replace: `headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + supabaseKey
    }`
  },
  {
    search: `headers: { apikey: supabaseKey }`,
    replace: `headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + supabaseKey }`
  }
];

// Aplicar correcciones
console.log('🚀 Iniciando corrección de problemas con Supabase para Render...');

// Lista de archivos a corregir
const filesToFix = [
  './index.js',
  './notification-patch.js',
  './global-patch.js'
];

// Aplicar correcciones a cada archivo
let successCount = 0;
filesToFix.forEach(file => {
  try {
    const clientFixed = fixFileContent(file, supabaseCreateClientFix);
    const fetchFixed = fixFileContent(file, supabaseFetchFix);
    
    if (clientFixed || fetchFixed) {
      successCount++;
    }
  } catch (error) {
    console.error(`❌ Error al procesar ${file}: ${error.message}`);
  }
});

console.log(`✅ Proceso completado. Se modificaron ${successCount} archivos.`);
console.log('📋 Para aplicar los cambios, reinicia el servidor con: node index.js'); 