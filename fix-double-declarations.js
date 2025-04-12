#!/usr/bin/env node
/**
 * Script para corregir duplicaciones en index.js
 * 
 * Este script busca y elimina duplicaciones de funciones en index.js,
 * específicamente las funciones checkForNotificationPhrases y sendBusinessNotification
 * que están duplicadas.
 */

const fs = require('fs');
const path = require('path');

const SOURCE_FILE = path.resolve(__dirname, 'index.js');
const BACKUP_FILE = path.resolve(__dirname, `index.js.backup-${Date.now()}`);

console.log('🔍 Buscando duplicaciones en index.js...');

// Hacer backup del archivo original
fs.copyFileSync(SOURCE_FILE, BACKUP_FILE);
console.log(`✅ Backup creado: ${BACKUP_FILE}`);

// Leer el contenido del archivo
let content = fs.readFileSync(SOURCE_FILE, 'utf8');

// Función genérica para corregir duplicaciones
function fixDuplicateFunction(content, functionName) {
  console.log(`\n🔍 Buscando duplicados de función: ${functionName}`);
  
  // Patrón para encontrar la definición de función
  const regexPattern = new RegExp(
    `(async\\s+)?function\\s+${functionName}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\}`,
    'g'
  );
  
  // Buscar todas las ocurrencias
  let match;
  let occurrences = [];
  
  while ((match = regexPattern.exec(content)) !== null) {
    occurrences.push({
      text: match[0],
      index: match.index,
      length: match[0].length
    });
  }
  
  console.log(`🔍 Se encontraron ${occurrences.length} declaraciones de ${functionName}`);
  
  if (occurrences.length > 1) {
    // Mantener solo la primera ocurrencia y comentar las demás
    let modifiedContent = content;
    
    // Procesamos desde la última a la primera para no alterar los índices
    for (let i = occurrences.length - 1; i > 0; i--) {
      const occurrence = occurrences[i];
      console.log(`🔧 Comentando duplicado #${i} en la posición ${occurrence.index}`);
      
      // Reemplazar la ocurrencia con una versión comentada
      const commentedCode = `
/* FUNCIÓN DUPLICADA - COMENTADA AUTOMÁTICAMENTE
${occurrence.text}
FIN DE FUNCIÓN DUPLICADA */`;
      
      modifiedContent = 
        modifiedContent.substring(0, occurrence.index) +
        commentedCode +
        modifiedContent.substring(occurrence.index + occurrence.length);
    }
    
    console.log(`✅ Se ha corregido la duplicación de ${functionName}`);
    return modifiedContent;
  } else {
    console.log(`✅ No hay duplicaciones de ${functionName} que corregir`);
    return content;
  }
}

// Corregir la función checkForNotificationPhrases
let modifiedContent = fixDuplicateFunction(content, 'checkForNotificationPhrases');

// Corregir la función sendBusinessNotification
modifiedContent = fixDuplicateFunction(modifiedContent, 'sendBusinessNotification');

// Guardar el contenido modificado
fs.writeFileSync(SOURCE_FILE, modifiedContent, 'utf8');
console.log('\n💾 Archivo guardado con todas las correcciones aplicadas');

// Buscar líneas sospechosas que podrían contener más declaraciones
console.log('\n🔍 Buscando otras posibles declaraciones sospechosas...');
const lines = content.split('\n');
const suspectLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('function') && 
      (line.includes('Notification') || 
       line.includes('notification') || 
       line.includes('sendBusiness'))) {
    suspectLines.push({ lineNumber: i + 1, content: line });
  }
}

if (suspectLines.length > 0) {
  console.log('⚠️ Se encontraron líneas sospechosas que podrían contener declaraciones adicionales:');
  suspectLines.forEach(line => {
    console.log(`   Línea ${line.lineNumber}: ${line.content.trim()}`);
  });
  console.log('Se recomienda revisar estas líneas manualmente.');
} else {
  console.log('✅ No se encontraron otras declaraciones sospechosas');
}

console.log('\n✅ Proceso de corrección finalizado'); 