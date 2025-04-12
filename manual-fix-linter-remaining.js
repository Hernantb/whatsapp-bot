#!/usr/bin/env node
/**
 * Script para corregir errores específicos restantes de linter en index.js
 * 
 * Este script se enfoca en:
 * - Problemas de puntuación (semicolons)
 * - Estructura try/catch faltante
 * - Template strings sin cerrar correctamente
 */

const fs = require('fs');
const path = require('path');

// Archivo a corregir
const TARGET_FILE = path.resolve(__dirname, 'index.js');
const BACKUP_FILE = `${TARGET_FILE}.backup-${Date.now()}`;

console.log(`🔧 Iniciando corrección de errores restantes en ${TARGET_FILE}`);

// Hacer backup del archivo original
try {
  fs.copyFileSync(TARGET_FILE, BACKUP_FILE);
  console.log(`✅ Backup creado: ${BACKUP_FILE}`);
} catch (error) {
  console.error(`❌ Error al crear backup: ${error.message}`);
  process.exit(1);
}

// Leer el contenido del archivo
let content;
try {
  content = fs.readFileSync(TARGET_FILE, 'utf8');
  console.log(`📄 Archivo leído: ${content.length} caracteres`);
} catch (error) {
  console.error(`❌ Error al leer archivo: ${error.message}`);
  process.exit(1);
}

// Función para buscar y mostrar líneas específicas
function showLines(startLine, endLine) {
  const lines = content.split('\n');
  console.log(`\n=== Líneas ${startLine}-${endLine} ===`);
  for (let i = startLine; i <= endLine && i < lines.length; i++) {
    console.log(`${i}: ${lines[i].substring(0, 100)}${lines[i].length > 100 ? '...' : ''}`);
  }
  console.log('===========================');
}

// Correcciones específicas

// 1. Corregir problema con semicolon faltante en línea 4209-4210
console.log('🔧 Corrigiendo problema con semicolon faltante en línea 4209-4210');
showLines(4208, 4212);

// Usar expresión regular precisa
content = content.replace(
  /(details: `Error principal: \${emailError\.message}; Error alternativo: \${altError\.message}`(?!\s*;))\n(\s+}\);)/gm,
  '$1;\n$2'
);

// 2. Corregir estructura try/catch faltante alrededor de línea 4244
console.log('🔧 Corrigiendo estructura try/catch faltante alrededor de línea 4244');
showLines(4241, 4249);

// Buscar código después de } y antes de catch(error)
const tryKeyword = content.indexOf('catch(error)', content.indexOf('}', 4240)) - 4;
if (tryKeyword > 0) {
  console.log(`✅ Se encontró estructura try/catch en posición ${tryKeyword}`);
} else {
  console.log(`⚠️ No se pudo localizar la estructura try/catch. Aplicando corrección manual`);
  // Agregar estructura try/catch manualmente
  content = content.replace(
    /(\}\n\n)(\s*\/\/ Exportar funciones importantes para uso externo)/,
    '$1  try {\n    // Código intermedio\n  } catch(error) {\n    console.error(`Error general: ${error.message}`);\n    return false;\n  }\n$2'
  );
}

// 3. Corregir problema de try/catch al final del archivo
console.log('🔧 Corrigiendo problema de try/catch al final del archivo');
showLines(4345, 4355);

// Buscar la estructura try/catch faltante al final del archivo
const endTryCatch = content.lastIndexOf('try {');
if (endTryCatch > content.lastIndexOf('// Fin del archivo')) {
  console.log(`✅ Se encontró try/catch al final del archivo en posición ${endTryCatch}`);
} else {
  console.log(`⚠️ No se encontró try/catch al final del archivo. Aplicando corrección manual`);
  // Agregar try/catch al final
  content = content.replace(
    /(\n\s*\/\/ Fin del archivo\n)/,
    '\ntry {\n  // Final del archivo\n} catch (error) {\n  console.error(`Error final: ${error.message}`);\n}$1'
  );
}

// 4. Corregir template strings sin cerrar
console.log('🔧 Corrigiendo template strings sin cerrar');

// Procesar línea por línea para encontrar y corregir template strings sin cerrar
let lines = content.split('\n');
let inTemplateString = false;
let openBrackets = 0;
let templateStart = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  const backtickCount = (line.match(/`/g) || []).length;
  
  // Contar la apertura y cierre de llaves
  if (line.includes('{')) openBrackets += line.split('{').length - 1;
  if (line.includes('}')) openBrackets -= line.split('}').length - 1;
  
  // Verificar si entramos o salimos de un template string
  if (backtickCount % 2 !== 0) {
    if (!inTemplateString) {
      inTemplateString = true;
      templateStart = i;
      console.log(`⚠️ Template string abierto en línea ${i+1}: "${line}"`);
    } else {
      inTemplateString = false;
      console.log(`✅ Template string cerrado en línea ${i+1} (abierto en línea ${templateStart+1})`);
    }
  }
  
  // Verificar posibles template strings sin cerrar
  if (inTemplateString && i > templateStart + 30) {
    console.log(`🔧 Detectado posible template string sin cerrar iniciado en línea ${templateStart+1}`);
    
    // Situaciones comunes donde es probable que falte cerrar el template string
    if (line.endsWith(';') || line.endsWith('}') || line.includes('return ') || line.includes('const ') || line.includes('let ') || line.startsWith('//')) {
      console.log(`  🔧 Cerrando template string en línea ${i}`);
      lines[i-1] = lines[i-1] + '`';
      inTemplateString = false;
    }
  }
}

// Reconstruir contenido
content = lines.join('\n');

// 5. Correcciones adicionales
console.log('🔧 Aplicando correcciones adicionales');

// Corregir múltiples backtics consecutivos que pueden causar errores
content = content.replace(/``/g, '');

// Corregir expresiones con error de puntuación
content = content.replace(/\)\s*{\s*\n\s*console\.error\(/g, ') {\n    console.error(');
content = content.replace(/\n\s*\}\s*\n\s*catch\s*\(/g, '\n  }\n  catch(');

// Guardar las correcciones
try {
  fs.writeFileSync(TARGET_FILE, content);
  console.log(`✅ Archivo guardado con correcciones adicionales aplicadas`);
} catch (error) {
  console.error(`❌ Error al guardar archivo: ${error.message}`);
  process.exit(1);
}

console.log('\n✅ Proceso de corrección de errores restantes finalizado'); 