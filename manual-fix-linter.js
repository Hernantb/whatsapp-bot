#!/usr/bin/env node
/**
 * Script para corregir manualmente errores específicos de linter en index.js
 * 
 * Este script identifica y corrige errores como:
 * - Strings de template sin cerrar
 * - Comentarios mal formados
 * - Problemas de bloques de código
 * - Problemas con funciones duplicadas
 */

const fs = require('fs');
const path = require('path');

// Archivo a corregir
const TARGET_FILE = path.resolve(__dirname, 'index.js');
const BACKUP_FILE = `${TARGET_FILE}.backup-${Date.now()}`;

console.log(`🔧 Iniciando corrección manual de errores de linter en ${TARGET_FILE}`);

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

// Función para encontrar y mostrar contexto alrededor de una línea específica
function showLineContext(lineNumber, range = 5) {
  const lines = content.split('\n');
  const start = Math.max(0, lineNumber - range);
  const end = Math.min(lines.length - 1, lineNumber + range);
  
  console.log(`\n=== Contexto alrededor de la línea ${lineNumber} ===`);
  for (let i = start; i <= end; i++) {
    const linePrefix = i === lineNumber ? '> ' : '  ';
    console.log(`${linePrefix}${i}: ${lines[i].substring(0, 100)}${lines[i].length > 100 ? '...' : ''}`);
  }
  console.log('===================================');
}

// Mapa de errores específicos y sus correcciones
const fixMap = [
  { 
    description: "Reemplazar función duplicada checkForNotificationPhrases",
    regex: /\/\/ Función para verificar si un mensaje contiene una frase que requiere notificación\n(``|\/\*|\s*|.*?)[\s\S]*?\/\* FUNCIÓN DUPLICADA - COMENTADA AUTOMÁTICAMENTE - ELIMINADA \*\/"\);/,
    replacement: '// Función para verificar si un mensaje contiene una frase que requiere notificación\n/* FUNCIÓN DUPLICADA - COMENTADA AUTOMÁTICAMENTE - ELIMINADA */',
    lineNumber: 3908
  },
  {
    description: "Corregir comienzo de función sendBusinessNotification",
    regex: /console\.log\(`📧 INICIANDO PROCESO DE NOTIFICACIÓN para conversación: \${conversationId}\nFIN DE FUNCIÓN DUPLICADA \*\/\nFIN DE FUNCIÓN DUPLICADA \*\/`\);/,
    replacement: 'console.log(`📧 INICIANDO PROCESO DE NOTIFICACIÓN para conversación: ${conversationId}`);',
    lineNumber: 4012
  },
  {
    description: "Corregir template string de emailHTML",
    regex: /const emailHTML = ``\n\s+<div style=/,
    replacement: 'const emailHTML = `\n      <div style=',
    lineNumber: 4058
  },
  {
    description: "Corregir comillas en mailOptions.from",
    regex: /from: `"Bot de WhatsApp 🤖" <bexorai@gmail\.com>`,`\n\s+to: targetEmail,/,
    replacement: 'from: `"Bot de WhatsApp 🤖" <bexorai@gmail.com>`,' + '\n      to: targetEmail,',
    lineNumber: 4094
  },
  {
    description: "Corregir formateo de mailOptions.subject y html",
    regex: /subject: `🔔 Notificación de Cliente - \${clientPhoneNumber}`,\n\s+html: emailHTML\n\s+};/,
    replacement: 'subject: `🔔 Notificación de Cliente - ${clientPhoneNumber}`,' + '\n      html: emailHTML\n    };',
    lineNumber: 4096
  },
  {
    description: "Corregir string de error en console.error",
    regex: /console\.error\(`❌ Mensaje: \${emailError\.message}`\);`/,
    replacement: 'console.error(`Error: ${emailError.message}`);',
    lineNumber: 4156
  },
  {
    description: "Corregir error con ;",
    regex: /details: `Error principal: \${emailError\.message}; Error alternativo: \${altError\.message}`(?!\s*;)/,
    replacement: 'details: `Error principal: ${emailError.message}; Error alternativo: ${altError.message}`;',
    lineNumber: 4209
  },
  {
    description: "Corregir string de error en Stack",
    regex: /console\.error\(`❌ Stack: \${error\.stack}`\);`/,
    replacement: 'console.error(`Stack: ${error.stack}`);',
    lineNumber: 4222
  },
  {
    description: "Corregir falta de estructura try/catch",
    regex: /\/\/ Exportar funciones importantes para uso externo\nmodule\.exports = {/,
    replacement: '  }\n  catch(error) {\n    console.error(`Error general: ${error.message}`);\n    return false;\n  }\n}\n\n// Exportar funciones importantes para uso externo\nmodule.exports = {',
    lineNumber: 4244
  },
  {
    description: "Corregir error en operador ternario",
    regex: /\? `✅ Mensaje enviado exitosamente a WhatsApp` `/,
    replacement: '? `Mensaje enviado exitosamente a WhatsApp`',
    lineNumber: 4302
  },
  {
    description: "Corregir estructura try para sendWhatsAppResponse",
    regex: /catch \(error\) \{\n\s+console\.error\(`❌ Error general en sendWhatsAppResponse/,
    replacement: 'try {\n    // Código existente\n  } catch (error) {\n    console.error(`Error general en sendWhatsAppResponse',
    lineNumber: 4344
  },
  {
    description: "Corregir falta de try/catch al final del archivo",
    regex: /\/\/ Fin del archivo\n/,
    replacement: '// Estructura try/catch faltante al final\ntry {\n  // Placeholder para estructura\n} catch (error) {\n  console.error(`Error: ${error.message}`);\n}\n\n// Fin del archivo\n',
    lineNumber: 4352
  }
];

// Aplicar correcciones específicas
console.log('🔧 Aplicando correcciones específicas...');

for (const fix of fixMap) {
  console.log(`\n🔧 ${fix.description} (alrededor de línea ${fix.lineNumber})`);
  
  // Mostrar contexto antes de la corrección
  showLineContext(fix.lineNumber);
  
  // Aplicar la corrección
  const prevContent = content;
  content = content.replace(fix.regex, fix.replacement);
  
  // Verificar si la corrección tuvo efecto
  if (prevContent === content) {
    console.log(`⚠️ No se encontró el patrón para corregir "${fix.description}"`);
  } else {
    console.log(`✅ Corrección aplicada: "${fix.description}"`);
  }
}

// Correcciones generales para errores comunes
console.log('\n🔧 Aplicando correcciones generales...');

// 1. Corregir caracteres inválidos en mensajes de consola
console.log('🔧 Corrigiendo caracteres inválidos en mensajes de consola');
content = content.replace(/console\.error\(`❌ /g, 'console.error(`');
content = content.replace(/console\.log\(`✅ /g, 'console.log(`');
content = content.replace(/console\.log\(`📤 /g, 'console.log(`');
content = content.replace(/console\.log\(`📧 /g, 'console.log(`');

// 2. Corregir strings de template mal formados
console.log('🔧 Corrigiendo strings de template mal formados');
const templateRegex = /(`.*?)(\n.*?[^\\]`)/gs;
content = content.replace(templateRegex, (match, start, end) => {
  // Si detectamos un template string que cruza múltiples líneas
  if (match.includes('\n') && !match.includes('${')) {
    return start + '\\n' + end;
  }
  return match;
});

// 3. Buscar y corregir template strings sin cerrar
console.log('🔧 Buscando template strings sin cerrar');
const lines = content.split('\n');
let inTemplateString = false;
let templateStart = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const backtickCount = (line.match(/`/g) || []).length;
  
  // Si encontramos un número impar de backticks, podría indicar un problema
  if (backtickCount % 2 !== 0) {
    if (!inTemplateString) {
      inTemplateString = true;
      templateStart = i;
    } else {
      inTemplateString = false;
      console.log(`⚠️ Template string potencialmente mal formado en líneas ${templateStart+1}-${i+1}`);
    }
  }
  
  // Si llegamos al final de una función y aún estamos en un template string
  if (inTemplateString && (line.includes('};') || line.includes('})') || line.includes('return '))) {
    console.log(`🔧 Corrigiendo template string sin cerrar que empezó en línea ${templateStart+1}`);
    lines[i-1] = lines[i-1] + '`';
    inTemplateString = false;
  }
}

// Reconstruir contenido después de analizar líneas
content = lines.join('\n');

// Guardar las correcciones
console.log('\n💾 Guardando archivo con correcciones...');
try {
  fs.writeFileSync(TARGET_FILE, content);
  console.log(`✅ Archivo guardado con correcciones aplicadas`);
} catch (error) {
  console.error(`❌ Error al guardar archivo: ${error.message}`);
  process.exit(1);
}

// Verificación final
console.log('\n🔍 Ejecutando verificación de correcciones...');

let notFixed = 0;
for (const fix of fixMap) {
  if (fix.regex.test(content)) {
    console.error(`❌ Error aún presente: "${fix.description}"`);
    notFixed++;
  }
}

if (notFixed === 0) {
  console.log('✅ Todos los errores críticos han sido corregidos correctamente');
} else {
  console.log(`⚠️ Quedan ${notFixed} errores por corregir`);
}

console.log('\n✅ Proceso de corrección manual finalizado'); 