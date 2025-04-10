// Servidor de prueba simplificado para probar notificaciones
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

// Inicializar Supabase si las variables de entorno están disponibles
let supabase = null;
if (process.env.SUPABASE_URL && (process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY)) {
  console.log('✅ Inicializando cliente Supabase...');
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
  );
}

// Caché para deduplicación de mensajes
const recentMessages = new Map();
const MESSAGE_DEDUPE_TIMEOUT = 5000; // 5 segundos

// Importar funciones necesarias con manejo de errores individual
let sendTextMessageGupShup;
let checkForNotificationPhrases;
let sendEmailNotification;
let sendBusinessNotification;

try {
  const textMessageModule = require('./sendTextMessageGupShup');
  sendTextMessageGupShup = textMessageModule.sendTextMessageGupShup;
  console.log('✅ Función sendTextMessageGupShup cargada correctamente');
} catch (error) {
  console.log('⚠️ Error al cargar sendTextMessageGupShup:', error.message);
  // Función de fallback si no se puede cargar el módulo
  sendTextMessageGupShup = async (phoneNumber, message) => {
    console.log(`[SIMULACIÓN] Enviando mensaje a ${phoneNumber}: "${message}"`);
    return {
      success: true,
      messageId: `sim_${Date.now()}`,
      simulated: true
    };
  };
}

// Implementar directamente la función checkForNotificationPhrases si no se puede cargar
checkForNotificationPhrases = function(message) {
  console.log(`🔍 === VERIFICANDO FRASES PARA NOTIFICACIÓN ===`);
  console.log(`🔍 Mensaje a verificar: "${message}"`);
  
  // Asegurarse de que el mensaje es una cadena
  if (!message || typeof message !== 'string') {
    console.error(`❌ El mensaje no es válido: ${message}`);
    return false;
  }
  
  // Normalizar mensaje (quitar acentos, convertir a minúsculas)
  const normalizedMessage = message.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Lista de frases que requieren notificación
  const notificationPhrases = [
    "perfecto! un asesor te llamara", 
    "perfecto! un asesor te llamará",
    "¡perfecto! un asesor te llamará",
    "¡perfecto! un asesor te llamara",
    "perfecto un asesor te",
    "perfecto! tu cita ha sido confirmada",
    "¡perfecto! tu cita ha sido confirmada",
    "perfecto! tu cita ha sido registrada",
    "¡perfecto! tu cita ha sido registrada",
    "hemos registrado tu cita",
    "tu cita ha sido",
    "se ha creado la cita",
    "asesor te contactara",
    "asesor te contactará",
    "¡perfecto!",
    "cita confirmada",
    "cita registrada",
    "te contactará",
    "te contactara"
  ];
  
  // Lista de palabras clave para verificación adicional
  const keyWords = [
    "cita", 
    "asesor", 
    "llamará", 
    "llamara",
    "contactará", 
    "contactara",
    "confirmada", 
    "registrada", 
    "perfecto",
    "reservada",
    "agendada"
  ];
  
  // Verificar si el mensaje contiene alguna de las frases de notificación
  for (const phrase of notificationPhrases) {
    if (normalizedMessage.includes(phrase)) {
      console.log(`✅ COINCIDENCIA EXACTA detectada con frase: "${phrase}"`);
      return true;
    }
  }
  
  // Verificar coincidencia parcial (al menos 2 palabras clave)
  let keyWordCount = 0;
  const matchedKeywords = [];
  for (const word of keyWords) {
    if (normalizedMessage.includes(word)) {
      keyWordCount++;
      matchedKeywords.push(word);
      console.log(`🔑 Palabra clave "${word}" encontrada (${keyWordCount} de ${keyWords.length})`);
    }
  }
  
  if (keyWordCount >= 2) {
    console.log(`✅ COINCIDENCIA PARCIAL: ${keyWordCount} palabras clave encontradas: [${matchedKeywords.join(', ')}]`);
    return true;
  }
  
  // Verificar patrones específicos
  if (
    (normalizedMessage.includes("perfecto") && normalizedMessage.includes("asesor")) ||
    (normalizedMessage.includes("cita") && normalizedMessage.includes("confirmada")) ||
    (normalizedMessage.includes("cita") && normalizedMessage.includes("registrada")) ||
    (normalizedMessage.includes("perfecto") && normalizedMessage.includes("cita"))
  ) {
    console.log(`✅ PATRÓN ESPECÍFICO detectado: combinación de palabras clave`);
    return true;
  }
  
  console.log(`❌ No se detectaron frases que requieran notificación`);
  return false;
};

// Informar que estamos usando la función interna
console.log('✅ Función checkForNotificationPhrases implementada internamente');

// Intentar cargar las funciones desde los ayudantes
try {
  const helperModule = require('./helpers/notificationHelpers');
  if (helperModule && helperModule.checkForNotificationPhrases) {
    checkForNotificationPhrases = helperModule.checkForNotificationPhrases;
    console.log('✅ Función checkForNotificationPhrases reemplazada desde helpers');
  }
} catch (error) {
  console.log('⚠️ Usando implementación interna de checkForNotificationPhrases:', error.message);
}

try {
  const emailModule = require('./helpers/emailHelpers');
  sendEmailNotification = emailModule.sendEmailNotification;
  console.log('✅ Función sendEmailNotification cargada correctamente');
} catch (error) {
  console.log('⚠️ Error al cargar emailHelpers:', error.message);
  // Función de fallback
  sendEmailNotification = async (options) => {
    console.log(`[SIMULACIÓN] Enviando notificación por correo: ${JSON.stringify(options)}`);
    return { success: true, simulated: true };
  };
}

// Función de envío de notificaciones simplificada
sendBusinessNotification = async (conversationId, botMessage, clientPhoneNumber) => {
  try {
    console.log(`\n📧 ============= INICIANDO PROCESO DE NOTIFICACIÓN =============`);
    console.log(`📧 Conversación: ${conversationId}`);
    console.log(`📧 Teléfono cliente: ${clientPhoneNumber}`);
    console.log(`📧 Mensaje del bot: "${botMessage}"`);
    
    // Crear un transportador de correo electrónico
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'bexorai@gmail.com',
        pass: process.env.EMAIL_PASSWORD || 'gqwi aker jgrn kylf'
      }
    });
    
    // Configurar destinatarios
    const targetEmail = process.env.NOTIFICATION_EMAIL || 'joaquinisaza@hotmail.com';
    
    // HTML simplificado para el correo
    const emailHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0;">🔔 Notificación de Cliente</h2>
        </div>
        <div style="padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #3498db;">
            <h3 style="margin-top: 0; color: #34495e; margin-bottom: 10px;">Datos del Cliente</h3>
            <p style="margin: 0;"><strong>Teléfono:</strong> ${clientPhoneNumber}</p>
            <p style="margin: 0;"><strong>ID Conversación:</strong> ${conversationId}</p>
            <p style="margin: 0;"><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <div style="margin-bottom: 20px;">
            <h3 style="color: #34495e; margin-bottom: 10px;">Mensaje que Generó la Notificación</h3>
            <div style="background-color: #e6f7ff; padding: 15px; border-radius: 5px; border-left: 4px solid #2196f3;">
              ${botMessage}
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Configuración del correo
    const mailOptions = {
      from: `"Bot WhatsApp 🤖" <${process.env.EMAIL_USER || 'bexorai@gmail.com'}>`,
      to: targetEmail,
      subject: `🔔 Notificación de Cliente - ${clientPhoneNumber}`,
      html: emailHTML
    };
    
    console.log(`📧 Enviando correo a: ${targetEmail}`);
    
    // Enviar el correo
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ CORREO ENVIADO EXITOSAMENTE`);
    console.log(`✅ ID del mensaje: ${info.messageId}`);
    
    // Registrar en Supabase si está disponible
    if (supabase) {
      try {
        const { error } = await supabase
          .from('notification_attempts')
          .insert({
            conversation_id: conversationId,
            phone_number: clientPhoneNumber,
            message_content: botMessage.substring(0, 255),
            status: 'exitoso',
            message_id: info.messageId,
            details: 'Notificación enviada desde el servidor de prueba'
          });
          
        if (error) {
          console.error(`❌ Error al registrar en Supabase: ${error.message}`);
        } else {
          console.log(`✅ Notificación registrada en Supabase`);
        }
      } catch (dbError) {
        console.error(`❌ Error al acceder a la base de datos: ${dbError.message}`);
      }
    }
    
    console.log(`\n📧 ============= PROCESO DE NOTIFICACIÓN COMPLETADO =============`);
    return true;
  } catch (error) {
    console.error(`❌ ERROR GENERAL EN PROCESO DE NOTIFICACIÓN:`);
    console.error(`❌ Mensaje: ${error.message}`);
    console.error(`❌ Stack: ${error.stack}`);
    return false;
  }
};

console.log('✅ Función sendBusinessNotification implementada internamente');

const app = express();
const PORT = process.env.TEST_SERVER_PORT || 3095;

// Configuración de CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Endpoint para verificar el estado del servidor
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    message: 'Servidor de prueba WhatsApp está funcionando correctamente'
  });
});

// Endpoint para diagnóstico
app.get('/diagnostico', (req, res) => {
  const config = {
    version: '1.0.0',
    gupshup: {
      apiKey: process.env.GUPSHUP_API_KEY ? '✅ Configurado' : '❌ No configurado',
      sourceNumber: process.env.GUPSHUP_NUMBER || process.env.GUPSHUP_SOURCE_PHONE || '❌ No configurado',
      userId: process.env.GUPSHUP_USERID ? '✅ Configurado' : '❌ No configurado'
    },
    env: process.env.NODE_ENV || 'no especificado',
    simulation: process.env.USE_SIMULATION === 'true' ? 'activada' : 'desactivada',
    endpoints: {
      'GET /status': 'Verificar estado del servidor',
      'GET /diagnostico': 'Ver configuración actual',
      'POST /api/send-manual-message': 'Enviar mensaje manual',
      'GET /test-message': 'Probar envío de mensaje con parámetros'
    }
  };
  
  res.json(config);
});

// Endpoint para enviar mensajes manuales
app.post('/api/send-manual-message', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    // Validar parámetros
    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren los campos phoneNumber y message'
      });
    }
    
    console.log(`📝 Solicitud para enviar mensaje:
    - Número: ${phoneNumber}
    - Mensaje: ${message}`);
    
    // Crear un ID único para este mensaje
    const messageKey = `${phoneNumber}-${message}`;
    
    // Verificar si este mensaje fue enviado recientemente (deduplicación)
    if (recentMessages.has(messageKey)) {
      console.log(`⚠️ Duplicado detectado! Mensaje similar enviado hace menos de ${MESSAGE_DEDUPE_TIMEOUT/1000} segundos`);
      
      // Recuperar la respuesta anterior
      const cachedResponse = recentMessages.get(messageKey);
      
      console.log(`✅ Usando respuesta en caché para mensaje duplicado`);
      return res.status(200).json({ 
        success: true, 
        message: 'Mensaje previamente enviado a WhatsApp (deduplicado)',
        data: cachedResponse,
        deduplicado: true
      });
    }
    
    // NUEVO: Verificar si el mensaje requiere notificación
    console.log(`\n🔍 VERIFICANDO SI EL MENSAJE REQUIERE NOTIFICACIÓN...`);
    let requiresNotification = false;
    let notificationResult = null;
    
    try {
      if (typeof checkForNotificationPhrases === 'function') {
        requiresNotification = checkForNotificationPhrases(message);
        console.log(`🔍 Resultado: ${requiresNotification ? '✅ REQUIERE NOTIFICACIÓN' : '❌ NO REQUIERE NOTIFICACIÓN'}`);
      } else {
        // Verificación manual de frases comunes si la función no está disponible
        const lowercaseMsg = message.toLowerCase();
        requiresNotification = 
          lowercaseMsg.includes('cita') && (lowercaseMsg.includes('confirmada') || lowercaseMsg.includes('registrada')) ||
          lowercaseMsg.includes('asesor') && (lowercaseMsg.includes('contactará') || lowercaseMsg.includes('contactara') || lowercaseMsg.includes('llamará') || lowercaseMsg.includes('llamara')) ||
          lowercaseMsg.includes('perfecto') && (lowercaseMsg.includes('cita') || lowercaseMsg.includes('asesor'));
        
        console.log(`🔍 Verificación manual: ${requiresNotification ? '✅ REQUIERE NOTIFICACIÓN' : '❌ NO REQUIERE NOTIFICACIÓN'}`);
      }
    } catch (checkError) {
      console.error(`❌ Error al verificar notificación: ${checkError.message}`);
    }
    
    // Verificar si se debe deshabilitar la simulación
    const disableSimulation = process.env.DISABLE_WHATSAPP_SIMULATION === 'true';
    console.log(`⚙️ Configuración de simulación: ${disableSimulation ? 'DESACTIVADA' : 'ACTIVADA'}`);
    
    // Enviar mensaje a WhatsApp usando GupShup
    const result = await sendTextMessageGupShup(phoneNumber, message);
    
    // Verificar si fue simulado o real
    const wasSimulated = result.simulated === true;
    
    // Agregar advertencias claras en los logs si fue simulado
    if (wasSimulated) {
      console.warn('⚠️ ADVERTENCIA: El mensaje fue SIMULADO, NO SE ENVIÓ REALMENTE a WhatsApp');
      console.warn('⚠️ Para enviar mensajes reales, verifica la configuración de GupShup y credenciales');
    } else {
      console.log('✅ CONFIRMADO: Mensaje enviado REALMENTE a WhatsApp a través de GupShup');
    }
    
    // NUEVO: Si requiere notificación, buscar conversationId y enviar email
    if (requiresNotification) {
      console.log(`\n🚨 === INICIANDO PROCESO DE NOTIFICACIÓN ===`);
      
      // Buscar conversationId para este número
      let conversationId = null;
      try {
        // Este código asume que tienes acceso a Supabase
        if (supabase) {
          console.log(`🔍 Buscando conversación para ${phoneNumber}...`);
          const { data, error } = await supabase
            .from('conversations')
            .select('id')
            .eq('user_id', phoneNumber)
            .limit(1);
            
          if (error) {
            console.error(`❌ Error consultando Supabase: ${error.message}`);
          } else if (data && data.length > 0) {
            conversationId = data[0].id;
            console.log(`✅ Conversación encontrada: ${conversationId}`);
          } else {
            console.log(`ℹ️ No se encontró conversación para este número`);
          }
        }
      } catch (dbError) {
        console.error(`❌ Error buscando conversación: ${dbError.message}`);
      }
      
      // Enviar notificación
      try {
        if (conversationId) {
          console.log(`📧 Enviando notificación con conversationId: ${conversationId}`);
          
          // Intentar usar sendBusinessNotification si está disponible
          if (typeof sendBusinessNotification === 'function') {
            notificationResult = await sendBusinessNotification(conversationId, message, phoneNumber);
          } 
          // Si no está disponible, usar sendEmailNotification si existe
          else if (typeof sendEmailNotification === 'function') {
            notificationResult = await sendEmailNotification({
              to: process.env.NOTIFICATION_EMAIL || 'joaquinisaza@hotmail.com',
              subject: `🔔 Notificación de Cliente - ${phoneNumber}`,
              message: message,
              phoneNumber: phoneNumber,
              conversationId: conversationId
            });
          } 
          // Si ninguna de las dos está disponible, crear una función simple de envío
          else {
            // Intentar importar nodemailer
            try {
              const nodemailer = require('nodemailer');
              
              // Crear transporter
              const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                  user: process.env.EMAIL_USER || 'bexorai@gmail.com',
                  pass: process.env.EMAIL_PASSWORD || 'gqwi aker jgrn kylf'
                }
              });
              
              // HTML del correo simplificado
              const emailHTML = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 8px; overflow: hidden;">
                  <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">🔔 Notificación de Cliente</h2>
                  </div>
                  <div style="padding: 20px;">
                    <p><strong>Teléfono:</strong> ${phoneNumber}</p>
                    <p><strong>Conversación ID:</strong> ${conversationId}</p>
                    <p><strong>Mensaje:</strong> ${message}</p>
                    <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
                  </div>
                </div>
              `;
              
              // Enviar correo
              const info = await transporter.sendMail({
                from: `"Bot WhatsApp 🤖" <${process.env.EMAIL_USER || 'bexorai@gmail.com'}>`,
                to: process.env.NOTIFICATION_EMAIL || 'joaquinisaza@hotmail.com',
                subject: `🔔 Notificación de Cliente - ${phoneNumber}`,
                html: emailHTML
              });
              
              notificationResult = true;
              console.log(`✅ Correo enviado directamente: ${info.messageId}`);
            } catch (emailError) {
              console.error(`❌ Error enviando correo: ${emailError.message}`);
              notificationResult = false;
            }
          }
          
          console.log(`📧 Resultado de notificación: ${notificationResult ? 'EXITOSA ✅' : 'FALLIDA ❌'}`);
        } else {
          console.warn(`⚠️ No se pudo enviar notificación: No se encontró ID de conversación`);
        }
      } catch (notificationError) {
        console.error(`❌ Error en proceso de notificación: ${notificationError.message}`);
      }
    }
    
    // Registrar el mensaje como enviado para depuración
    const messageId = result.messageId || `msg-${Date.now()}`;
    const responseData = {
      messageId,
      phone: phoneNumber,
      message: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
      status: 'SENT',
      timestamp: new Date().toISOString(),
      provider: 'gupshup',
      details: result
    };
    
    // Agregar mensaje al mapa de mensajes recientes para evitar duplicados
    recentMessages.set(messageKey, responseData);
    
    // Configurar un temporizador para limpiar este mensaje de la caché después del tiempo de deduplicación
    setTimeout(() => {
      recentMessages.delete(messageKey);
      console.log(`🧹 Mensaje eliminado de la caché de deduplicación: ${messageKey}`);
    }, MESSAGE_DEDUPE_TIMEOUT);
    
    // Responder con el resultado mejorado
    res.json({
      success: result.success,
      messageId: result.messageId || null,
      timestamp: new Date().toISOString(),
      simulated: result.simulated || false,
      whatsappSimulated: wasSimulated, // Campo específico para indicar si el envío a WhatsApp fue simulado
      realDelivery: !wasSimulated, // Campo que indica si realmente se entregó
      status: result.success ? (wasSimulated ? 'simulado' : 'enviado') : 'fallido',
      notificationRequired: requiresNotification,
      notificationSent: notificationResult,
      error: result.error || null,
      details: result.response || null // Incluir detalles de la respuesta si están disponibles
    });
  } catch (error) {
    console.error('❌ Error al procesar solicitud:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para prueba simple con parámetros
app.get('/test-message', async (req, res) => {
  try {
    // Obtener parámetros de la URL
    const mensaje = req.query.mensaje || 'Mensaje de prueba desde servidor';
    const numero = req.query.numero || '5212221192568'; // Número predeterminado
    
    console.log(`📤 Enviando mensaje de prueba a ${numero}: "${mensaje}"`);
    
    // Verificar si el mensaje requiere notificación
    const requiresNotification = checkForNotificationPhrases(mensaje);
    console.log(`🔍 Verificación de notificación: ${requiresNotification ? 'REQUIERE ✅' : 'NO REQUIERE ❌'}`);
    
    // Enviar mensaje a WhatsApp usando GupShup
    const resultado = await sendTextMessageGupShup(numero, mensaje);
    
    // Responder con el resultado
    res.json({
      success: resultado.success,
      messageId: resultado.messageId || null,
      timestamp: new Date().toISOString(),
      message: mensaje,
      destinationNumber: numero,
      requiresNotification: requiresNotification,
      simulated: resultado.simulated || false,
      status: resultado.success ? 'enviado' : 'fallido',
      error: resultado.error || null
    });
  } catch (error) {
    console.error('❌ Error al procesar solicitud de prueba:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Ruta para prueba de notificaciones
app.get('/test-notification', async (req, res) => {
  console.log('🚨 === PRUEBA DE NOTIFICACIÓN ===');
  const phoneNumber = req.query.numero || '5212221192568';
  const mensaje = req.query.mensaje || '¡Perfecto! Tu cita ha sido confirmada para hoy a las 10:00 AM';
  const forzarNotificacion = req.query.forzar === 'true';
  
  console.log(`📱 Número: ${phoneNumber}`);
  console.log(`💬 Mensaje: "${mensaje}"`);
  console.log(`⚡ Forzar notificación: ${forzarNotificacion ? 'SÍ' : 'NO'}`);

  try {
    // 1. Verificar si el mensaje requiere notificación
    let requiresNotification = false;
    let notificationReason = '';
    
    if (forzarNotificacion) {
      requiresNotification = true;
      notificationReason = 'Forzado por parámetro';
      console.log('🔍 Forzando notificación por parámetro \'forzar=true\'');
    } else if (typeof global.checkForNotificationPhrases === 'function') {
      requiresNotification = global.checkForNotificationPhrases(mensaje);
      notificationReason = 'Frase detectada en el mensaje';
      console.log('🔍 Verificando con función global.checkForNotificationPhrases');
    } else if (typeof checkForNotificationPhrases === 'function') {
      requiresNotification = checkForNotificationPhrases(mensaje);
      notificationReason = 'Frase detectada en el mensaje';
      console.log('🔍 Verificando con función local checkForNotificationPhrases');
    } else {
      // Verificación simple de patrones comunes que requieren notificación
      const notificationPatterns = [
        /perfecto.*cita/i,
        /cita.*confirmada/i,
        /asesor.*llamar/i,
        /asesor.*contactar/i
      ];
      
      for (const pattern of notificationPatterns) {
        if (pattern.test(mensaje)) {
          requiresNotification = true;
          notificationReason = `Patrón coincidente: ${pattern}`;
          break;
        }
      }
      console.log('🔍 Verificando con patrones incorporados');
    }
    
    console.log(`🔍 Resultado: ${requiresNotification ? '✅ REQUIERE NOTIFICACIÓN' : '❌ NO REQUIERE NOTIFICACIÓN'}`);
    if (requiresNotification) {
      console.log(`📝 Razón: ${notificationReason}`);
    }
    
    // 2. Buscar o crear ID de conversación
    console.log(`🔍 Buscando conversación para el número ${phoneNumber}...`);
    
    // Verificar mapas globales primero
    let conversationId = null;
    if (global.phoneToConversationMap && global.phoneToConversationMap[phoneNumber]) {
      conversationId = global.phoneToConversationMap[phoneNumber];
      console.log(`✅ Conversación encontrada en caché: ${conversationId}`);
    } else {
      // Si no está en caché, buscar en Supabase
      try {
        if (global.supabase) {
          const { data, error } = await global.supabase
            .from('conversations')
            .select('id')
            .eq('user_id', phoneNumber)
            .limit(1);
            
          if (data && data.length > 0) {
            conversationId = data[0].id;
            console.log(`✅ Conversación encontrada: ${conversationId}`);
            
            // Actualizar mapa global si existe
            if (global.phoneToConversationMap) {
              global.phoneToConversationMap[phoneNumber] = conversationId;
            }
            if (global.conversationIdToPhoneMap) {
              global.conversationIdToPhoneMap[conversationId] = phoneNumber;
            }
          } else {
            // Usar un ID de prueba
            conversationId = '4a42aa05-2ffd-418b-aa52-29e7c571eee8';
            console.log(`⚠️ No se encontró conversación, usando ID de prueba: ${conversationId}`);
          }
        } else {
          // Usar un ID de prueba
          conversationId = '4a42aa05-2ffd-418b-aa52-29e7c571eee8';
          console.log(`⚠️ Supabase no inicializado, usando ID de prueba: ${conversationId}`);
        }
      } catch (error) {
        console.error('❌ Error al buscar conversación:', error);
        conversationId = '4a42aa05-2ffd-418b-aa52-29e7c571eee8'; // ID de prueba
        console.log(`⚠️ Error al buscar conversación, usando ID de prueba: ${conversationId}`);
      }
    }
    
    // 3. Enviar notificación si es necesario
    let notificationResult = null;
    
    if (requiresNotification && conversationId) {
      console.log(`📧 ENVIANDO NOTIFICACIÓN POR CORREO...`);
      
      if (global.sendBusinessNotification) {
        try {
          console.log(`📧 Enviando notificación con conversationId: ${conversationId}`);
          notificationResult = await global.sendBusinessNotification(conversationId, mensaje, phoneNumber);
          console.log(`📧 Resultado: ${notificationResult ? 'ENVIADO EXITOSAMENTE ✅' : 'FALLÓ EL ENVÍO ❌'}`);
        } catch (notifyError) {
          console.error('❌ Error en global.sendBusinessNotification:', notifyError);
          notificationResult = false;
        }
      } else if (typeof sendBusinessNotification === 'function') {
        try {
          console.log(`📧 Usando función local sendBusinessNotification`);
          notificationResult = await sendBusinessNotification(conversationId, mensaje, phoneNumber);
          console.log(`📧 Resultado: ${notificationResult ? 'ENVIADO EXITOSAMENTE ✅' : 'FALLÓ EL ENVÍO ❌'}`);
        } catch (notifyError) {
          console.error('❌ Error en sendBusinessNotification local:', notifyError);
          notificationResult = false;
        }
      } else {
        console.log('⚠️ No se encontró ninguna función sendBusinessNotification');
        notificationResult = false;
      }
    } else if (!requiresNotification) {
      console.log('ℹ️ No se requiere notificación para este mensaje');
    } else if (!conversationId) {
      console.log('⚠️ No se pudo obtener ID de conversación para enviar notificación');
    }
    
    // Preparar y enviar respuesta
    const timestamp = new Date().toISOString();
    const response = {
      timestamp,
      message: mensaje,
      phoneNumber,
      requiresNotification,
      conversationId: conversationId || null,
      notificationSent: !!notificationResult,
      success: true
    };
    
    if (notificationReason) {
      response.notificationReason = notificationReason;
    }
    
    res.json(response);
  } catch (error) {
    console.error('❌ Error en el endpoint de prueba de notificación:', error);
    res.status(500).json({
      error: 'Error procesando la prueba de notificación',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor de prueba WhatsApp iniciado en http://localhost:${PORT}`);
  console.log('📋 Endpoints disponibles:');
  console.log('  - GET /status');
  console.log('  - GET /diagnostico');
  console.log('  - POST /api/send-manual-message');
  console.log('  - GET /test-message');
  console.log('  - GET /test-notification');
}); 