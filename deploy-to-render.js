#!/usr/bin/env node
/**
 * Script para preparar el despliegue del WhatsApp Bot en Render
 * 
 * Este script realiza las siguientes tareas:
 * 1. Verifica la existencia de todos los archivos necesarios
 * 2. Instala el sistema de notificaciones
 * 3. Verifica y ajusta la configuración para el entorno de Render
 * 4. Genera un archivo de instrucciones para el despliegue
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuración
const REQUIRED_FILES = [
  'index.js',
  'notification-patch.js',
  'package.json',
  '.env'
];

// Función para verificar si un archivo existe
function checkFileExists(filePath) {
  const absolutePath = path.resolve(__dirname, filePath);
  return fs.existsSync(absolutePath);
}

// Función para ejecutar comandos y capturar la salida
function runCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8' });
  } catch (error) {
    console.error(`Error ejecutando: ${command}`);
    console.error(error.message);
    return null;
  }
}

// Función principal
async function prepareForRender() {
  console.log('🚀 Preparando despliegue para Render...');
  
  // 1. Verificar archivos necesarios
  console.log('\n📋 Verificando archivos necesarios:');
  let allFilesExist = true;
  
  for (const file of REQUIRED_FILES) {
    const exists = checkFileExists(file);
    console.log(`  ${exists ? '✅' : '❌'} ${file}`);
    
    if (!exists) {
      allFilesExist = false;
    }
  }
  
  if (!allFilesExist) {
    console.error('\n❌ Faltan archivos necesarios para el despliegue.');
    process.exit(1);
  }
  
  // 2. Instalar sistema de notificaciones
  console.log('\n🔔 Instalando sistema de notificaciones:');
  
  // Verificar si ya está instalado
  const indexContent = fs.readFileSync(path.resolve(__dirname, 'index.js'), 'utf8');
  const notificationInstalled = indexContent.includes("require('./notification-patch')");
  
  if (notificationInstalled) {
    console.log('  ✅ Sistema de notificaciones ya está instalado.');
  } else {
    console.log('  🔄 Instalando sistema de notificaciones...');
    
    // Ejecutar script de instalación manual si existe
    if (checkFileExists('manual-install-notification.js')) {
      const output = runCommand('node manual-install-notification.js');
      if (output) {
        console.log('  ✅ Sistema de notificaciones instalado correctamente.');
      } else {
        console.error('  ❌ Error al instalar sistema de notificaciones.');
        process.exit(1);
      }
    } else {
      console.error('  ❌ No se encontró script de instalación manual.');
      process.exit(1);
    }
  }
  
  // 3. Verificar y ajustar configuración para Render
  console.log('\n⚙️ Verificando configuración para Render:');
  
  // Verificar variables de entorno
  const envContent = fs.readFileSync(path.resolve(__dirname, '.env'), 'utf8');
  const envLines = envContent.split('\n');
  
  const requiredEnvVars = [
    'NOTIFICATION_EMAIL',
    'EMAIL_USER',
    'EMAIL_PASSWORD',
    'GUPSHUP_API_KEY',
    'GUPSHUP_NUMBER',
    'GUPSHUP_USERID',
    'OPENAI_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_KEY'
  ];
  
  const missingVars = [];
  for (const varName of requiredEnvVars) {
    if (!envContent.includes(`${varName}=`)) {
      missingVars.push(varName);
    }
  }
  
  if (missingVars.length > 0) {
    console.log(`  ⚠️ Variables de entorno faltantes: ${missingVars.join(', ')}`);
    console.log('  ⚠️ Asegúrate de configurar estas variables en el panel de Render.');
  } else {
    console.log('  ✅ Todas las variables de entorno necesarias están configuradas.');
  }
  
  // 4. Generar instrucciones para el despliegue
  console.log('\n📝 Generando instrucciones para el despliegue:');
  
  const deployInstructions = `
# Instrucciones para desplegar el WhatsApp Bot en Render

## Configuración del Servicio Web

1. Crea un nuevo Web Service en Render
2. Conecta tu repositorio Git
3. Configura los siguientes parámetros:
   - Name: whatsapp-bot
   - Environment: Node
   - Build Command: npm install
   - Start Command: node index.js
   - Plan: Free (o el plan que prefieras)

## Variables de Entorno

Configura las siguientes variables de entorno en el panel de Render:

${requiredEnvVars.map(v => `- ${v}`).join('\n')}

## Notas Importantes

- El sistema de notificaciones está instalado y configurado correctamente
- Asegúrate de que las credenciales de GupShup y OpenAI sean válidas
- Para recibir notificaciones, configura correctamente EMAIL_USER, EMAIL_PASSWORD y NOTIFICATION_EMAIL

## Después del Despliegue

1. Verifica que el servidor esté en línea visitando la URL proporcionada por Render
2. Prueba el endpoint /status para confirmar que todo funciona correctamente
3. Prueba el endpoint /test-notification para verificar las notificaciones

Preparado: ${new Date().toISOString()}
`;

  // Guardar instrucciones en archivo
  fs.writeFileSync(path.resolve(__dirname, 'INSTRUCCIONES_RENDER.md'), deployInstructions, 'utf8');
  console.log('  ✅ Instrucciones generadas: INSTRUCCIONES_RENDER.md');
  
  console.log('\n✅ ¡Preparación para Render completada!');
  console.log('📦 Ahora puedes subir estos archivos a tu repositorio Git y conectarlo a Render.');
  console.log('📖 Sigue las instrucciones en INSTRUCCIONES_RENDER.md para completar el despliegue.');
}

// Ejecutar la función principal
prepareForRender().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
}); 