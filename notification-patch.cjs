// notification-patch.cjs - Módulo para enviar notificaciones cuando un mensaje del bot requiere atención humana
require('dotenv').config();
const nodemailer = require('nodemailer');

// Importar configuración de Supabase
const { supabase } = require('./supabase-config.cjs');

// Configuración para envío de correos
const EMAIL_USER = process.env.EMAIL_USER || 'bexorai@gmail.com';
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD;
const EMAIL_TO = process.env.EMAIL_TO || 'bexorai@gmail.com';

// Verificar configuración
console.log(`📧 Configuración de notificaciones por correo:`);
console.log(`📧 Correo remitente: ${EMAIL_USER}`);
console.log(`📧 Correo destinatario: ${EMAIL_TO}`);
console.log(`📧 Contraseña configurada: ${EMAIL_APP_PASSWORD ? '✅ SÍ' : '❌ NO'}`);

// Configurar transport de correo
const mailTransport = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_APP_PASSWORD
  }
});

// Lista de frases que indican que se necesita atención humana
const NOTIFICATION_PHRASES = [
  "¡Perfecto! tu cita ha sido confirmada para",
  "¡Perfecto! un asesor te llamará",
  "¡Perfecto! un asesor te contactará",
  "¡Perfecto! una persona te contactará"
];

/**
 * Verifica si un mensaje contiene alguna de las frases que indican necesidad de atención
 * @param {string} message - El mensaje a revisar
 * @returns {boolean} - True si el mensaje contiene alguna de las frases de notificación
 */
function checkForNotificationPhrases(message) {
  if (!message) return false;
  
  // Normalizar el mensaje (convertir a minúsculas, eliminar espacios extras)
  const normalizedMessage = message.toLowerCase().trim();
  
  // Verificar cada frase
  for (const phrase of NOTIFICATION_PHRASES) {
    const normalizedPhrase = phrase.toLowerCase().trim();
    
    if (normalizedMessage.includes(normalizedPhrase)) {
      console.log(`🔔 Frase detectada: "${phrase}"`);
      return true;
    }
  }
  
  return false;
}

/**
 * Procesa un mensaje para determinar si se debe enviar una notificación
 * @param {string} message - El mensaje a procesar
 * @param {string} conversationId - ID de la conversación
 * @param {string} phoneNumber - Número de teléfono del cliente (opcional)
 * @returns {Object} - Resultado del procesamiento
 */
async function processMessageForNotification(message, conversationId, phoneNumber = null) {
  try {
    // Verificar si el mensaje contiene alguna frase que requiera notificación
    const requiresNotification = checkForNotificationPhrases(message);
    
    if (!requiresNotification) {
      return { 
        requiresNotification: false,
        notificationSent: false 
      };
    }
    
    console.log(`🔔 Notificación requerida para conversación: ${conversationId}`);
    
    // Si no tenemos el número de teléfono, intentar obtenerlo de la base de datos
    let clientPhone = phoneNumber;
    
    if (!clientPhone) {
      try {
        // Obtener el número de teléfono del cliente desde Supabase
        const { data, error } = await supabase
          .from('conversations')
          .select('phone_number')
          .eq('id', conversationId)
          .single();
        
        if (error) {
          console.error(`❌ Error obteniendo número de teléfono: ${error.message}`);
        } else if (data) {
          clientPhone = data.phone_number;
          console.log(`📱 Número de teléfono obtenido de la base de datos: ${clientPhone}`);
        }
      } catch (dbError) {
        console.error(`❌ Error consultando la base de datos: ${dbError.message}`);
      }
    }
    
    // Enviar notificación por correo
    const notificationSent = await sendBusinessNotification(
      message,
      conversationId,
      clientPhone
    );
    
    return {
      requiresNotification: true,
      notificationSent
    };
  } catch (error) {
    console.error(`❌ Error en processMessageForNotification: ${error.message}`);
    return {
      requiresNotification: false,
      notificationSent: false,
      error: error.message
    };
  }
}

/**
 * Envía una notificación por correo electrónico
 * @param {string} message - El mensaje del bot
 * @param {string} conversationId - ID de la conversación
 * @param {string} phoneNumber - Número de teléfono del cliente
 * @returns {boolean} - True si la notificación se envió correctamente
 */
async function sendBusinessNotification(message, conversationId, phoneNumber) {
  try {
    if (!EMAIL_APP_PASSWORD) {
      console.error('❌ No se puede enviar notificación: falta configurar EMAIL_APP_PASSWORD');
      return false;
    }
    
    // Formatear el mensaje para el correo
    const formattedPhone = phoneNumber ? phoneNumber : 'No disponible';
    const timestamp = new Date().toLocaleString('es-ES', { 
      timeZone: 'America/Mexico_City'
    });
    
    // Crear contenido del correo
    const emailSubject = `🔔 Atención requerida: Cliente en WhatsApp (${formattedPhone})`;
    const emailHtml = `
      <h2>🤖 Notificación de Bot de WhatsApp</h2>
      <p><strong>Se requiere atención humana para un cliente.</strong></p>
      <hr>
      <p><strong>📱 Número de teléfono:</strong> ${formattedPhone}</p>
      <p><strong>🆔 ID de conversación:</strong> ${conversationId}</p>
      <p><strong>⏰ Fecha y hora:</strong> ${timestamp}</p>
      <p><strong>💬 Mensaje del bot:</strong></p>
      <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; margin: 10px 0;">
        ${message.replace(/\n/g, '<br>')}
      </div>
      <hr>
      <p>Por favor, continúe la conversación con el cliente lo antes posible.</p>
    `;
    
    // Configurar opciones del correo
    const mailOptions = {
      from: EMAIL_USER,
      to: EMAIL_TO,
      subject: emailSubject,
      html: emailHtml
    };
    
    // Enviar el correo
    console.log(`📧 Enviando notificación por correo a ${EMAIL_TO}...`);
    const info = await mailTransport.sendMail(mailOptions);
    
    console.log(`✅ Notificación enviada: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error enviando notificación por correo: ${error.message}`);
    return false;
  }
}

module.exports = {
  checkForNotificationPhrases,
  processMessageForNotification,
  sendBusinessNotification
}; 