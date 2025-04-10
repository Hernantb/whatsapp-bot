#!/usr/bin/env node
/**
 * Script para corregir errores de linter en index.js
 * 
 * Este script corrige problemas con comentarios mal formados y errores de sintaxis
 * que están causando problemas con el linter en las funciones de notificación comentadas.
 */

const fs = require('fs');
const path = require('path');

const SOURCE_FILE = path.resolve(__dirname, 'index.js');
const BACKUP_FILE = path.resolve(__dirname, `index.js.backup-${Date.now()}`);

console.log('🔧 Iniciando corrección de errores de linter en index.js...');

// Hacer backup del archivo original
fs.copyFileSync(SOURCE_FILE, BACKUP_FILE);
console.log(`✅ Backup creado: ${BACKUP_FILE}`);

// Leer el contenido del archivo
let content = fs.readFileSync(SOURCE_FILE, 'utf8');

// Corregir los bloques de comentarios mal formados
console.log('🔍 Buscando y corrigiendo comentarios mal formados...');

// Corregir los comentarios de función duplicada que tienen texto después del cierre
content = content.replace(
  /\/\* FUNCIÓN DUPLICADA - COMENTADA AUTOMÁTICAMENTE[\s\S]*?FIN DE FUNCIÓN DUPLICADA \*\/"`\);/g,
  '/* FUNCIÓN DUPLICADA - COMENTADA AUTOMÁTICAMENTE - ELIMINADA */");'
);

// Corregir cualquier template string sin cerrar dentro de comentarios
content = content.replace(
  /(`[\s\S]*?)(\n\/\* FUNCIÓN DUPLICADA)/g,
  '$1`$2'
);

// Eliminar bloques de comentarios problemáticos completamente si es necesario
const problemLines = [3914, 4016, 4055, 4062, 4094, 4135, 4156, 4199, 4219, 4242, 4265, 4302, 4311, 4332, 4346];

// Dividir el contenido en líneas
let lines = content.split('\n');

// Identificar y eliminar bloques de código problemáticos
for (let i = 0; i < problemLines.length; i++) {
  const lineNum = problemLines[i] - 1; // Ajuste para índice basado en 0
  if (lineNum < lines.length) {
    console.log(`🔧 Revisando línea problemática ${problemLines[i]}: ${lines[lineNum].substring(0, 40)}...`);
    
    // Si la línea contiene terminaciones de comentarios problemáticas
    if (lines[lineNum].includes('FIN DE FUNCIÓN DUPLICADA */') && 
        !lines[lineNum].endsWith('*/')) {
      console.log(`   Corrigiendo comentario mal terminado`);
      lines[lineNum] = '/* FUNCIÓN DUPLICADA - ELIMINADA */';
    }
    
    // Corregir template strings sin cerrar
    if (lines[lineNum].includes('`') && 
        !lines[lineNum].split('`').length % 2 === 0) {
      console.log(`   Corrigiendo template string sin cerrar`);
      lines[lineNum] = lines[lineNum] + '`';
    }
  }
}

// Eliminar líneas vacías consecutivas excesivas
console.log('🔍 Eliminando líneas vacías consecutivas excesivas...');
const cleanedLines = [];
let emptyLineCount = 0;

for (const line of lines) {
  if (line.trim() === '') {
    emptyLineCount++;
    if (emptyLineCount <= 2) { // permitir máximo 2 líneas vacías consecutivas
      cleanedLines.push(line);
    }
  } else {
    emptyLineCount = 0;
    cleanedLines.push(line);
  }
}

// Reconstruir el contenido
content = cleanedLines.join('\n');

// Buscar y corregir la declaración final problemática
console.log('🔍 Corrigiendo declaración final problemática...');
if (content.trim().endsWith('// ... existing code ...')) {
  content = content.trim();
  content = content.substring(0, content.lastIndexOf('// ... existing code ...'));
  content += '\n// Fin del archivo\n';
}

// Guardar el contenido corregido
fs.writeFileSync(SOURCE_FILE, content, 'utf8');
console.log('✅ Archivo guardado con las correcciones aplicadas');

console.log('\n✅ Finalizada la corrección de errores de linter'); 