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
    let userId = null;
    
    if (!clientPhone || !businessId) {
      try {
        // Obtener información de la conversación desde Supabase
        const { data, error } = await supabase
          .from('conversations')
          .select('user_id, business_id, created_by')
          .eq('id', conversationId)
          .single();
        
        if (error) {
          console.error(`❌ Error obteniendo datos de conversación: ${error.message}`);
        } else if (data) {
          clientPhone = data.user_id;
          businessId = data.business_id;
          // El usuario que creó la conversación es probablemente el dueño
          userId = data.created_by;
          console.log(`📱 Datos obtenidos de la base de datos: teléfono=${clientPhone}, negocioId=${businessId}, userId=${userId}`);
        }
      } catch (dbError) {
        console.error(`❌ Error consultando la base de datos: ${dbError.message}`);
      }
    }
    
    // Por defecto, usar el correo definido en las variables de entorno
    let businessEmail = EMAIL_TO_DEFAULT;
    let businessName = "Negocio";
    
    // ESTRATEGIA 1: Buscar usuarios relacionados con este negocio
    const users = await findBusinessUsers(businessId);
    
    if (users && users.length > 0) {
      console.log(`✅ Encontrados ${users.length} usuarios relacionados con el negocio ${businessId}`);
      
      // Intentar encontrar un correo válido entre los usuarios
      for (const user of users) {
        if (user.email && user.email.includes('@')) {
          businessEmail = user.email;
          console.log(`✉️ Correo encontrado en tabla auth.users: ${businessEmail}`);
          break;
        }
      }
    } else {
      console.log(`⚠️ No se encontraron usuarios relacionados con el negocio ${businessId}`);
    }
    
    // ESTRATEGIA 2: Si no encontramos correo, buscar en profiles con el usuario creador
    if (businessEmail === EMAIL_TO_DEFAULT && userId) {
      try {
        console.log(`🔍 Buscando perfil de usuario con ID: ${userId}`);
        
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
          
        if (profileError) {
          console.error(`❌ Error obteniendo perfil: ${profileError.message}`);
        } else if (profileData) {
          console.log(`✅ Perfil de usuario encontrado:`, profileData);
          
          if (profileData.email && profileData.email.includes('@')) {
            businessEmail = profileData.email;
            console.log(`✉️ Correo encontrado en perfil de usuario: ${businessEmail}`);
            
            // Si el perfil tiene un nombre, usarlo como nombre del negocio
            if (profileData.full_name) {
              businessName = profileData.full_name;
            } else if (profileData.name) {
              businessName = profileData.name;
            }
          }
        }
      } catch (profileError) {
        console.error(`❌ Error consultando perfil: ${profileError.message}`);
      }
    }
    
    // ESTRATEGIA 3: Buscar en la tabla businesses y obtener el owner_id
    if (businessEmail === EMAIL_TO_DEFAULT && businessId) {
      try {
        console.log(`🔍 Buscando información del negocio con ID: ${businessId}`);
        
        // Obtener datos del negocio
        const { data: businessData, error: businessError } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', businessId)
          .single();
          
        if (businessError) {
          console.error(`❌ Error obteniendo datos del negocio: ${businessError.message}`);
        } else if (businessData) {
          console.log(`✅ Datos del negocio obtenidos:`, businessData);
          
          // Obtener nombre del negocio si está disponible
          if (businessData.name) {
            businessName = businessData.name;
          }
          
          // Verificar si hay un correo directo en el negocio
          const businessEmailFields = ['email', 'contact_email', 'notification_email', 'business_email', 'admin_email'];
          for (const field of businessEmailFields) {
            if (businessData[field] && businessData[field].includes('@')) {
              businessEmail = businessData[field];
              console.log(`✉️ Correo encontrado en el negocio (campo '${field}'): ${businessEmail}`);
              break;
            }
          }
          
          // Si aún no encontramos correo, intentar obtener el owner_id y buscar su perfil
          if (businessEmail === EMAIL_TO_DEFAULT && businessData.owner_id) {
            console.log(`🔍 Buscando perfil del propietario del negocio (${businessData.owner_id})`);
            
            // PRIMERO intentar en la tabla auth.users
            const ownerEmail = await findUserEmailById(businessData.owner_id);
            if (ownerEmail) {
              businessEmail = ownerEmail;
              console.log(`✉️ Correo del propietario encontrado en auth.users: ${businessEmail}`);
            } else {
              // Si no encontramos en auth.users, buscar en profiles
              const { data: ownerData, error: ownerError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', businessData.owner_id)
                .single();
                
              if (ownerError) {
                console.error(`❌ Error obteniendo perfil del propietario: ${ownerError.message}`);
              } else if (ownerData && ownerData.email) {
                businessEmail = ownerData.email;
                console.log(`✉️ Correo encontrado en perfil del propietario: ${businessEmail}`);
              }
            }
          }
        }
      } catch (businessError) {
        console.error(`❌ Error consultando información del negocio: ${businessError.message}`);
      }
    }
    
    // Si no se encontró un correo válido, usar el predeterminado
    if (businessEmail === EMAIL_TO_DEFAULT) {
      console.warn(`⚠️ No se encontró correo válido para la conversación: ${conversationId}`);
      console.log(`⚠️ Usando correo predeterminado: ${EMAIL_TO_DEFAULT}`);
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
 * Encuentra el email de un usuario por su ID (busca en auth.users)
 * @param {string} userId - ID del usuario
 * @returns {Promise<string|null>} Correo electrónico o null
 */
async function findUserEmailById(userId) {
  try {
    console.log(`🔍 Buscando correo para usuario con ID: ${userId} en auth.users`);
    
    // Intentar consultar directamente auth.users
    const { data, error } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error(`❌ Error consultando auth.users: ${error.message}`);
      return null;
    }
    
    if (data && data.email) {
      console.log(`✅ Correo encontrado en auth.users: ${data.email}`);
      return data.email;
    }
    
    console.log(`⚠️ No se encontró email en auth.users para usuario ${userId}`);
    return null;
  } catch (error) {
    console.error(`❌ Error en findUserEmailById: ${error.message}`);
    return null;
  }
}

/**
 * Encuentra usuarios relacionados con un negocio (busca en business_users)
 * @param {string} businessId - ID del negocio
 * @returns {Promise<Array|null>} Lista de usuarios o null
 */
async function findBusinessUsers(businessId) {
  if (!businessId) return null;
  
  try {
    console.log(`🔍 Buscando usuarios relacionados con negocio ID: ${businessId}`);
    
    // Intentar buscar en business_users primero
    const { data: businessUsers, error: buError } = await supabase
      .from('business_users')
      .select('user_id')
      .eq('business_id', businessId);
    
    if (buError) {
      console.error(`❌ Error consultando business_users: ${buError.message}`);
    } else if (businessUsers && businessUsers.length > 0) {
      console.log(`✅ Encontrados ${businessUsers.length} usuarios en business_users`);
      
      // Obtener los detalles de estos usuarios
      const userIds = businessUsers.map(bu => bu.user_id);
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email')
        .in('id', userIds);
      
      if (usersError) {
        console.error(`❌ Error obteniendo detalles de usuarios: ${usersError.message}`);
      } else if (users && users.length > 0) {
        console.log(`✅ Recuperados ${users.length} usuarios con sus correos`);
        return users;
      }
    }
    
    // Si no encontramos en business_users, buscar directamente en auth.users
    const { data: authUsers, error: authError } = await supabase
      .from('users')
      .select('id, email')
      .eq('business_id', businessId)
      .limit(5);
      
    if (authError) {
      console.error(`❌ Error consultando auth.users por business_id: ${authError.message}`);
      return null;
    }
    
    if (authUsers && authUsers.length > 0) {
      console.log(`✅ Encontrados ${authUsers.length} usuarios en auth.users con business_id=${businessId}`);
      return authUsers;
    }
    
    console.log(`⚠️ No se encontraron usuarios relacionados con el negocio ${businessId}`);
    return null;
  } catch (error) {
    console.error(`❌ Error en findBusinessUsers: ${error.message}`);
    return null;
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