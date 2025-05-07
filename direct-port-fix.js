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

// Verificar si estamos en Render
const isRender = process.env.RENDER === 'true';
console.log(`✅ Entorno Render detectado: ${isRender ? 'SÍ' : 'NO'}`);

// Obtener puerto actual
const port = process.env.PORT || '10000'; 
console.log(`🔍 Puerto configurado: ${port}`);

// Modificar directamente el puerto en el archivo index.js
try {
  const indexPath = path.join(__dirname, 'index.js');
  console.log(`📄 Verificando archivo: ${indexPath}`);

  if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, 'utf8');
    
    // Reemplazar la definición de puerto
    const originalPortPattern = /(const\s+PORT\s*=\s*process\.env\.PORT\s*\|\|\s*)(['"]?\d+['"]?)/;
    
    if (originalPortPattern.test(content)) {
      console.log('🔧 Reemplazando puerto en index.js...');
      const newContent = content.replace(originalPortPattern, `$1"${port}"`);
      
      // Guardar cambios
      fs.writeFileSync(indexPath, newContent, 'utf8');
      console.log('✅ Puerto actualizado en index.js');
    } else {
      console.log('⚠️ No se encontró patrón de puerto en index.js');
    }
  } else {
    console.log('❌ No se encontró el archivo index.js');
  }
} catch (error) {
  console.error(`❌ Error actualizando index.js: ${error.message}`);
}

// Iniciar aplicación correctamente
console.log('🚀 Iniciando aplicación con puerto correcto...');

// Forzar el puerto 10000 para evitar conflictos
process.env.PORT = port;

// Iniciar la aplicación 
console.log(`🌟 Ejecutando con puerto: ${process.env.PORT}`);
require('./index.js'); 