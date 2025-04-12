// Script para arreglar los errores en el bot de WhatsApp
const fs = require('fs');
const path = require('path');

console.log('🔧 Iniciando reparación del bot de WhatsApp...');

// Leer el archivo index.js
const indexPath = path.join(__dirname, 'index.js');
let indexContent = fs.readFileSync(indexPath, 'utf8');

// Arreglo 1: Usar el import de sendTextMessageGupShup en lugar de la definición duplicada
// Buscar la definición duplicada (línea ~2972)
const oldFunctionDefinition = /async function sendTextMessageGupShup\(phoneNumber, text\) \{[\s\S]+?(?=\/\/ Endpoint|\};\n\n)/g;
const replacement = '// Usar la versión importada del módulo sendTextMessageGupShup\nconst { sendTextMessageGupShup } = require(\'./sendTextMessageGupShup\');\n\n';

// Reemplazar la función duplicada con el import
let updatedContent = indexContent.replace(oldFunctionDefinition, replacement);

// Arreglo 2: Convertir el código con await en función async (línea ~3014)
// Buscar el código con await fuera de función async
const asyncCodeRegex = /const response = await axios\.post\(url, formData, config\);/g;
const asyncCodeMatch = updatedContent.match(asyncCodeRegex);

if (asyncCodeMatch) {
  // Verificar si ya está dentro de una función async
  // Si no, envolver en una función async
  const surroundingCode = updatedContent.substring(
    Math.max(0, updatedContent.indexOf(asyncCodeMatch[0]) - 200),
    Math.min(updatedContent.length, updatedContent.indexOf(asyncCodeMatch[0]) + 300)
  );
  
  // Si no está dentro de una función async, envolver o corregir
  if (!surroundingCode.includes('async function') && !surroundingCode.includes('async (')) {
    console.error('❌ Error: Código con await fuera de función async detectado, pero no se pudo corregir automáticamente.');
    console.error('Por favor, revisa manualmente el código alrededor de la línea ~3014 que contiene:');
    console.error(asyncCodeMatch[0]);
  }
}

// Guardar los cambios
fs.writeFileSync(indexPath, updatedContent);

console.log('✅ Reparación completa. Se han aplicado los siguientes cambios:');
console.log('1. Eliminada duplicación de función sendTextMessageGupShup');
console.log('Se recomienda revisar el código alrededor de la línea 3014 para verificar si quedó dentro de una función async.');

process.exit(0); 