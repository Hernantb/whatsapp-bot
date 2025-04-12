/**
 * Script para modificar la conexión Supabase en index.js
 * 
 * Este script identifica y modifica las partes del código en index.js 
 * que crean y utilizan la conexión a Supabase para hacerla compatible con Render.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Ruta al archivo principal
const indexPath = path.resolve(__dirname, 'index.js');

// Verifica si estamos en Render
const isRender = process.env.RENDER === 'true' || process.env.RENDER_SERVICE_ID;

console.log(`📝 Iniciando parche Supabase para ${isRender ? 'Render' : 'desarrollo local'}`);
console.log(`📂 Trabajando en archivo: ${indexPath}`);

// Crea una copia de seguridad antes de modificar
const backupPath = `${indexPath}.backup-${Date.now()}`;
try {
  fs.copyFileSync(indexPath, backupPath);
  console.log(`✅ Backup creado en: ${backupPath}`);
} catch (error) {
  console.error(`❌ Error al crear backup: ${error.message}`);
  process.exit(1);
}

// Lee el contenido del archivo
let content;
try {
  content = fs.readFileSync(indexPath, 'utf8');
  console.log(`✅ Archivo leído correctamente (${content.length} bytes)`);
} catch (error) {
  console.error(`❌ Error al leer archivo: ${error.message}`);
  process.exit(1);
}

// Patrones a buscar y reemplazar
const replacements = [
  // 1. Agregar importación del helper
  {
    pattern: /^(const\s+\{\s*createClient\s*\}\s*=\s*require\(['"]@supabase\/supabase-js['"])/m,
    replacement: '// Importar helper para Render\nconst supabaseHelper = require(\'./render-supabase-helper\');\n\n$1'
  },
  
  // 2. Reemplazar createClient directo por versión segura
  {
    pattern: /const\s+supabase\s*=\s*createClient\(\s*process\.env\.SUPABASE_URL\s*,\s*process\.env\.SUPABASE_KEY\s*(?:,\s*\{[^}]*\})?\s*\)/m,
    replacement: '// Usar cliente seguro para Render\nconst supabase = supabaseHelper.createSecureSupabaseClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)'
  },
  
  // 3. Cambiar headers en fetchConversation y otras funciones
  {
    pattern: /(const\s+response\s*=\s*await\s+fetch\([^,]+,\s*\{\s*(?:method:[^,]+,\s*)?headers\s*:\s*\{\s*(?:'Content-Type'|"Content-Type"):[^,]+,\s*(?:'apikey'|"apikey"):[^}]+\})/g,
    replacement: '$1\n    // Usar headers seguros para Render\n    headers: supabaseHelper.sanitizeSupabaseHeaders(process.env.SUPABASE_KEY)'
  }
];

// Aplica los reemplazos
let modifiedContent = content;
let totalChanges = 0;

replacements.forEach((replacement, index) => {
  const before = modifiedContent;
  modifiedContent = modifiedContent.replace(replacement.pattern, replacement.replacement);
  
  const changed = before !== modifiedContent;
  const changeCount = changed ? 1 : 0;
  totalChanges += changeCount;
  
  console.log(`🔄 Reemplazo #${index + 1}: ${changed ? '✅ Aplicado' : '⚠️ No encontrado'}`);
});

// Guarda el archivo modificado
if (totalChanges > 0) {
  try {
    fs.writeFileSync(indexPath, modifiedContent);
    console.log(`✅ Guardado archivo con ${totalChanges} cambios aplicados`);
  } catch (error) {
    console.error(`❌ Error al guardar cambios: ${error.message}`);
    process.exit(1);
  }
} else {
  console.warn('⚠️ No se encontraron patrones para reemplazar');
}

// Verificar que no hay errores de sintaxis
try {
  execSync(`node --check ${indexPath}`);
  console.log('✅ Verificación de sintaxis completada sin errores');
} catch (error) {
  console.error('❌ ¡ERROR! El archivo modificado tiene errores de sintaxis:');
  console.error(error.stdout ? error.stdout.toString() : error.message);
  
  // Restaurar desde backup si hay errores
  try {
    fs.copyFileSync(backupPath, indexPath);
    console.log('✅ Archivo restaurado desde backup debido a errores');
  } catch (restoreError) {
    console.error(`❌ Error al restaurar backup: ${restoreError.message}`);
  }
  
  process.exit(1);
}

console.log('✅ Parche Supabase completado con éxito');

// Si estamos en Render, continuar con la ejecución normal
if (isRender) {
  console.log('🚀 Ejecutando en entorno Render, continuando...');
} else {
  console.log('🛑 Ejecutando en entorno local, script finalizado');
} 