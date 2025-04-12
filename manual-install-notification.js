#!/usr/bin/env node
/**
 * Script simplificado para instalar el sistema de notificaciones
 * 
 * Este script realiza la instalación manual del sistema de notificaciones
 * agregando solo la importación necesaria al inicio del archivo index.js
 * sin modificar el resto del código.
 */

const fs = require('fs');
const path = require('path');

const SOURCE_FILE = path.resolve(__dirname, 'index.js');
const BACKUP_FILE = path.resolve(__dirname, `index.js.backup-${Date.now()}`);

console.log('🔧 Iniciando instalación manual del sistema de notificaciones...');

// Hacer backup del archivo original
fs.copyFileSync(SOURCE_FILE, BACKUP_FILE);
console.log(`✅ Backup creado: ${BACKUP_FILE}`);

// Leer el contenido del archivo
let content = fs.readFileSync(SOURCE_FILE, 'utf8');

// Verificar si la importación ya existe
if (content.includes("require('./notification-patch')")) {
  console.log('✅ El sistema de notificaciones ya está importado en index.js');
  process.exit(0);
}

// Encontrar la posición apropiada para insertar la importación
// Buscamos después del último require
const requirePattern = /require\(['"][^'"]+['"]\)[;,]?/g;
let lastRequireIndex = 0;
let match;

while ((match = requirePattern.exec(content)) !== null) {
  lastRequireIndex = match.index + match[0].length;
}

// Insertar la importación después del último require
const importStatement = `

// Importar sistema de notificaciones - agregado para el deployment en Render
global.notificationModule = require('./notification-patch');
// Exponer funciones del módulo de notificaciones a variables globales
global.processMessageForNotification = global.notificationModule.processMessageForNotification;
global.sendWhatsAppResponseWithNotification = global.notificationModule.sendWhatsAppResponseWithNotification;
global.checkForNotificationPhrases = global.notificationModule.checkForNotificationPhrases;
global.sendBusinessNotification = global.notificationModule.sendBusinessNotification;

// Fin de importación del sistema de notificaciones
`;

// Insertar la importación en la posición adecuada
const modifiedContent = 
  content.substring(0, lastRequireIndex) + 
  importStatement + 
  content.substring(lastRequireIndex);

// Guardar el contenido modificado
try {
  fs.writeFileSync(SOURCE_FILE, modifiedContent, 'utf8');
  console.log('✅ Importación agregada correctamente al archivo index.js');
  console.log('✅ El sistema de notificaciones ahora está disponible en el servidor');
  console.log('\n🔔 IMPORTANTE: Para activar las notificaciones, asegúrate de configurar:');
  console.log('  - EMAIL_USER y EMAIL_PASSWORD en las variables de entorno');
  console.log('  - NOTIFICATION_EMAIL para el correo de destino de las notificaciones');
  console.log('  - NOTIFICATION_BCC para los correos en copia oculta (opcional)');
} catch (error) {
  console.error(`❌ Error al guardar el archivo: ${error.message}`);
  console.log('🔄 Restaurando backup...');
  fs.copyFileSync(BACKUP_FILE, SOURCE_FILE);
  console.log('✅ Backup restaurado. No se realizaron cambios.');
  process.exit(1);
}

console.log('\n✅ Instalación manual completada con éxito'); 