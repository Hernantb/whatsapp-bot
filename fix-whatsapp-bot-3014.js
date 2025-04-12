const fs = require('fs');
const path = require('path');

console.log('🔧 Arreglando el error de await en la línea 3014...');

// Leer el archivo index.js
const indexPath = path.join(__dirname, 'index.js');
let content = fs.readFileSync(indexPath, 'utf8');

// Dividir el contenido en líneas para manejar más fácilmente
const lines = content.split('\n');

// Líneas específicas para identificar dónde está el problema
// Buscar la línea que contiene "const response = await axios.post(url, formData, config);"
let targetLine = -1;
for (let i = 3000; i < 3030; i++) {
  if (i < lines.length && lines[i].includes('const response = await axios.post(url, formData, config);')) {
    targetLine = i;
    break;
  }
}

if (targetLine === -1) {
  console.error('❌ No se encontró la línea problemática');
  process.exit(1);
}

// Verificar si la línea está dentro de una función async
let insideAsyncFunction = false;
for (let i = Math.max(0, targetLine - 50); i < targetLine; i++) {
  if (lines[i].includes('async function') || lines[i].includes('async (')) {
    insideAsyncFunction = true;
    break;
  }
}

if (insideAsyncFunction) {
  console.log('✅ El código ya está dentro de una función async, no es necesario hacer cambios');
  process.exit(0);
}

// Envolver el código en una función async
// Buscar el inicio del bloque de código donde está el await
let blockStart = -1;
for (let i = targetLine - 20; i < targetLine; i++) {
  if (lines[i].includes('try {') || lines[i].includes('function ')) {
    blockStart = i;
    break;
  }
}

if (blockStart === -1) {
  // Si no encontramos un bloque try o función, buscaremos alguna otra estructura
  for (let i = targetLine - 20; i < targetLine; i++) {
    if (lines[i].includes('{')) {
      blockStart = i;
      break;
    }
  }
}

if (blockStart === -1) {
  console.error('❌ No se pudo identificar el inicio del bloque para envolver en async');
  process.exit(1);
}

// Modificar la línea que contiene la función o bloque para hacerla async
if (lines[blockStart].includes('function ')) {
  // Si es una declaración de función, agregarle async
  lines[blockStart] = lines[blockStart].replace('function ', 'async function ');
} else {
  // Si es un bloque de código, envolver el await en una IIFE async
  lines[targetLine] = `    (async () => {
      const response = await axios.post(url, formData, config);
      return response;
    })().then(response => {`;
  
  // Ajustar el código posterior que usa response
  let foundClosingBrace = false;
  for (let i = targetLine + 1; i < targetLine + 20 && !foundClosingBrace; i++) {
    if (lines[i].includes('});')) {
      foundClosingBrace = true;
    }
  }
  
  if (!foundClosingBrace) {
    console.warn('⚠️ No se pudo encontrar el final del bloque para cerrar la IIFE correctamente');
  }
}

// Guardar los cambios
fs.writeFileSync(indexPath, lines.join('\n'));

console.log('✅ Corrección aplicada. Se ha modificado el código para hacer async la función o envolver el await en una IIFE async');
console.log('Por favor, verifica el código modificado para asegurarte de que funciona correctamente');

process.exit(0); 