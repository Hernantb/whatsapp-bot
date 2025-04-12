#!/usr/bin/env node
/**
 * Script de instalación del sistema de notificaciones para WhatsApp Bot
 * 
 * Este script modifica el archivo index.js del bot para integrar un sistema
 * de notificaciones que detecta cuando un mensaje del bot requiere atención humana
 * y envía una notificación por correo electrónico al equipo correspondiente.
 * 
 * Uso:
 *   node install-notification.js
 * 
 * El script realizará una copia de seguridad de los archivos originales antes
 * de hacer cualquier modificación.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuración
const CONFIG = {
  // Ruta al archivo principal del bot
  indexPath: path.resolve(__dirname, 'index.js'),
  
  // Ruta al archivo de parche de notificaciones
  notificationPatchPath: path.resolve(__dirname, 'notification-patch.js'),
  
  // Directorio para copias de seguridad
  backupDir: path.resolve(__dirname, 'backups'),
  
  // Archivo de registro
  logFile: path.resolve(__dirname, 'notification-install.log')
};

// Función para crear una copia de seguridad del archivo original
function backupOriginalFile(filePath) {
  try {
    // Crear directorio de respaldo si no existe
    if (!fs.existsSync(CONFIG.backupDir)) {
      fs.mkdirSync(CONFIG.backupDir, { recursive: true });
    }
    
    // Generar nombre de archivo con marca de tiempo
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = path.basename(filePath);
    const backupPath = path.join(CONFIG.backupDir, `${fileName}.${timestamp}.bak`);
    
    // Copiar archivo
    fs.copyFileSync(filePath, backupPath);
    
    log(`✅ Copia de seguridad creada: ${backupPath}`);
    return backupPath;
  } catch (error) {
    log(`❌ Error al crear copia de seguridad: ${error.message}`);
    throw new Error(`No se pudo crear copia de seguridad: ${error.message}`);
  }
}

// Función para registrar mensajes en el archivo de log
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  console.log(message);
  
  try {
    fs.appendFileSync(CONFIG.logFile, logMessage);
  } catch (error) {
    console.error(`Error al escribir en el archivo de log: ${error.message}`);
  }
}

// Función para verificar si las modificaciones ya han sido aplicadas
function checkIfModificationsApplied(fileContent) {
  // Verificar si el archivo ya importa el módulo de notificaciones
  const hasNotificationImport = fileContent.includes('require(\'./notification-patch\')') || 
                               fileContent.includes('require("./notification-patch")');
  
  // Verificar si la función sendWhatsAppResponseWithNotification ya existe
  const hasNotificationFunction = fileContent.includes('sendWhatsAppResponseWithNotification');
  
  return {
    hasNotificationImport,
    hasNotificationFunction,
    isFullyApplied: hasNotificationImport && hasNotificationFunction
  };
}

// Modificaciones a aplicar al archivo index.js
const MODIFICATIONS = [
  {
    name: 'Importar módulo de notificaciones',
    check: (content) => content.includes('require(\'./notification-patch\')') || 
                       content.includes('require("./notification-patch")'),
    apply: (content) => {
      // Buscar una línea después de los últimos requires
      const requirePattern = /const\s+.*\s*=\s*require\(['"'].*['"']\);?/g;
      let lastRequireIndex = -1;
      let match;
      
      while ((match = requirePattern.exec(content)) !== null) {
        lastRequireIndex = match.index + match[0].length;
      }
      
      if (lastRequireIndex === -1) {
        // Si no se encuentra ningún require, buscar después del bloque de comentarios iniciales
        const commentEndIndex = content.indexOf('*/');
        lastRequireIndex = commentEndIndex !== -1 ? commentEndIndex + 2 : 0;
      }
      
      // Insertar la importación después del último require o al inicio
      const importLine = '\n// Sistema de notificaciones\nconst { ' +
        'processMessageForNotification, ' +
        'sendWhatsAppResponseWithNotification, ' +
        'checkForNotificationPhrases ' +
        '} = require(\'./notification-patch\');\n';
      
      return content.slice(0, lastRequireIndex) + importLine + content.slice(lastRequireIndex);
    }
  },
  {
    name: 'Modificar función sendTextMessageGupShup',
    check: (content) => content.includes('processMessageForNotification(') || 
                       content.includes('checkForNotificationPhrases('),
    apply: (content) => {
      // Buscar la función sendTextMessageGupShup
      const functionPattern = /async\s+function\s+sendTextMessageGupShup\s*\([^)]*\)\s*\{/;
      const match = functionPattern.exec(content);
      
      if (!match) {
        log('⚠️ No se encontró la función sendTextMessageGupShup, saltando modificación');
        return content;
      }
      
      // Buscar el final de la función
      const startIndex = match.index;
      let bracketCount = 0;
      let endIndex = startIndex;
      
      for (let i = startIndex; i < content.length; i++) {
        if (content[i] === '{') bracketCount++;
        else if (content[i] === '}') {
          bracketCount--;
          if (bracketCount === 0) {
            endIndex = i + 1;
            break;
          }
        }
      }
      
      if (bracketCount !== 0) {
        log('⚠️ No se pudo determinar el final de la función sendTextMessageGupShup');
        return content;
      }
      
      // Extraer la función original
      const originalFunction = content.substring(startIndex, endIndex);
      
      // Modificar para incluir verificación de notificación
      const modifiedFunction = originalFunction.replace(
        /return\s+([^;]+);/,
        `// Verificar si es un mensaje del bot que requiere notificación
    if (sender_type === 'bot' || sender_type === 'agent') {
      try {
        // Solo crear el objeto message si es un mensaje del bot
        const botMessage = {
          content: text,
          sender_type: 'bot',
          conversation_id: global.phoneToConversationMap ? global.phoneToConversationMap[phoneNumber] : null
        };
        
        // Procesar para notificación de forma asíncrona (no esperamos)
        processMessageForNotification(botMessage).catch(err => {
          console.error('❌ Error procesando notificación:', err.message);
        });
      } catch (notifyError) {
        console.error('❌ Error en verificación de notificación:', notifyError.message);
      }
    }
    
    return $1;`
      );
      
      // Reemplazar la función original con la modificada
      return content.substring(0, startIndex) + modifiedFunction + content.substring(endIndex);
    }
  },
  {
    name: 'Agregar función sendWhatsAppWithNotification',
    check: (content) => content.includes('sendWhatsAppResponseWithNotification'),
    apply: (content) => {
      // Buscar la función sendTextMessageGupShup para agregar después
      const functionPattern = /async\s+function\s+sendTextMessageGupShup\s*\([^)]*\)\s*\{/;
      const match = functionPattern.exec(content);
      
      if (!match) {
        log('⚠️ No se encontró la función sendTextMessageGupShup, utilizando final del archivo');
        // Agregar al final del archivo
        return content + `
/**
 * Envía un mensaje de WhatsApp con verificación automática de notificación
 * Esta función es un wrapper que utiliza sendTextMessageGupShup internamente
 * @param {string} phoneNumber - Número de teléfono del destinatario
 * @param {string} message - Contenido del mensaje a enviar
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} Resultado del envío
 */
async function sendWhatsAppWithNotification(phoneNumber, message, options = {}) {
  try {
    return await sendWhatsAppResponseWithNotification(phoneNumber, message, {
      conversationId: options.conversationId || 
                     (global.phoneToConversationMap ? global.phoneToConversationMap[phoneNumber] : null),
      sendFunction: sendTextMessageGupShup
    });
  } catch (error) {
    console.error('❌ Error en sendWhatsAppWithNotification:', error.message);
    throw error;
  }
}
`;
      }
      
      // Buscar el final de la función sendTextMessageGupShup
      const startIndex = match.index;
      let bracketCount = 0;
      let endIndex = startIndex;
      
      for (let i = startIndex; i < content.length; i++) {
        if (content[i] === '{') bracketCount++;
        else if (content[i] === '}') {
          bracketCount--;
          if (bracketCount === 0) {
            endIndex = i + 1;
            break;
          }
        }
      }
      
      // Agregar la nueva función después de sendTextMessageGupShup
      const newFunction = `

/**
 * Envía un mensaje de WhatsApp con verificación automática de notificación
 * Esta función es un wrapper que utiliza sendTextMessageGupShup internamente
 * @param {string} phoneNumber - Número de teléfono del destinatario
 * @param {string} message - Contenido del mensaje a enviar
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} Resultado del envío
 */
async function sendWhatsAppWithNotification(phoneNumber, message, options = {}) {
  try {
    return await sendWhatsAppResponseWithNotification(phoneNumber, message, {
      conversationId: options.conversationId || 
                     (global.phoneToConversationMap ? global.phoneToConversationMap[phoneNumber] : null),
      sendFunction: sendTextMessageGupShup
    });
  } catch (error) {
    console.error('❌ Error en sendWhatsAppWithNotification:', error.message);
    throw error;
  }
}`;
      
      return content.substring(0, endIndex) + newFunction + content.substring(endIndex);
    }
  },
  {
    name: 'Agregar mapeo de conversaciones',
    check: (content) => content.includes('global.conversationIdToPhoneMap') && 
                       content.includes('global.phoneToConversationMap'),
    apply: (content) => {
      // Buscar un lugar adecuado para agregar los mapas globales (cerca del inicio del archivo)
      const serverPattern = /const\s+app\s*=\s*express\(\);/;
      const serverMatch = serverPattern.exec(content);
      
      if (!serverMatch) {
        log('⚠️ No se encontró la inicialización del servidor, utilizando ubicación alternativa');
        
        // Buscamos otra ubicación alternativa
        const altPattern = /dotenv\.config\(\);/;
        const altMatch = altPattern.exec(content);
        
        if (!altMatch) {
          log('⚠️ No se encontró una ubicación adecuada, agregando al inicio del archivo');
          // Agregar al inicio del archivo después de los comentarios
          return content.replace(/^(\/\*[\s\S]*?\*\/\s*)/, 
            '$1\n// Mapeo de conversaciones para el sistema de notificaciones\nglobal.conversationIdToPhoneMap = {};\nglobal.phoneToConversationMap = {};\n\n');
        }
        
        const insertPos = altMatch.index + altMatch[0].length;
        return content.slice(0, insertPos) + 
               '\n\n// Mapeo de conversaciones para el sistema de notificaciones\nglobal.conversationIdToPhoneMap = {};\nglobal.phoneToConversationMap = {};\n' + 
               content.slice(insertPos);
      }
      
      const insertPos = serverMatch.index;
      return content.slice(0, insertPos) + 
             '// Mapeo de conversaciones para el sistema de notificaciones\nglobal.conversationIdToPhoneMap = {};\nglobal.phoneToConversationMap = {};\n\n' + 
             content.slice(insertPos);
    }
  }
];

// Función principal para aplicar el parche
async function applyNotificationPatch() {
  log('🚀 Iniciando instalación del sistema de notificaciones');
  
  try {
    // Verificar que existan los archivos necesarios
    if (!fs.existsSync(CONFIG.indexPath)) {
      log(`❌ Error: No se encontró el archivo index.js en ${CONFIG.indexPath}`);
      return false;
    }
    
    if (!fs.existsSync(CONFIG.notificationPatchPath)) {
      log(`❌ Error: No se encontró el archivo notification-patch.js en ${CONFIG.notificationPatchPath}`);
      return false;
    }
    
    // Leer el contenido del archivo index.js
    let indexContent = fs.readFileSync(CONFIG.indexPath, 'utf8');
    
    // Verificar si las modificaciones ya han sido aplicadas
    const modificationStatus = checkIfModificationsApplied(indexContent);
    
    if (modificationStatus.isFullyApplied) {
      log('✅ El sistema de notificaciones ya está instalado');
      return true;
    }
    
    // Crear copia de seguridad antes de modificar
    const backupPath = backupOriginalFile(CONFIG.indexPath);
    log(`📦 Copia de seguridad creada en: ${backupPath}`);
    
    // Aplicar cada modificación
    for (const modification of MODIFICATIONS) {
      if (!modification.check(indexContent)) {
        log(`🔄 Aplicando: ${modification.name}`);
        try {
          indexContent = modification.apply(indexContent);
          log(`✅ ${modification.name}: Completado`);
        } catch (modError) {
          log(`❌ Error al aplicar ${modification.name}: ${modError.message}`);
        }
      } else {
        log(`✓ ${modification.name}: Ya aplicado, saltando`);
      }
    }
    
    // Guardar el archivo modificado
    fs.writeFileSync(CONFIG.indexPath, indexContent, 'utf8');
    log(`💾 Cambios guardados en ${CONFIG.indexPath}`);
    
    // Verificar la sintaxis del archivo modificado
    try {
      require('vm').runInNewContext(indexContent, {
        require: () => ({}),
        console: console,
        process: { env: process.env },
        global: {}
      });
      log('✅ Verificación de sintaxis exitosa');
    } catch (syntaxError) {
      log(`⚠️ Advertencia: El archivo modificado puede tener errores de sintaxis: ${syntaxError.message}`);
      log('⚠️ Se restaurará la copia de seguridad para evitar problemas');
      
      // Restaurar la copia de seguridad
      fs.copyFileSync(backupPath, CONFIG.indexPath);
      log('✅ Copia de seguridad restaurada');
      
      return false;
    }
    
    log('🎉 Instalación del sistema de notificaciones completada con éxito');
    log('📝 El sistema verificará automáticamente si los mensajes del bot requieren atención humana');
    log('📧 Se enviarán notificaciones por correo electrónico cuando sea necesario');
    
    return true;
  } catch (error) {
    log(`❌ Error durante la instalación: ${error.message}`);
    log(`📋 Stack: ${error.stack}`);
    return false;
  }
}

// Ejecutar la función principal
applyNotificationPatch()
  .then(success => {
    if (success) {
      log('✅ Proceso de instalación finalizado correctamente');
      process.exit(0);
    } else {
      log('❌ Proceso de instalación finalizado con errores');
      process.exit(1);
    }
  })
  .catch(error => {
    log(`❌ Error fatal durante la instalación: ${error.message}`);
    log(`📋 Stack: ${error.stack}`);
    process.exit(1);
  }); 