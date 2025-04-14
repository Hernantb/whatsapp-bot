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
    
    // Si no tenemos el número de teléfono o ID del negocio, intentar obtenerlos de la base de datos
    let clientPhone = phoneNumber;
    let businessId = null;
    
    // Obtener información de la conversación desde Supabase
    try {
      console.log(`🔍 Obteniendo información de conversación: ${conversationId}`);
      const { data: conversationData, error: conversationError } = await supabase
        .from('conversations')
        .select('user_id, business_id')
        .eq('id', conversationId)
        .single();
      
      if (conversationError) {
        console.error(`❌ Error obteniendo datos de conversación: ${conversationError.message}`);
      } else if (conversationData) {
        clientPhone = conversationData.user_id;
        businessId = conversationData.business_id;
        console.log(`✅ Datos de conversación obtenidos: phone=${clientPhone}, businessId=${businessId}`);
      }
    } catch (dbError) {
      console.error(`❌ Error consultando conversación: ${dbError.message}`);
    }
    
    if (!businessId) {
      console.error(`❌ No se pudo obtener el ID del negocio para la conversación: ${conversationId}`);
      return {
        requiresNotification: true,
        notificationSent: false,
        error: 'No se pudo determinar el negocio asociado a la conversación'
      };
    }
    
    // Valores predeterminados
    let businessEmail = EMAIL_TO_DEFAULT;
    let businessName = "Negocio";
    let foundValidEmail = false;
    
    // PASO 1: Obtener datos del negocio
    try {
      console.log(`🔍 Obteniendo datos del negocio: ${businessId}`);
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();
      
      if (businessError) {
        console.error(`❌ Error obteniendo datos del negocio: ${businessError.message}`);
      } else if (businessData) {
        console.log(`✅ Datos del negocio obtenidos: ${JSON.stringify(businessData)}`);
        
        // Guardar nombre del negocio
        if (businessData.name) {
          businessName = businessData.name;
        }
        
        // PASO 2: Obtener propietario del negocio (si existe owner_id)
        const ownerId = businessData.owner_id;
        if (ownerId) {
          console.log(`🔍 Buscando perfil del propietario: ${ownerId}`);
          
          // Obtener perfil del propietario
          const { data: ownerProfile, error: ownerError } = await supabase
            .from('profiles')
            .select('email, name, full_name')
            .eq('id', ownerId)
            .single();
          
          if (ownerError) {
            console.error(`❌ Error obteniendo perfil del propietario: ${ownerError.message}`);
          } else if (ownerProfile && ownerProfile.email) {
            businessEmail = ownerProfile.email;
            foundValidEmail = true;
            console.log(`✅ Correo del propietario encontrado: ${businessEmail}`);
            
            // Si el perfil tiene nombre, usarlo si aún no tenemos nombre del negocio
            if (!businessName && (ownerProfile.full_name || ownerProfile.name)) {
              businessName = ownerProfile.full_name || ownerProfile.name;
            }
          }
        }
      }
    } catch (businessError) {
      console.error(`❌ Error consultando información del negocio: ${businessError.message}`);
    }
    
    // PASO 3: Si no encontramos el correo, buscar usuarios relacionados al negocio
    if (!foundValidEmail) {
      try {
        console.log(`🔍 Buscando usuarios relacionados con el negocio: ${businessId}`);
        const { data: businessUsers, error: buError } = await supabase
          .from('business_users')
          .select('user_id, role')
          .eq('business_id', businessId)
          .eq('is_active', true);
        
        if (buError) {
          console.error(`❌ Error obteniendo usuarios del negocio: ${buError.message}`);
        } else if (businessUsers && businessUsers.length > 0) {
          console.log(`✅ Encontrados ${businessUsers.length} usuarios asociados al negocio`);
          
          // Ordenar por rol (owner primero, luego admin, luego otros)
          businessUsers.sort((a, b) => {
            if (a.role === 'owner') return -1;
            if (b.role === 'owner') return 1;
            if (a.role === 'admin') return -1;
            if (b.role === 'admin') return 1;
            return 0;
          });
          
          // Obtener IDs de usuarios para buscar sus perfiles
          const userIds = businessUsers.map(bu => bu.user_id);
          
          // Buscar perfiles de usuarios
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, email, name, full_name')
            .in('id', userIds);
          
          if (profilesError) {
            console.error(`❌ Error obteniendo perfiles de usuarios: ${profilesError.message}`);
          } else if (profiles && profiles.length > 0) {
            console.log(`✅ Encontrados ${profiles.length} perfiles de usuarios`);
            
            // Crear un mapa de roles para optimizar la búsqueda
            const userRoles = {};
            businessUsers.forEach(bu => {
              userRoles[bu.user_id] = bu.role;
            });
            
            // Ordenar perfiles por rol (owner primero)
            profiles.sort((a, b) => {
              const roleA = userRoles[a.id] || '';
              const roleB = userRoles[b.id] || '';
              if (roleA === 'owner') return -1;
              if (roleB === 'owner') return 1;
              if (roleA === 'admin') return -1;
              if (roleB === 'admin') return 1;
              return 0;
            });
            
            // Buscar el primer perfil con email válido
            for (const profile of profiles) {
              if (profile.email && profile.email.includes('@')) {
                businessEmail = profile.email;
                foundValidEmail = true;
                console.log(`✅ Correo encontrado en perfil de usuario (${userRoles[profile.id] || 'user'}): ${businessEmail}`);
                break;
              }
            }
          }
        }
      } catch (usersError) {
        console.error(`❌ Error consultando usuarios relacionados: ${usersError.message}`);
      }
    }
    
    // Caso específico para Hernán Tenorio (por ID de negocio)
    if (businessId === '2d385aa5-40e0-4ec9-9360-19281bc605e4' && (!foundValidEmail || businessEmail === EMAIL_TO_DEFAULT)) {
      businessEmail = 'hernan.baigts@gmail.com';
      businessName = 'Hernán Tenorio';
      foundValidEmail = true;
      console.log(`⚠️ Usando correo específico para Hernán Tenorio: ${businessEmail}`);
    }
    
    // Si después de todos los intentos no encontramos un correo válido, usar el predeterminado
    if (!foundValidEmail) {
      console.warn(`⚠️ No se encontró correo válido para el negocio ${businessId}`);
      console.log(`⚠️ Usando correo predeterminado: ${EMAIL_TO_DEFAULT}`);
    } else {
      console.log(`✅ Se utilizará correo específico del negocio: ${businessEmail}`);
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
      businessEmail,
      businessName
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