/**
 * Emergency port fix for Render
 * Este script arregla directamente el puerto en el archivo index.js
 * para evitar conflictos con Next.js
 */

// Primero reemplazamos el puerto en index.js directamente,
// ya que Render parece estar ignorando render-start.js
const fs = require('fs');
const path = require('path');

console.log('🚨 ARREGLO DE EMERGENCIA PARA PUERTO EN RENDER');
console.log('🔒 FORZANDO PUERTO 10000 para evitar conflictos con Next.js');

// Verificar si estamos en Render
const isRender = process.env.RENDER === 'true';
console.log(`✅ Entorno Render detectado: ${isRender ? 'SÍ' : 'NO'}`);

// Obtener puerto actual - Forzar siempre a 10000 para evitar conflictos
const port = '10000'; // Forzar explícitamente
process.env.PORT = port;
console.log(`🔧 Puerto forzado a: ${port}`);

// Modificar directamente el puerto en el archivo index.js
try {
  const indexPath = path.join(__dirname, 'index.js');
  console.log(`📄 Verificando archivo: ${indexPath}`);

  if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, 'utf8');
    let modified = false;
    
    // 1. Reemplazar la definición de puerto
    console.log('🔧 Reemplazando definición de PORT en index.js...');
    const portPattern = /const\s+PORT\s*=\s*process\.env\.PORT\s*\|\|\s*(['"]?\d+['"]?)/;
    if (portPattern.test(content)) {
      content = content.replace(portPattern, `const PORT = "${port}"; // Forzado por direct-port-fix.js`);
      modified = true;
      console.log('✅ Definición de PORT modificada exitosamente');
    } else {
      console.log('⚠️ No se encontró patrón estándar de PORT');
    }
    
    // 2. Asegurar que app.listen use PORT o el puerto correcto directamente
    console.log('🔧 Verificando app.listen...');
    if (content.includes('app.listen(PORT')) {
      console.log('✅ app.listen ya usa la variable PORT, no se requieren cambios');
    } else {
      // Buscar cualquier patrón de app.listen con un puerto directamente
      const listenPattern = /app\.listen\(\d+/g;
      if (content.match(listenPattern)) {
        content = content.replace(listenPattern, `app.listen(${port}`);
        modified = true;
        console.log('✅ Llamada a app.listen modificada para usar puerto 10000');
      } else {
        console.log('⚠️ No se encontró app.listen con puerto directo');
      }
    }
    
    // 3. Medida extrema: Reemplazar todas las ocurrencias de 3000 por 10000
    // Esto podría afectar URLs u otros valores, pero en una emergencia es necesario
    console.log('🔧 Reemplazando todas las ocurrencias de puerto 3000...');
    if (content.includes('"3000"') || content.includes("'3000'") || content.includes(":3000")) {
      content = content.replace(/(['"])3000(['"])/g, `$110000$2`);
      content = content.replace(/:3000\b/g, `:10000`);
      modified = true;
      console.log('✅ Ocurrencias de "3000" reemplazadas por "10000"');
    }
    
    // 4. Agregar código de emergencia al principio del archivo
    console.log('🔧 Agregando código de emergencia al inicio del archivo...');
    const emergencyCode = `
// 🚨 CÓDIGO DE EMERGENCIA PARA PUERTO - AGREGADO POR direct-port-fix.js
process.env.PORT = '${port}';
console.log('⚠️ PUERTO FORZADO A ${port} PARA EVITAR CONFLICTOS');
// FIN CÓDIGO DE EMERGENCIA
`;
    content = emergencyCode + content;
    modified = true;
    
    // Guardar cambios
    if (modified) {
      fs.writeFileSync(indexPath, content, 'utf8');
      console.log('✅ Archivo index.js actualizado con múltiples correcciones de puerto');
    } else {
      console.log('⚠️ No se realizaron cambios en index.js');
    }
  } else {
    console.log('❌ No se encontró el archivo index.js');
  }
} catch (error) {
  console.error(`❌ Error actualizando index.js: ${error.message}`);
}

// Verificar si hay un archivo .env y modificarlo también
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    console.log('📄 Encontrado archivo .env, actualizando...');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Reemplazar o agregar PORT
    if (envContent.includes('PORT=')) {
      envContent = envContent.replace(/PORT=\d+/, `PORT=${port}`);
    } else {
      envContent += `\nPORT=${port}\n`;
    }
    
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('✅ Archivo .env actualizado');
  }
} catch (envError) {
  console.log(`⚠️ No se pudo actualizar archivo .env: ${envError.message}`);
}

// Iniciar aplicación correctamente
console.log('🚀 Iniciando aplicación con puerto correcto...');
console.log(`🌟 Ejecutando con puerto: ${process.env.PORT}`);

// Iniciar la aplicación 
require('./index.js'); 