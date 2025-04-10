/**
 * Módulo de notificaciones para el servidor de WhatsApp
 * 
 * Este módulo implementa las funciones necesarias para detectar cuando un mensaje
 * del bot requiere atención humana y enviar notificaciones por correo electrónico.
 */

const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Cargar variables de entorno
dotenv.config();

// Configurar cliente Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuración de correo electrónico
const EMAIL_CONFIG = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  defaultFrom: process.env.EMAIL_FROM || 'Asistente IA <bot@example.com>',
  recipients: process.env.NOTIFICATION_EMAILS ? 
    process.env.NOTIFICATION_EMAILS.split(',').map(email => email.trim()) : 
    ['notificacion@example.com'],
  bcc: process.env.NOTIFICATION_BCC ? 
    process.env.NOTIFICATION_BCC.split(',').map(email => email.trim()) : 
    []
};

// Frases que indican necesidad de atención humana
const ATTENTION_PHRASES = [
  'necesito hablar con un humano',
  'necesito hablar con una persona',
  'necesito hablar con un agente',
  'quiero hablar con un humano',
  'quiero hablar con una persona',
  'quiero hablar con un agente',
  'puedo hablar con un humano',
  'puedo hablar con una persona',
  'puedo hablar con un agente',
  'me gustaría hablar con un humano',
  'me gustaría hablar con una persona',
  'me gustaría hablar con un agente',
  'comuníqueme con un humano',
  'comuníqueme con una persona',
  'comuníqueme con un agente',
  'necesito ayuda de un humano',
  'necesito ayuda de una persona',
  'necesito ayuda de un agente',
  'por favor, pásame con un humano',
  'por favor, pásame con una persona',
  'por favor, pásame con un agente',
  'contactar con un humano',
  'contactar con una persona',
  'contactar con un agente',
  'quiero ser atendido por un humano',
  'quiero ser atendido por una persona',
  'quiero ser atendido por un agente',
  'pasar a operador',
  'pasar a un operador',
  'pasar a un ejecutivo',
  'hablar con servicio al cliente',
  'atención al cliente',
  'servicio al cliente',
  'problemas para entender',
  'no me entiendes',
  'no estás entendiendo',
  'no puedes ayudarme',
  'no me estás ayudando',
  'estoy frustrado',
  'me estoy enojando',
  'esto no funciona',
  'este bot no funciona',
  'no eres útil'
];

// Frases adicionales que indican atención cuando son enviadas por el bot
const BOT_ATTENTION_PHRASES = [
  'entiendo que prefieres hablar con un humano',
  'te comunico con un agente',
  'te paso con un agente',
  'voy a pasar esta conversación',
  'voy a comunicar tu caso',
  'le informaré a mi equipo',
  'informaré a un agente',
  'haré que un agente te contacte',
  'necesitas ayuda más específica',
  'parece que necesitas ayuda especializada',
  'un agente humano podría ayudarte mejor',
  'puedes comunicarte directamente',
  'puedes contactar por',
  'lamento no poder ayudarte más',
  'disculpa que no pueda resolver',
  'un humano podría resolver esto',
  'esto requiere atención personalizada',
  'requiere la intervención de un agente',
  'te recomendaría hablar con un agente',
  'lo mejor será que hables con un humano',
  'problema complejo que requiere atención',
  'lo comunicaré al equipo',
  'enviaré esta consulta',
  'le daré seguimiento a tu caso',
  'necesitas asistencia especializada'
];

/**
 * Verifica si un mensaje contiene frases que indican necesidad de atención humana
 * @param {string} message - El mensaje a verificar
 * @param {boolean} isBot - Si el mensaje proviene del bot (usa conjunto diferente de frases)
 * @returns {boolean} True si el mensaje requiere atención humana
 */
function checkForNotificationPhrases(message, isBot = false) {
  if (!message || typeof message !== 'string') {
    console.log('⚠️ checkForNotificationPhrases: mensaje inválido:', message);
    return false;
  }

  // Convertir a minúsculas para comparación
  const lowerMessage = message.toLowerCase();
  
  // Seleccionar el conjunto de frases según el remitente
  const phrasesToCheck = isBot ? 
    [...ATTENTION_PHRASES, ...BOT_ATTENTION_PHRASES] : 
    ATTENTION_PHRASES;
  
  // Verificar si alguna frase está en el mensaje
  for (const phrase of phrasesToCheck) {
    if (lowerMessage.includes(phrase.toLowerCase())) {
      console.log(`🔔 Frase detectada en mensaje: "${phrase}"`);
      return true;
    }
  }
  
  return false;
}

/**
 * Procesa un mensaje para determinar si requiere una notificación
 * @param {Object} message - Objeto con los datos del mensaje
 * @param {string} message.content - El contenido del mensaje
 * @param {string} message.sender_type - Tipo de remitente ('user', 'bot', 'system')
 * @param {string} message.conversation_id - ID de la conversación
 * @returns {Promise<boolean>} True si se procesó correctamente
 */
async function processMessageForNotification(message) {
  if (!message || !message.content) {
    console.log('⚠️ processMessageForNotification: mensaje inválido');
    return false;
  }
  
  try {
    // Solo procesamos mensajes del bot para notificaciones
    if (message.sender_type !== 'bot') {
      return false;
    }
    
    // Verificar si el mensaje contiene frases que requieren atención
    const requiresNotification = checkForNotificationPhrases(message.content, true);
    
    if (requiresNotification && message.conversation_id) {
      console.log(`🔔 Mensaje del bot requiere notificación. Conversación: ${message.conversation_id}`);
      
      // Buscar el número de teléfono asociado a esta conversación
      let phoneNumber = null;
      
      // Verificar mapa global primero (más rápido)
      if (global.conversationIdToPhoneMap && global.conversationIdToPhoneMap[message.conversation_id]) {
        phoneNumber = global.conversationIdToPhoneMap[message.conversation_id];
      } 
      // Si no hay mapa o no se encuentra, buscar en Supabase
      else {
        const { data, error } = await supabase
          .from('messages')
          .select('customer_phone')
          .eq('conversation_id', message.conversation_id)
          .not('customer_phone', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (error) {
          console.error('❌ Error al buscar teléfono en Supabase:', error);
        } else if (data && data.length > 0) {
          phoneNumber = data[0].customer_phone;
          
          // Actualizar mapas globales
          if (global.conversationIdToPhoneMap) {
            global.conversationIdToPhoneMap[message.conversation_id] = phoneNumber;
          }
          if (global.phoneToConversationMap) {
            global.phoneToConversationMap[phoneNumber] = message.conversation_id;
          }
        }
      }
      
      if (phoneNumber) {
        // Enviar notificación por correo
        try {
          await sendBusinessNotification(
            message.conversation_id,
            message.content,
            phoneNumber
          );
          return true;
        } catch (error) {
          console.error('❌ Error enviando notificación:', error);
          return false;
        }
      } else {
        console.log('⚠️ No se encontró número de teléfono para la conversación');
        return false;
      }
    }
    
    return requiresNotification;
  } catch (error) {
    console.error('❌ Error en processMessageForNotification:', error);
    return false;
  }
}

/**
 * Envía una notificación por correo electrónico al equipo de soporte
 * @param {string} conversationId - ID de la conversación
 * @param {string} message - Mensaje que activó la notificación
 * @param {string} phoneNumber - Número de teléfono del cliente
 * @returns {Promise<Object>} Resultado del envío
 */
async function sendBusinessNotification(conversationId, message, phoneNumber) {
  try {
    console.log(`🔔 Iniciando envío de notificación para conversación ${conversationId}`);
    
    // Verificar parámetros
    if (!conversationId || !message || !phoneNumber) {
      throw new Error('Faltan parámetros para enviar notificación');
    }
    
    // Configurar destinatarios
    const recipients = EMAIL_CONFIG.recipients;
    if (!recipients || recipients.length === 0) {
      throw new Error('No hay destinatarios configurados para la notificación');
    }
    
    // Obtener historial reciente de la conversación
    let conversationHistory = [];
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) {
        console.error('❌ Error al recuperar historial de conversación:', error);
      } else if (data && data.length > 0) {
        conversationHistory = data.reverse();
      }
    } catch (dbError) {
      console.error('❌ Error al consultar base de datos:', dbError);
    }
    
    // Formatear mensaje HTML con los detalles
    let formattedHistory = '';
    if (conversationHistory.length > 0) {
      formattedHistory = '<div style="margin-top: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 5px;">';
      formattedHistory += '<h3 style="margin-top: 0; color: #333;">Historial reciente:</h3>';
      formattedHistory += '<div style="overflow-y: auto; max-height: 300px;">';
      
      for (const msg of conversationHistory) {
        const senderType = msg.sender_type || 'desconocido';
        const isUser = senderType === 'user';
        const messageTime = new Date(msg.created_at).toLocaleString();
        
        formattedHistory += `
          <div style="margin: 10px 0; padding: 8px 12px; border-radius: 8px; 
                     background-color: ${isUser ? '#f0f0f0' : '#e1f5fe'}; 
                     text-align: ${isUser ? 'left' : 'right'};">
            <div style="font-weight: bold; margin-bottom: 3px; font-size: 12px; color: #666;">
              ${isUser ? 'Cliente' : 'Bot'} • ${messageTime}
            </div>
            <div style="white-space: pre-wrap;">${msg.content || '(mensaje vacío)'}</div>
          </div>
        `;
      }
      
      formattedHistory += '</div></div>';
    }
    
    // URL del panel de control para ver la conversación
    const controlPanelUrl = process.env.CONTROL_PANEL_URL || 'https://example.com/dashboard';
    const conversationUrl = `${controlPanelUrl}/conversations/${conversationId}`;
    
    // Contenido del correo
    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Notificación: Conversación Requiere Atención</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background-color: #1976d2; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
        .content { padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
        .alert { background-color: #ffebee; border-left: 4px solid #f44336; padding: 10px 15px; margin: 10px 0; }
        .button { display: inline-block; background-color: #1976d2; color: white; text-decoration: none; padding: 10px 15px; border-radius: 4px; font-weight: bold; }
        .footer { margin-top: 30px; font-size: 12px; color: #777; }
        pre { background-color: #f5f5f5; padding: 10px; border-radius: 5px; white-space: pre-wrap; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0;">🔔 Conversación Requiere Atención</h2>
        </div>
        <div class="content">
          <p>Una conversación ha sido marcada para revisión humana.</p>
          
          <div style="margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Detalles:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Número del cliente:</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${phoneNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">ID de conversación:</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${conversationId}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Fecha y hora:</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${new Date().toLocaleString()}</td>
              </tr>
            </table>
          </div>
          
          <div class="alert">
            <strong>Mensaje que activó la notificación:</strong>
            <pre>${message}</pre>
          </div>
          
          ${formattedHistory}
          
          <div style="margin-top: 25px; text-align: center;">
            <a href="${conversationUrl}" class="button">Ver Conversación Completa</a>
          </div>
          
          <div class="footer">
            <p>Este es un mensaje automático del sistema de asistencia. Por favor, no responda a este correo.</p>
            <p>© ${new Date().getFullYear()} Sistema de Notificaciones de IA</p>
          </div>
        </div>
      </div>
    </body>
    </html>
    `;
    
    // Configurar transporte de correo
    let transporter = null;
    try {
      transporter = nodemailer.createTransport({
        host: EMAIL_CONFIG.host,
        port: EMAIL_CONFIG.port,
        secure: EMAIL_CONFIG.secure,
        auth: EMAIL_CONFIG.auth,
        tls: {
          rejectUnauthorized: false // Para desarrollo y pruebas
        }
      });
    } catch (transportError) {
      console.error('❌ Error al configurar transportador de correo:', transportError);
      throw new Error('Error en configuración de correo: ' + transportError.message);
    }
    
    // Verificar conexión con el servidor de correo
    try {
      await transporter.verify();
      console.log('📧 Conexión con servidor de correo verificada');
    } catch (verifyError) {
      console.error('❌ Error al verificar conexión con servidor de correo:', verifyError);
      
      // Intentar con configuración alternativa
      try {
        console.log('🔄 Intentando con configuración alternativa');
        transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: EMAIL_CONFIG.auth
        });
        await transporter.verify();
        console.log('📧 Conexión alternativa verificada');
      } catch (alternativeError) {
        console.error('❌ Error con configuración alternativa:', alternativeError);
        throw new Error('No se pudo establecer conexión con servidor de correo');
      }
    }
    
    // Opciones del correo
    const mailOptions = {
      from: EMAIL_CONFIG.defaultFrom,
      to: recipients.join(', '),
      subject: `🔔 Atención requerida - Cliente ${phoneNumber}`,
      html: emailHtml,
      text: `Notificación: Conversación ${conversationId} con el cliente ${phoneNumber} requiere atención. Mensaje: ${message}`,
    };
    
    // Agregar BCC si está configurado
    if (EMAIL_CONFIG.bcc && EMAIL_CONFIG.bcc.length > 0) {
      mailOptions.bcc = EMAIL_CONFIG.bcc.join(', ');
    }
    
    // Enviar correo
    let emailResult = null;
    try {
      console.log('📧 Enviando notificación por correo a:', recipients.join(', '));
      emailResult = await transporter.sendMail(mailOptions);
      console.log('✅ Notificación enviada correctamente:', emailResult.messageId);
    } catch (sendError) {
      console.error('❌ Error al enviar correo:', sendError);
      
      // Intentar una segunda vez con configuración más simple
      try {
        console.log('🔄 Reintentando envío con configuración simple...');
        const simpleTransporter = nodemailer.createTransport({
          service: 'gmail',
          auth: EMAIL_CONFIG.auth
        });
        
        emailResult = await simpleTransporter.sendMail({
          from: EMAIL_CONFIG.auth.user,
          to: recipients[0], // Solo al primer destinatario en el reintento
          subject: `[URGENTE] Atención requerida - Cliente ${phoneNumber}`,
          text: `Notificación: Conversación ${conversationId} con cliente ${phoneNumber} requiere atención.\n\nMensaje: ${message}\n\nVer en: ${conversationUrl}`
        });
        console.log('✅ Reintento exitoso:', emailResult.messageId);
      } catch (retryError) {
        console.error('❌ Falló reintento de envío:', retryError);
        throw new Error('No se pudo enviar la notificación: ' + sendError.message);
      }
    }
    
    // Registrar intento de notificación en la base de datos
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert([{
          conversation_id: conversationId,
          phone_number: phoneNumber,
          message: message,
          recipients: recipients.join(', '),
          success: !!emailResult,
          email_id: emailResult ? emailResult.messageId : null,
          error: emailResult ? null : 'Error al enviar correo'
        }]);
      
      if (error) {
        console.error('⚠️ Error al registrar notificación en base de datos:', error);
      } else {
        console.log('✅ Notificación registrada en base de datos');
      }
    } catch (dbError) {
      console.error('⚠️ Error al intentar registrar notificación:', dbError);
    }
    
    return {
      success: true,
      messageId: emailResult ? emailResult.messageId : null,
      recipients: recipients,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Error general en sendBusinessNotification:', error);
    
    // Intentar registrar el error en la base de datos
    try {
      await supabase
        .from('notifications')
        .insert([{
          conversation_id: conversationId,
          phone_number: phoneNumber,
          message: message && message.substring(0, 255),
          recipients: EMAIL_CONFIG.recipients ? EMAIL_CONFIG.recipients.join(', ') : 'No configurado',
          success: false,
          error: error.message
        }]);
    } catch (dbError) {
      console.error('⚠️ Error al registrar fallo de notificación:', dbError);
    }
    
    throw error;
  }
}

/**
 * Función auxiliar para enviar mensajes de WhatsApp con verificación de notificación
 * @param {string} phoneNumber - Número de teléfono del destinatario
 * @param {string} message - Mensaje a enviar
 * @param {Object} options - Opciones adicionales
 * @param {string} options.conversationId - ID de la conversación
 * @param {Function} options.sendFunction - Función personalizada para enviar el mensaje
 * @returns {Promise<Object>} Resultado del envío
 */
async function sendWhatsAppResponseWithNotification(phoneNumber, message, options = {}) {
  if (!phoneNumber || !message) {
    console.error('❌ sendWhatsAppResponseWithNotification: Faltan parámetros obligatorios');
    throw new Error('Número de teléfono y mensaje son obligatorios');
  }
  
  console.log(`📱 Enviando mensaje a ${phoneNumber} con verificación de notificación`);
  
  // Extraer opciones
  const { conversationId, sendFunction } = options;
  
  // Determinar la función de envío
  const sendMessageFunction = sendFunction || 
                            (global.sendTextMessageGupShup || 
                            (typeof sendTextMessageGupShup === 'function' ? sendTextMessageGupShup : null));
  
  if (!sendMessageFunction) {
    console.error('❌ No se encontró una función para enviar mensajes');
    throw new Error('Función de envío no disponible');
  }
  
  try {
    // Enviar el mensaje
    const result = await sendMessageFunction(phoneNumber, message);
    
    // Verificar si el mensaje requiere notificación
    const requiresNotification = checkForNotificationPhrases(message, true);
    
    if (requiresNotification) {
      console.log('🔔 Mensaje enviado requiere notificación, procesando...');
      
      // Obtener ID de conversación
      let convId = conversationId;
      
      // Si no tenemos ID, intentar obtener del mapa global
      if (!convId && global.phoneToConversationMap) {
        convId = global.phoneToConversationMap[phoneNumber];
      }
      
      // Enviar notificación si tenemos ID de conversación
      if (convId) {
        try {
          const notifyResult = await sendBusinessNotification(convId, message, phoneNumber);
          console.log(`✅ Notificación enviada: ${JSON.stringify(notifyResult)}`);
        } catch (notifyError) {
          console.error(`❌ Error enviando notificación: ${notifyError.message}`);
        }
      } else {
        console.log('⚠️ No se pudo obtener ID de conversación para notificación');
      }
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Error enviando mensaje: ${error.message}`);
    throw error;
  }
}

// Exportar funciones
module.exports = {
  checkForNotificationPhrases,
  processMessageForNotification,
  sendBusinessNotification,
  sendWhatsAppResponseWithNotification,
  ATTENTION_PHRASES,
  BOT_ATTENTION_PHRASES
}; 