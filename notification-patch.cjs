// notification-patch.cjs - Módulo para enviar notificaciones cuando un mensaje del bot requiere atención humana
require('dotenv').config();
const nodemailer = require('nodemailer');

// Importar configuración de Supabase
const { supabase } = require('./supabase-config.cjs');

// Configuración para envío de correos
const EMAIL_USER = process.env.EMAIL_USER || 'bexorai@gmail.com';
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD;
const EMAIL_TO_DEFAULT = process.env.EMAIL_TO || 'bexorai@gmail.com';

// Verificar configuración
console.log(`📧 Configuración de notificaciones por correo:`);
console.log(`📧 Correo remitente: ${EMAIL_USER}`);
console.log(`📧 Correo destinatario predeterminado: ${EMAIL_TO_DEFAULT}`);
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
    let businessId = null;
    
    if (!clientPhone || !businessId) {
      try {
        // Obtener información de la conversación desde Supabase
        const { data, error } = await supabase
          .from('conversations')
          .select('user_id, business_id')
          .eq('id', conversationId)
          .single();
        
        if (error) {
          console.error(`❌ Error obteniendo datos de conversación: ${error.message}`);
        } else if (data) {
          clientPhone = data.user_id;
          businessId = data.business_id;
          console.log(`📱 Datos obtenidos de la base de datos: teléfono=${clientPhone}, negocioId=${businessId}`);
        }
      } catch (dbError) {
        console.error(`❌ Error consultando la base de datos: ${dbError.message}`);
      }
    }
    
    // Obtener el correo del negocio según el business_id
    // Por defecto, usar el correo definido en las variables de entorno
    let businessEmail = EMAIL_TO_DEFAULT;
    let businessName = "Negocio";
    
    if (businessId) {
      try {
        console.log(`🔍 Buscando información del negocio con ID: ${businessId}`);
        
        // Obtener todos los campos del negocio para verificar qué campos existen
        const { data: businessData, error: businessError } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', businessId)
          .single();
        
        if (businessError) {
          console.error(`❌ Error obteniendo datos del negocio: ${businessError.message}`);
        } else if (businessData) {
          console.log(`✅ Datos del negocio obtenidos:`, businessData);
          
          // Verificar varios campos posibles que podrían contener el correo
          // Intentar diferentes campos que podrían contener un correo electrónico
          const possibleEmailFields = ['email', 'contact_email', 'notification_email', 'business_email', 'admin_email'];
          
          // Buscar el primer campo que exista y tenga un valor
          for (const field of possibleEmailFields) {
            if (businessData[field] && businessData[field].includes('@')) {
              businessEmail = businessData[field];
              console.log(`✉️ Correo del negocio encontrado en campo '${field}': ${businessEmail}`);
              break;
            }
          }
          
          // Verificar si encontramos un correo
          if (businessEmail === EMAIL_TO_DEFAULT) {
            console.warn(`⚠️ No se encontró correo válido para el negocio con ID: ${businessId}`);
            console.log(`⚠️ Usando correo predeterminado: ${EMAIL_TO_DEFAULT}`);
          }
          
          // Obtener nombre del negocio si está disponible
          if (businessData.name) {
            businessName = businessData.name;
          }
        } else {
          console.warn(`⚠️ No se encontró el negocio con ID: ${businessId}`);
        }
      } catch (businessDbError) {
        console.error(`❌ Error consultando información del negocio: ${businessDbError.message}`);
      }
    } else {
      console.warn(`⚠️ No se encontró ID de negocio para la conversación: ${conversationId}`);
    }
    
    // Enviar notificación por correo
    const notificationSent = await sendBusinessNotification(
      message,
      conversationId,
      clientPhone,
      businessEmail,
      businessId,
      businessName
    );
    
    return {
      requiresNotification: true,
      notificationSent,
      businessEmail
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
 * @param {string} emailTo - Correo electrónico de destino
 * @param {string} businessId - ID del negocio
 * @param {string} businessName - Nombre del negocio
 * @returns {boolean} - True si la notificación se envió correctamente
 */
async function sendBusinessNotification(message, conversationId, phoneNumber, emailTo, businessId, businessName = 'BEXOR') {
  try {
    if (!EMAIL_APP_PASSWORD) {
      console.error('⚠️ IMPORTANTE: No se puede enviar notificación por correo: falta configurar EMAIL_APP_PASSWORD');
      console.error('⚠️ Agrega la variable EMAIL_APP_PASSWORD a las variables de entorno en Render');
      console.error('⚠️ Mensaje que requiere atención: ' + message.substring(0, 100));
      console.error('⚠️ Teléfono del cliente: ' + phoneNumber);
      console.error('⚠️ ID del negocio: ' + businessId);
      console.error('⚠️ Correo de destino: ' + emailTo);
      
      // Registrar la falta de configuración pero no fallar
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
      <h2>🤖 Notificación de Bot de WhatsApp - ${businessName}</h2>
      <p><strong>Se requiere atención humana para un cliente.</strong></p>
      <hr>
      <p><strong>📱 Número de teléfono:</strong> ${formattedPhone}</p>
      <p><strong>🆔 ID de conversación:</strong> ${conversationId}</p>
      <p><strong>🏢 ID de negocio:</strong> ${businessId || 'No disponible'}</p>
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
      to: emailTo,
      subject: emailSubject,
      html: emailHtml
    };
    
    // Enviar el correo
    console.log(`📧 Enviando notificación por correo a ${emailTo}...`);
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