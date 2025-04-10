#!/usr/bin/env node
/**
 * Script completo para aplicar todas las correcciones necesarias para desplegar en Render
 * 
 * Este script ejecuta la secuencia completa de correcciones:
 * 1. Elimina duplicados de funciones
 * 2. Aplica el parche de notificaciones
 * 3. Corrige errores de linter
 * 4. Verifica la configuración de variables de entorno
 * 5. Genera instrucciones para el despliegue
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Iniciando proceso completo de corrección y preparación para despliegue en Render');

// Función para ejecutar comandos y registrar su salida
function runCommand(command, description) {
  console.log(`\n==== ${description} ====`);
  try {
    const output = execSync(command, { encoding: 'utf8' });
    console.log(output);
    return true;
  } catch (error) {
    console.error(`❌ Error ejecutando ${command}:`);
    console.error(error.message);
    return false;
  }
}

// Función para verificar si un archivo existe
function checkFileExists(filePath) {
  return fs.existsSync(path.resolve(__dirname, filePath));
}

// Verificar que todos los scripts necesarios existen
console.log('\n📋 Verificando scripts necesarios...');
const requiredScripts = [
  'fix-double-declarations.js',
  'manual-install-notification.js',
  'fix-linter-errors.js',
  'notification-patch.js'
];

const missingScripts = requiredScripts.filter(script => !checkFileExists(script));
if (missingScripts.length > 0) {
  console.error(`❌ Faltan los siguientes scripts necesarios: ${missingScripts.join(', ')}`);
  process.exit(1);
}

console.log('✅ Todos los scripts necesarios están disponibles');

// 1. Eliminar duplicados de funciones
const fixDuplicatesSuccess = runCommand('node fix-double-declarations.js', 'Eliminando funciones duplicadas');
if (!fixDuplicatesSuccess) {
  console.error('❌ Fallo al eliminar funciones duplicadas. Abortando proceso.');
  process.exit(1);
}

// 2. Aplicar el parche de notificaciones
const installNotificationsSuccess = runCommand('node manual-install-notification.js', 'Instalando sistema de notificaciones');
if (!installNotificationsSuccess) {
  console.error('❌ Fallo al instalar sistema de notificaciones. Abortando proceso.');
  process.exit(1);
}

// 3. Corregir errores de linter
const fixLinterSuccess = runCommand('node fix-linter-errors.js', 'Corrigiendo errores de linter');
if (!fixLinterSuccess) {
  console.error('❌ Fallo al corregir errores de linter. Abortando proceso.');
  process.exit(1);
}

// 4. Verificar variables de entorno
console.log('\n📝 Verificando variables de entorno para notificaciones...');

// Leer archivo .env
let envPath = path.resolve(__dirname, '.env');
let envContent = '';

try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (error) {
  console.error(`❌ Error al leer archivo .env: ${error.message}`);
  process.exit(1);
}

// Verificar variables necesarias para notificaciones
const requiredEnvVars = [
  'NOTIFICATION_EMAIL',
  'EMAIL_USER',
  'EMAIL_PASSWORD',
  'EMAIL_HOST',
  'EMAIL_PORT'
];

const missingVars = [];
for (const varName of requiredEnvVars) {
  if (!envContent.includes(`${varName}=`)) {
    missingVars.push(varName);
  }
}

if (missingVars.length > 0) {
  console.warn(`⚠️ Faltan las siguientes variables de entorno para notificaciones: ${missingVars.join(', ')}`);
  console.log('⚠️ Agregando variables faltantes con valores predeterminados...');
  
  let envAdditions = '\n# Variables agregadas automáticamente para notificaciones\n';
  for (const varName of missingVars) {
    switch(varName) {
      case 'NOTIFICATION_EMAIL':
        envAdditions += 'NOTIFICATION_EMAIL=joaquinisaza@hotmail.com\n';
        break;
      case 'EMAIL_USER':
        envAdditions += 'EMAIL_USER=bexorai@gmail.com\n';
        break;
      case 'EMAIL_PASSWORD':
        envAdditions += 'EMAIL_PASSWORD=gqwiakerjgrnkylf\n';
        break;
      case 'EMAIL_HOST':
        envAdditions += 'EMAIL_HOST=smtp.gmail.com\n';
        break;
      case 'EMAIL_PORT':
        envAdditions += 'EMAIL_PORT=587\n';
        break;
      case 'EMAIL_SECURE':
        envAdditions += 'EMAIL_SECURE=false\n';
        break;
      case 'NOTIFICATION_BCC':
        envAdditions += 'NOTIFICATION_BCC=copia@brexor.com\n';
        break;
    }
  }
  
  // Agregar variables faltantes al archivo .env
  fs.appendFileSync(envPath, envAdditions);
  console.log('✅ Variables de entorno agregadas correctamente');
} else {
  console.log('✅ Todas las variables de entorno necesarias están configuradas');
}

// 5. Generar instrucciones para el despliegue
console.log('\n📝 Generando instrucciones para el despliegue en Render...');

const deployInstructions = `
# Instrucciones para desplegar el WhatsApp Bot en Render

## Resumen de cambios aplicados

Se han realizado las siguientes correcciones en el código:

1. ✅ Eliminación de funciones duplicadas
2. ✅ Instalación del sistema de notificaciones
3. ✅ Corrección de errores de linter
4. ✅ Configuración de variables de entorno para notificaciones

## Configuración del Servicio Web en Render

1. Crea un nuevo Web Service en Render
2. Conecta tu repositorio Git
3. Configura los siguientes parámetros:
   - Name: whatsapp-bot
   - Environment: Node
   - Build Command: npm install
   - Start Command: node index.js
   - Plan: Free (o el plan que prefieras)

## Variables de Entorno a Configurar

Asegúrate de configurar las siguientes variables de entorno en el panel de Render:

${requiredEnvVars.map(v => `- ${v}`).join('\n')}
- GUPSHUP_API_KEY
- GUPSHUP_NUMBER
- GUPSHUP_USERID
- OPENAI_API_KEY
- SUPABASE_URL
- SUPABASE_KEY

## Notas Importantes

- El sistema de notificaciones está completamente instalado y configurado
- Se enviarán notificaciones por correo cuando el bot detecte mensajes que requieran atención humana
- Asegúrate de que las credenciales de GupShup y OpenAI sean válidas
- Para recibir notificaciones, asegúrate de que los valores de EMAIL_USER, EMAIL_PASSWORD y NOTIFICATION_EMAIL sean correctos

## Después del Despliegue

1. Verifica que el servidor esté en línea visitando la URL proporcionada por Render
2. Prueba el endpoint /status para confirmar que todo funciona correctamente
3. Prueba el endpoint /test-notification para verificar que las notificaciones funcionan correctamente

Preparado: ${new Date().toISOString()}
`;

// Guardar instrucciones en archivo
const instructionsPath = path.resolve(__dirname, 'INSTRUCCIONES_RENDER.md');
fs.writeFileSync(instructionsPath, deployInstructions, 'utf8');
console.log(`✅ Instrucciones generadas: ${instructionsPath}`);

console.log('\n✅ Proceso completo de corrección y preparación finalizado con éxito');
console.log('📦 El código está listo para ser desplegado en Render');
console.log('📖 Sigue las instrucciones en INSTRUCCIONES_RENDER.md para completar el despliegue'); 