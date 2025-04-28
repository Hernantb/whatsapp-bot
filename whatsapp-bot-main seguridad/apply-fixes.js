/**
 * Script para aplicar las correcciones de la API de GupShup
 * 
 * Este script modifica los archivos necesarios para corregir los problemas
 * con la API de GupShup, específicamente:
 * 1. Cambia la URL del endpoint de /sm/api/ a /wa/api/
 * 2. Añade el USERID a los headers de autenticación
 * 3. Asegura que el formato del mensaje sea correcto (JSON estructurado)
 */

const fs = require('fs');
const path = require('path');

// Archivos que necesitamos modificar
const filesToModify = [
  'index.js',
  'send-message.js'
];

// Función para leer el contenido de un archivo
function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

// Función para escribir contenido a un archivo
function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

// Función para aplicar las correcciones
function applyFixes(filePath) {
  console.log(`🔧 Procesando ${filePath}...`);
  
  let content = readFile(filePath);
  let modified = false;
  
  // 1. Corregir la URL del endpoint
  if (content.includes('https://api.gupshup.io/sm/api/')) {
    console.log(`✅ Cambiando URLs de /sm/api/ a /wa/api/ en ${filePath}`);
    content = content.replace(/https:\/\/api\.gupshup\.io\/sm\/api\//g, 'https://api.gupshup.io/wa/api/');
    modified = true;
  }
  
  // 2. Añadir el USERID a los headers de autenticación
  if (content.includes("'apikey': apiKey") && !content.includes("'userid': GUPSHUP_USERID")) {
    console.log(`✅ Añadiendo USERID a los headers en ${filePath}`);
    content = content.replace(
      /'apikey': apiKey(\s*)\}/g, 
      "'apikey': apiKey,\\n    'userid': GUPSHUP_USERID // Añadido para mejorar la autenticación$1}"
    );
    modified = true;
  }
  
  // 2.1 Añadir la variable GUPSHUP_USERID si no existe
  if (
    content.includes('const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY') && 
    content.includes('const GUPSHUP_NUMBER = process.env.GUPSHUP_NUMBER') && 
    !content.includes('const GUPSHUP_USERID = process.env.GUPSHUP_USERID')
  ) {
    console.log(`✅ Añadiendo la variable GUPSHUP_USERID en ${filePath}`);
    content = content.replace(
      /const GUPSHUP_NUMBER = process\.env\.GUPSHUP_NUMBER;/g,
      "const GUPSHUP_NUMBER = process.env.GUPSHUP_NUMBER;\nconst GUPSHUP_USERID = process.env.GUPSHUP_USERID;"
    );
    modified = true;
  }
  
  // 3. Asegurar que el formato del mensaje sea correcto (JSON estructurado)
  if (content.includes("formData.append('message', message)") && !content.includes("formData.append('message', JSON.stringify({")) {
    console.log(`✅ Corrigiendo formato de mensaje a JSON estructurado en ${filePath}`);
    content = content.replace(
      /formData\.append\('message', message\);/g,
      "formData.append('message', JSON.stringify({\n      type: 'text',\n      text: message\n    }));"
    );
    modified = true;
  }
  
  // Si hubo modificaciones, guardar el archivo
  if (modified) {
    writeFile(filePath, content);
    console.log(`💾 Cambios guardados en ${filePath}`);
  } else {
    console.log(`ℹ️ No se requieren cambios en ${filePath}`);
  }
}

// Función principal
function main() {
  console.log('🚀 Iniciando script de correcciones para la API de GupShup...');
  
  // Crear una copia de seguridad de los archivos originales
  const backupDir = path.join(__dirname, 'backup-' + Date.now());
  fs.mkdirSync(backupDir, { recursive: true });
  
  filesToModify.forEach(file => {
    const filePath = path.join(__dirname, file);
    const backupPath = path.join(backupDir, file);
    
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, backupPath);
      console.log(`📦 Backup creado: ${backupPath}`);
      
      applyFixes(filePath);
    } else {
      console.log(`⚠️ El archivo ${file} no existe, omitiendo...`);
    }
  });
  
  console.log('✅ Correcciones aplicadas correctamente.');
  console.log(`📁 Los archivos originales se han respaldado en: ${backupDir}`);
  console.log('🔔 Recuerda reiniciar el servidor para que los cambios surtan efecto.');
}

// Ejecutar el script
main(); 