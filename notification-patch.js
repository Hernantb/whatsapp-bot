/**
 * Módulo de notificaciones para WhatsApp Bot
 * 
 * Este módulo implementa un sistema de notificaciones que detecta cuando un mensaje
 * del bot requiere atención humana y envía notificaciones por correo electrónico.
 */

const nodemailer = require('nodemailer');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

// Solo crear el cliente de Supabase si tenemos las credenciales
let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Cliente Supabase inicializado en notification-patch.js');
} else {
  console.warn('⚠️ Falta configuración de Supabase. Las notificaciones funcionarán con limitaciones.');
}

// Configuración del transporte de correo
const mailConfig = {
  host: process.env.SMTP_HOST || process.env.EMAIL_HOST,
  port: process.env.SMTP_PORT || process.env.EMAIL_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true' || process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER || '',
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD || ''
  },
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  }
};

// Lista de frases que indican necesidad de atención humana
const ATTENTION_PHRASES = {
  // Frases del bot que indican que necesita ayuda de un humano
  BOT: [
    "no puedo ayudarte con eso",
    "necesitarás hablar con un agente humano",
    "te voy a transferir",
    "un agente humano te contactará",
    "necesito transferirte",
    "no tengo esa información",
    "no estoy autorizado",
    "no tengo acceso a",
    "no puedo procesar",
    "mi capacidad es limitada",
    "esto está fuera de mi alcance",
    "no puedo realizar esa acción",
    "requiere la intervención de un humano",
    "esto debe ser manejado por una persona",
    "necesitas hablar con atención al cliente",
    "contacta con el soporte técnico",
    "necesitas hablar con un representante",
    "necesitas contactar directamente",
    "hablar con un especialista"
  ],
  
  // Frases de usuarios que podrían indicar urgencia o frustración
  USER: [
    "hablar con humano",
    "hablar con persona",
    "hablar con agente",
    "quiero una persona real",
    "necesito ayuda urgente",
    "esto es urgente",
    "emergencia",
    "no me estás entendiendo",
    "no funciona",
    "estoy enojado",
    "molesto",
    "frustrado",
    "queja",
    "reclamación",
    "devolución",
    "cancelar",
    "error",
    "problema grave"
  ]
};

/**
 * Verifica si un mensaje contiene frases que requieren notificación
 * @param {string} message - El mensaje a verificar
 * @param {string} source - Fuente del mensaje ('bot' o 'user')
 * @returns {Object} Resultado del análisis
 */
function checkForNotificationPhrases(message, source = 'bot') {
  if (!message) return { requiresNotification: false, matches: [] };
  
  // Convertir mensaje a minúsculas para comparación insensible a mayúsculas
  const lowerMessage = message.toLowerCase();
  let sourceUppercase = source.toUpperCase();
  
  // Verificar si el origen es válido
  if (!ATTENTION_PHRASES[sourceUppercase]) {
    console.warn(`Fuente no válida: ${source}. Usando 'BOT' por defecto.`);
    sourceUppercase = 'BOT';
  }
  
  // Buscar coincidencias con las frases de atención
  const phrases = ATTENTION_PHRASES[sourceUppercase];
  const matches = [];
  
  for (const phrase of phrases) {
    if (lowerMessage.includes(phrase.toLowerCase())) {
      matches.push(phrase);
    }
  }
  
  return {
    requiresNotification: matches.length > 0,
    matches,
    source: sourceUppercase
  };
}

/**
 * Procesa un mensaje para determinar si requiere notificación
 * @param {string} message - Mensaje a procesar
 * @param {string} source - Fuente del mensaje ('bot' o 'user')
 * @param {string} conversationId - ID de la conversación
 * @param {string} clientPhoneNumber - Número de teléfono del cliente (opcional)
 * @returns {Promise<Object>} Resultado del procesamiento
 */
async function processMessageForNotification(message, source, conversationId, clientPhoneNumber = null) {
  try {
    console.log(`🔍 Analizando mensaje para notificación (fuente: ${source})`);
    
    // Verificar si el mensaje contiene frases que requieren notificación
    const analysis = checkForNotificationPhrases(message, source);
    
    if (!analysis.requiresNotification) {
      console.log(`ℹ️ El mensaje no contiene frases que requieran notificación`);
      return { success: true, requiresNotification: false };
    }
    
    console.log(`⚠️ Mensaje requiere notificación. Coincidencias: ${analysis.matches.join(', ')}`);
    
    // Si no tenemos el número de teléfono, intentamos obtenerlo de la base de datos
    let phoneNumber = clientPhoneNumber;
    if (!phoneNumber && supabase) {
      console.log(`Buscando número de teléfono para conversación ${conversationId}`);
      
      try {
        // Consultar la base de datos para obtener el número de teléfono
        const { data, error } = await supabase
          .from('conversations')
          .select('client_phone')
          .eq('id', conversationId)
          .single();
        
        if (error) {
          console.error(`Error al consultar Supabase: ${error.message}`);
        } else if (data) {
          phoneNumber = data.client_phone;
          console.log(`Número de teléfono encontrado: ${phoneNumber}`);
        } else {
          console.warn(`No se encontró la conversación con ID ${conversationId}`);
        }
      } catch (dbError) {
        console.error(`Error al consultar la base de datos: ${dbError.message}`);
      }
    }
    
    // Enviar notificación
    if (phoneNumber) {
      console.log(`📧 Enviando notificación para ${phoneNumber}`);
      const notificationResult = await sendBusinessNotification(conversationId, message, phoneNumber);
      
      if (notificationResult) {
        console.log(`✅ Notificación enviada correctamente`);
      } else {
        console.error(`❌ Error al enviar notificación`);
      }
      
      return {
        success: true,
        requiresNotification: true,
        notificationSent: notificationResult,
        phoneNumber
      };
    } else {
      console.error(`❌ No se pudo obtener el número de teléfono para la notificación`);
      return {
        success: false,
        requiresNotification: true,
        notificationSent: false,
        error: 'No se pudo obtener el número de teléfono'
      };
    }
  } catch (error) {
    console.error(`Error al procesar mensaje para notificación: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Envía una notificación por correo electrónico
 * @param {string} conversationId - ID de la conversación
 * @param {string} botMessage - Mensaje que desencadenó la notificación
 * @param {string} clientPhoneNumber - Número de teléfono del cliente
 * @returns {Promise<boolean>} Resultado del envío
 */
async function sendBusinessNotification(conversationId, botMessage, clientPhoneNumber) {
  try {
    console.log(`🔔 Iniciando proceso de notificación por correo...`);
    
    // Configurar destinatarios
    const notificationEmails = process.env.NOTIFICATION_EMAILS || process.env.NOTIFICATION_EMAIL 
      ? (process.env.NOTIFICATION_EMAILS || process.env.NOTIFICATION_EMAIL).split(',').map(email => email.trim())
      : [];
    
    if (!notificationEmails.length) {
      console.error('⚠️ No hay direcciones de correo configuradas para notificaciones');
      return false;
    }
    
    const businessName = process.env.BUSINESS_NAME || 'Mi Negocio';
    
    // Obtener las últimas 10 mensajes de la conversación
    let conversationHistory = [];
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('content, sender_type, created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (error) {
          console.error(`Error al obtener historial de conversación: ${error.message}`);
        } else if (data) {
          // Invertir para que estén en orden cronológico
          conversationHistory = data.reverse();
          console.log(`Se obtuvieron ${conversationHistory.length} mensajes para el historial`);
        }
      } catch (dbError) {
        console.error(`Error en consulta de historial: ${dbError.message}`);
      }
    } else {
      console.warn('⚠️ No se pudo obtener historial de conversación (Supabase no configurado)');
    }
    
    // Formatear el contenido del correo
    const formattedHistory = conversationHistory.map(msg => {
      const sender = msg.sender_type === 'user' ? 'Cliente' : 'Bot';
      const date = new Date(msg.created_at).toLocaleString();
      return `<p><strong>${sender} (${date}):</strong> ${msg.content}</p>`;
    }).join('\n');
    
    // URL del panel de control
    const controlPanelUrl = process.env.CONTROL_PANEL_URL || 'http://localhost:3000';
    const conversationUrl = `${controlPanelUrl}/conversations/${conversationId}`;
    
    // Construir el contenido del correo
    const emailHtml = `
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { width: 100%; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .content { margin-bottom: 20px; }
          .alert { color: #721c24; background-color: #f8d7da; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
          .history { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .footer { font-size: 12px; color: #6c757d; margin-top: 30px; }
          .button { display: inline-block; background-color: #007bff; color: white; padding: 10px 15px; 
                    text-decoration: none; border-radius: 5px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🔔 Notificación de WhatsApp Bot</h2>
          </div>
          
          <div class="content">
            <p>Se ha detectado un mensaje que requiere atención humana:</p>
            <div class="alert">
              <p><strong>Mensaje del bot:</strong> ${botMessage}</p>
            </div>
            
            <p><strong>Número de teléfono del cliente:</strong> ${clientPhoneNumber}</p>
            <p><strong>ID de conversación:</strong> ${conversationId}</p>
            
            <a href="${conversationUrl}" class="button">Ver conversación completa</a>
          </div>
          
          <div class="history">
            <h3>Historial reciente de la conversación:</h3>
            ${formattedHistory || '<p>No se pudo obtener el historial de la conversación</p>'}
          </div>
          
          <div class="footer">
            <p>Este es un mensaje automático generado por WhatsApp Bot para ${businessName}.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    // Verificar si hay credenciales de correo configuradas
    if (!mailConfig.auth.user || !mailConfig.auth.pass) {
      console.error('⚠️ No hay credenciales de correo configuradas. No se enviará la notificación.');
      return false;
    }
    
    // Configurar opciones del correo
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.EMAIL_FROM || `"WhatsApp Bot" <${mailConfig.auth.user}>`,
      to: notificationEmails[0],
      subject: `🔔 WhatsApp Bot: Mensaje que requiere atención - Cliente ${clientPhoneNumber}`,
      html: emailHtml
    };
    
    // Agregar destinatarios en copia oculta (BCC) si hay más de uno
    if (notificationEmails.length > 1) {
      mailOptions.bcc = notificationEmails.slice(1).join(',');
    }
    
    // Crear transporte de correo
    let transporter = nodemailer.createTransport(mailConfig);
    
    try {
      // Verificar conexión con el servidor de correo
      await transporter.verify();
      console.log('✅ Conexión con servidor de correo verificada');
    } catch (smtpError) {
      console.error(`❌ Error al verificar servidor de correo: ${smtpError.message}`);
      
      // Si falla la verificación, intentar con configuración alternativa
      if (process.env.ALTERNATE_SMTP_HOST) {
        console.log('⚠️ Intentando con configuración SMTP alternativa...');
        
        const alternateConfig = {
          host: process.env.ALTERNATE_SMTP_HOST,
          port: process.env.ALTERNATE_SMTP_PORT || 587,
          secure: process.env.ALTERNATE_SMTP_SECURE === 'true',
          auth: {
            user: process.env.ALTERNATE_SMTP_USER,
            pass: process.env.ALTERNATE_SMTP_PASS
          },
          tls: {
            rejectUnauthorized: process.env.NODE_ENV === 'production'
          }
        };
        
        transporter = nodemailer.createTransport(alternateConfig);
      } else {
        console.error('❌ No hay configuración SMTP alternativa disponible.');
        // Continuar para intentar registrar en la base de datos, pero marcará fallo en el envío
      }
    }
    
    // Enviar el correo
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Correo enviado: ${info.messageId}`);
      
      // Registrar la notificación en la base de datos
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('notifications')
            .insert({
              conversation_id: conversationId,
              phone_number: clientPhoneNumber,
              message: botMessage,
              email_sent: true,
              email_recipients: notificationEmails.join(','),
              message_id: info.messageId
            });
          
          if (error) {
            console.error(`Error al registrar notificación en BD: ${error.message}`);
          } else {
            console.log(`✅ Notificación registrada en base de datos`);
          }
        } catch (dbError) {
          console.error(`Error al guardar registro de notificación: ${dbError.message}`);
        }
      }
      
      return true;
    } catch (emailError) {
      console.error(`❌ Error al enviar correo: ${emailError.message}`);
      
      // Registrar el intento fallido en la base de datos
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('notifications')
            .insert({
              conversation_id: conversationId,
              phone_number: clientPhoneNumber,
              message: botMessage,
              email_sent: false,
              error_message: emailError.message
            });
          
          if (error) {
            console.error(`Error al registrar fallo de notificación: ${error.message}`);
          } else {
            console.log(`✅ Intento fallido de notificación registrado en BD`);
          }
        } catch (dbError) {
          console.error(`Error al guardar registro de fallo: ${dbError.message}`);
        }
      }
      
      return false;
    }
  } catch (error) {
    console.error(`❌ Error general en sendBusinessNotification: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

// Exportar funciones
module.exports = {
  checkForNotificationPhrases,
  processMessageForNotification,
  sendBusinessNotification
}; 