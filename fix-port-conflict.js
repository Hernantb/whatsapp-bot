/**
 * Script para solucionar conflicto de puertos en Render
 * 
 * Este script modifica los archivos de configuración para usar puertos diferentes
 * y evitar conflictos entre la aplicación Next.js y el servidor Express del bot
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Iniciando script para solucionar conflicto de puertos...');

// Función para modificar el puerto en index.js
function fixIndexJsPort() {
  const indexPath = path.join(__dirname, 'index.js');
  
  try {
    console.log(`📂 Leyendo archivo: ${indexPath}`);
    let content = fs.readFileSync(indexPath, 'utf8');
    
    // Buscar la línea que define el puerto
    const portPattern = /(const\s+PORT\s*=\s*process\.env\.PORT\s*\|\|\s*)(['"]?\d+['"]?)/;
    
    if (portPattern.test(content)) {
      // Cambiar el puerto por defecto a 3001 o 10000 (puertos menos comunes)
      console.log('🔍 Encontrada definición de puerto. Modificando...');
      const newContent = content.replace(portPattern, '$1"10000"');
      
      // Guardar el archivo modificado
      fs.writeFileSync(indexPath, newContent, 'utf8');
      console.log('✅ Archivo index.js modificado exitosamente. Puerto cambiado a 10000');
      return true;
    } else {
      console.log('⚠️ No se encontró la definición del puerto en index.js');
      return false;
    }
  } catch (error) {
    console.error(`❌ Error al modificar index.js: ${error.message}`);
    return false;
  }
}

// Función para modificar el puerto en server.js
function fixServerJsPort() {
  const serverPath = path.join(__dirname, 'server.js');
  
  try {
    console.log(`📂 Leyendo archivo: ${serverPath}`);
    let content = fs.readFileSync(serverPath, 'utf8');
    
    // Buscar la línea que define el puerto
    const portPattern = /(const\s+PORT\s*=\s*process\.env\.PORT\s*\|\|\s*)(\d+)/;
    
    if (portPattern.test(content)) {
      // Cambiar el puerto por defecto a 7778 (en lugar de 7777)
      console.log('🔍 Encontrada definición de puerto. Modificando...');
      const newContent = content.replace(portPattern, '$110000');
      
      // Guardar el archivo modificado
      fs.writeFileSync(serverPath, newContent, 'utf8');
      console.log('✅ Archivo server.js modificado exitosamente. Puerto cambiado a 10000');
      return true;
    } else {
      console.log('⚠️ No se encontró la definición del puerto en server.js');
      return false;
    }
  } catch (error) {
    console.error(`❌ Error al modificar server.js: ${error.message}`);
    return false;
  }
}

// Crear o modificar archivo render-start.js específico para Render
function createRenderStartScript() {
  const renderStartPath = path.join(__dirname, 'render-start.js');
  
  try {
    const scriptContent = `/**
 * Script de inicio específico para Render
 * Resuelve conflictos de puerto y configura entorno
 */

console.log('🚀 Iniciando script para entorno Render...');

// Establecer puerto explícitamente para evitar conflictos
process.env.PORT = process.env.PORT || '10000';
console.log(\`✅ Puerto configurado: \${process.env.PORT}\`);

// Detectar y establecer variables de entorno
process.env.NODE_ENV = 'production';
process.env.RENDER = 'true';

// Comprobar que tenemos las variables críticas
console.log('🔍 Verificando variables de entorno críticas:');
console.log(\`- SUPABASE_URL: \${process.env.SUPABASE_URL ? '✅' : '❌'}\`);
console.log(\`- OPENAI_API_KEY: \${process.env.OPENAI_API_KEY ? '✅' : '❌'}\`);
console.log(\`- GUPSHUP_API_KEY: \${process.env.GUPSHUP_API_KEY ? '✅' : '❌'}\`);

// Iniciar la aplicación
console.log('🚀 Iniciando aplicación con nuevo puerto...');
require('./index.js');
`;
    
    fs.writeFileSync(renderStartPath, scriptContent, 'utf8');
    console.log('✅ Archivo render-start.js creado/actualizado exitosamente');
    return true;
  } catch (error) {
    console.error(`❌ Error al crear render-start.js: ${error.message}`);
    return false;
  }
}

// Actualizar package.json para usar el nuevo script de inicio
function updatePackageJson() {
  const packagePath = path.join(__dirname, 'package.json');
  
  try {
    console.log(`📂 Leyendo archivo: ${packagePath}`);
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // Actualizar script de inicio
    if (packageJson.scripts) {
      const originalStart = packageJson.scripts.start;
      packageJson.scripts.start = 'node render-start.js';
      packageJson.scripts['start:original'] = originalStart || 'node index.js';
      
      fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2), 'utf8');
      console.log('✅ package.json actualizado exitosamente');
      return true;
    } else {
      console.error('❌ No se encontró la sección "scripts" en package.json');
      return false;
    }
  } catch (error) {
    console.error(`❌ Error al actualizar package.json: ${error.message}`);
    return false;
  }
}

// Ejecutar todas las funciones
console.log('🔄 Ejecutando modificaciones...');
const results = {
  indexJs: fixIndexJsPort(),
  serverJs: fixServerJsPort(),
  renderStart: createRenderStartScript(),
  packageJson: updatePackageJson()
};

console.log('\n📋 Resumen de cambios:');
console.log(`- index.js: ${results.indexJs ? '✅ Modificado' : '❌ Sin cambios'}`);
console.log(`- server.js: ${results.serverJs ? '✅ Modificado' : '❌ Sin cambios'}`);
console.log(`- render-start.js: ${results.renderStart ? '✅ Creado/Actualizado' : '❌ Error'}`);
console.log(`- package.json: ${results.packageJson ? '✅ Actualizado' : '❌ Sin cambios'}`);

if (results.indexJs && results.renderStart && results.packageJson) {
  console.log('\n✅ ¡Solución completada! Ahora la aplicación usará el puerto 10000 en Render');
  console.log('🚀 Para probar localmente, ejecuta: npm run start');
} else {
  console.log('\n⚠️ Se completaron algunas modificaciones, pero no todas');
  console.log('🔍 Revisa los mensajes anteriores y realiza los cambios manualmente si es necesario');
} 