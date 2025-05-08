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

// Lista de frases predeterminadas que indican que se necesita atención humana
const DEFAULT_NOTIFICATION_PHRASES = [
  "¡Perfecto! tu cita ha sido confirmada para",
  "¡Perfecto! un asesor te llamará",
  "¡Perfecto! un asesor te contactará",
  "¡Perfecto! una persona te contactará"
];

// Caché de palabras clave por negocio
const businessKeywordsCache = new Map();

// Tiempo de expiración de caché en milisegundos (5 minutos)
const CACHE_EXPIRATION = 5 * 60 * 1000;

/**
 * Carga las palabras clave personalizadas para un negocio desde la base de datos
 * @param {string} businessId - ID del negocio
 * @returns {Array} - Array de palabras clave habilitadas
 */
async function loadKeywordsForBusiness(businessId) {
  console.log(`🔍 Cargando palabras clave personalizadas para negocio: ${businessId}`);
  
  if (!businessId) {
    console.warn(`⚠️ No se proporcionó businessId, usando palabras predeterminadas`);
    return DEFAULT_NOTIFICATION_PHRASES;
  }
  
  try {
    // Debido a la importancia de tener las palabras clave actualizadas,
    // forzamos una recarga desde la base de datos en cada llamada
    console.log(`🔄 Forzando recarga de palabras clave del negocio: ${businessId}`);
    
    // Obtener palabras clave desde la base de datos
    const { data, error } = await supabase
      .from('notification_keywords')
      .select('*')
      .eq('business_id', businessId)
      .eq('enabled', true);
    
    if (error) {
      console.error(`❌ Error obteniendo palabras clave: ${error.message}`);
      console.error(`   Código: ${error.code}, Detalles: ${JSON.stringify(error)}`);
      // En caso de error, usar palabras predeterminadas
      return DEFAULT_NOTIFICATION_PHRASES;
    }
    
    // Imprimir todos los datos recibidos para diagnóstico
    console.log(`📊 Datos recibidos de notification_keywords: ${JSON.stringify(data, null, 2)}`);
    
    // Si no hay palabras clave personalizadas, usar las predeterminadas
    if (!data || data.length === 0) {
      console.log(`ℹ️ No se encontraron palabras clave personalizadas para negocio ${businessId}, usando predeterminadas`);
      
      // Almacenar en caché las palabras predeterminadas
      businessKeywordsCache.set(businessId, {
        keywords: DEFAULT_NOTIFICATION_PHRASES,
        timestamp: Date.now()
      });
      
      return DEFAULT_NOTIFICATION_PHRASES;
    }
    
    // Extraer las palabras clave y guardar en caché
    const keywords = data.map(item => item.keyword);
    console.log(`✅ Palabras clave personalizadas cargadas (${keywords.length}): ${keywords.join(', ')}`);
    
    // Almacenar en caché
    businessKeywordsCache.set(businessId, {
      keywords,
      timestamp: Date.now()
    });
    
    return keywords;
  } catch (error) {
    console.error(`❌ Error inesperado cargando palabras clave: ${error.message}`);
    console.error(error.stack);
    return DEFAULT_NOTIFICATION_PHRASES;
  }
}

/**
 * Limpia la caché de palabras clave para un negocio específico o para todos
 * @param {string} businessId - ID del negocio (opcional)
 */
function clearKeywordsCache(businessId = null) {
  if (businessId) {
    businessKeywordsCache.delete(businessId);
    console.log(`🧹 Caché de palabras clave limpiada para negocio: ${businessId}`);
  } else {
    businessKeywordsCache.clear();
    console.log(`🧹 Caché de palabras clave limpiada para todos los negocios`);
  }
}

/**
 * Verifica si un mensaje contiene alguna de las frases que indican necesidad de atención
 * @param {string} message - El mensaje a revisar
 * @param {string} businessId - ID del negocio (opcional)
 * @returns {Promise<boolean>} - True si el mensaje contiene alguna de las frases de notificación
 */
async function checkForNotificationPhrases(message, businessId = null) {
  if (!message) return false;
  
  // Normalizar el mensaje (convertir a minúsculas, eliminar espacios extras)
  const normalizedMessage = message.toLowerCase().trim();
  
  console.log(`🔍 Analizando mensaje para notificación: "${normalizedMessage.substring(0, 60)}..."`);
  console.log(`🏢 Business ID: ${businessId || 'No disponible'}`);
  
  // Determinar qué palabras clave usar (personalizadas o predeterminadas)
  let phrases = DEFAULT_NOTIFICATION_PHRASES;
  
  if (businessId) {
    // Cargar palabras clave personalizadas
    phrases = await loadKeywordsForBusiness(businessId);
    console.log(`🔑 Palabras clave cargadas para negocio ${businessId}: ${phrases.join(', ')}`);
  } else {
    console.log(`⚠️ Sin businessId, usando palabras clave predeterminadas: ${phrases.join(', ')}`);
  }
  
  // Verificar cada frase
  for (const phrase of phrases) {
    const normalizedPhrase = phrase.toLowerCase().trim();
    
    console.log(`🔎 Verificando si el mensaje contiene: "${normalizedPhrase}"`);
    
    if (normalizedMessage.includes(normalizedPhrase)) {
      console.log(`✅ COINCIDENCIA ENCONTRADA: "${normalizedPhrase}" en "${normalizedMessage.substring(0, 60)}..."`);
      
      // Intentar actualizar el estado del cliente a importante
      try {
        if (businessId) {
          // Obtener ID de la conversación si solo tenemos el mensaje
          const { data: msgData, error: msgError } = await supabase
            .from('messages')
            .select('conversation_id')
            .eq('content', message)
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (!msgError && msgData && msgData.length > 0) {
            const conversationId = msgData[0].conversation_id;
            
            // Actualizar el estado del cliente en la conversación
            const { error: updateError } = await supabase
              .from('conversations')
              .update({ 
                is_important: true, // Usar is_important en lugar de status
                notification_sent: true,
                notification_timestamp: new Date().toISOString(),
                last_message: "⚠️ REQUIERE ATENCIÓN - Notificación enviada",
                updated_at: new Date().toISOString()
              })
              .eq('id', conversationId);
            
            if (updateError) {
              console.error(`❌ Error al actualizar estado de conversación: ${updateError.message}`);
              
              // Intentar actualizar solo is_important si falló la actualización completa
              try {
                const { error: importantError } = await supabase
                  .from('conversations')
                  .update({ is_important: true })
                  .eq('id', conversationId);
                
                if (importantError) {
                  console.error(`❌ Error al actualizar is_important: ${importantError.message}`);
                } else {
                  console.log(`✅ Campo is_important actualizado correctamente`);
                }
              } catch (fieldError) {
                console.error(`❌ Error actualizando campo individual: ${fieldError.message}`);
              }
            } else {
              console.log(`✅ Estado de conversación actualizado a 'importante'`);
            }
          }
        }
      } catch (updateError) {
        console.error(`❌ Error intentando actualizar estado: ${updateError}`);
      }
      
      return true;
    }
  }
  
  console.log(`❌ No se encontraron coincidencias de palabras clave en el mensaje`);
  return false;
}

/**
 * Procesa un mensaje para determinar si se debe enviar una notificación
 * @param {string} message - El mensaje a procesar
 * @param {string} conversationId - ID de la conversación
 * @param {string} phoneNumber - Número de teléfono del cliente (opcional)
 * @param {string} forcedBusinessId - ID del negocio (opcional, para forzar un negocio específico)
 * @returns {Object} - Resultado del procesamiento
 */
async function processMessageForNotification(message, conversationId, phoneNumber = null, forcedBusinessId = null) {
  try {
    console.log(`
=== INICIO PROCESAMIENTO DE NOTIFICACIÓN ===
📱 Conversación: ${conversationId}
📱 Teléfono (si disponible): ${phoneNumber || 'N/A'}
💬 Mensaje: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}
`);

    // Si se proporciona un businessId forzado, usarlo directamente
    let businessId = forcedBusinessId;
    
    // Si no hay businessId forzado, intentar obtenerlo de la conversación
    if (!businessId) {
      // Obtener información de la conversación desde Supabase
      let clientPhone = phoneNumber;
      
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
        console.warn(`⚠️ No se pudo obtener businessId para la conversación ${conversationId}. Buscando por teléfono...`);
        
        // Intento alternativo: buscar businessId por número de teléfono en otras conversaciones
        if (clientPhone) {
          try {
            const { data: otherConversations, error: otherError } = await supabase
              .from('conversations')
              .select('business_id')
              .eq('user_id', clientPhone)
              .not('business_id', 'is', null)
              .order('created_at', { ascending: false })
              .limit(1);
            
            if (!otherError && otherConversations && otherConversations.length > 0) {
              businessId = otherConversations[0].business_id;
              console.log(`✅ BusinessId encontrado en otra conversación del mismo cliente: ${businessId}`);
            }
          } catch (err) {
            console.error(`❌ Error buscando otras conversaciones: ${err.message}`);
          }
        }
      }
    } else {
      console.log(`💼 Usando businessId forzado: ${businessId}`);
    }
    
    // Diagnóstico: consultar directamente la tabla notification_keywords por este businessId
    if (businessId) {
      try {
        console.log(`🔍 Consultando directamente table notification_keywords para businessId=${businessId}`);
        const { data: keywordsData, error: keywordsError } = await supabase
          .from('notification_keywords')
          .select('*')
          .eq('business_id', businessId);
        
        if (keywordsError) {
          console.error(`❌ Error consultando tabla notification_keywords: ${keywordsError.message}`);
        } else {
          console.log(`✅ Encontradas ${keywordsData?.length || 0} palabras clave en la tabla para este negocio.`);
          if (keywordsData && keywordsData.length > 0) {
            const keywords = keywordsData.map(k => k.keyword).join(', ');
            console.log(`📋 Palabras clave disponibles: ${keywords}`);
          }
        }
      } catch (kwErr) {
        console.error(`❌ Error inesperado consultando keywords: ${kwErr.message}`);
      }
    }
    
    // Verificar si el mensaje contiene alguna frase que requiera notificación
    // Ahora pasamos el businessId para obtener palabras clave personalizadas
    const requiresNotification = await checkForNotificationPhrases(message, businessId);
    
    if (!requiresNotification) {
      console.log('❌ No se requiere notificación. Finalizando procesamiento.');
      return { 
        requiresNotification: false,
        notificationSent: false 
      };
    }
    
    console.log(`🔔 NOTIFICACIÓN REQUERIDA para conversación: ${conversationId}`);
    
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
      phoneNumber,
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
 * Obtiene los últimos mensajes de una conversación
 * @param {string} conversationId - ID de la conversación
 * @param {number} limit - Número máximo de mensajes a obtener
 * @returns {Array} - Lista de mensajes ordenados cronológicamente
 */
async function getLastMessages(conversationId, limit = 20) {
  try {
    console.log(`🔍 Obteniendo últimos ${limit} mensajes de conversación: ${conversationId}`);
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error(`❌ Error obteniendo mensajes: ${error.message}`);
      return [];
    }
    
    // Invertir para tener orden cronológico (más antiguos primero)
    return data.reverse();
  } catch (error) {
    console.error(`❌ Error consultando mensajes: ${error.message}`);
    return [];
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
    
    // Obtener los últimos 20 mensajes de la conversación
    const lastMessages = await getLastMessages(conversationId, 20);
    console.log(`✅ Obtenidos ${lastMessages.length} mensajes para incluir en la notificación`);
    
    // Formatear el mensaje para el correo
    const formattedPhone = phoneNumber ? phoneNumber : 'No disponible';
    const timestamp = new Date().toLocaleString('es-ES', { 
      timeZone: 'America/Mexico_City'
    });
    
    // Generar HTML con el historial de mensajes
    let messagesHtml = '';
    
    if (lastMessages && lastMessages.length > 0) {
      messagesHtml += `<h3>Historial de la conversación</h3>`;
      messagesHtml += `<div style="max-height: 400px; overflow-y: auto; border: 1px solid #ccc; padding: 10px; margin: 10px 0;">`;
      
      for (const msg of lastMessages) {
        const isBot = msg.sender_type === 'bot';
        const date = new Date(msg.created_at).toLocaleString('es-ES', {
          timeZone: 'America/Mexico_City'
        });
        
        messagesHtml += `
          <div style="margin-bottom: 10px; ${isBot ? 'text-align: right;' : ''}">
            <div style="
              display: inline-block;
              max-width: 80%;
              padding: 8px 12px;
              border-radius: 8px;
              background-color: ${isBot ? '#DCF8C6' : '#F1F0F0'};
              border: 1px solid ${isBot ? '#C5E1A5' : '#E0E0E0'};
            ">
              <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
                <strong>${isBot ? 'Bot' : 'Cliente'}</strong> - ${date}
              </div>
              <div style="word-break: break-word;">
                ${msg.content.replace(/\n/g, '<br>')}
              </div>
            </div>
          </div>
        `;
      }
      
      messagesHtml += `</div>`;
    } else {
      messagesHtml = `<p>No hay historial de mensajes disponible para esta conversación.</p>`;
    }
    
    // Obtener información adicional sobre la conversación
    let extraInfo = '';
    try {
      const { data: convInfo, error: convError } = await supabase
        .from('conversations')
        .select('created_at, last_message_time, last_message')
        .eq('id', conversationId)
        .single();
      
      if (!convError && convInfo) {
        const createdAt = new Date(convInfo.created_at).toLocaleString('es-ES', {
          timeZone: 'America/Mexico_City'
        });
        
        const lastTime = convInfo.last_message_time ? 
          new Date(convInfo.last_message_time).toLocaleString('es-ES', {
            timeZone: 'America/Mexico_City'
          }) : 'No disponible';
        
        extraInfo = `
          <p><strong>Conversación iniciada:</strong> ${createdAt}</p>
          <p><strong>Último mensaje:</strong> ${lastTime}</p>
        `;
      }
    } catch (infoError) {
      console.warn(`⚠️ No se pudo obtener información adicional de la conversación: ${infoError.message}`);
    }
    
    // Generar el asunto del correo
    let emailSubject = `🔔 Notificación importante de cliente WhatsApp - ${businessName}`;
    
    // Personalizar para Hernán
    if (businessId === '2d385aa5-40e0-4ec9-9360-19281bc605e4') {
      emailSubject = `🔔 SEAT ${businessName}: Cliente WhatsApp requiere atención`;
    }
    
    // Generar HTML completo del correo
    const emailHtml = `
      <h2>🤖 Notificación de Bot de WhatsApp - ${businessName}</h2>
      <p><strong>Se requiere atención humana para un cliente.</strong></p>
      <hr>
      <p><strong>📱 Número de teléfono:</strong> ${formattedPhone}</p>
      <p><strong>🆔 ID de conversación:</strong> ${conversationId}</p>
      <p><strong>🏢 ID de negocio:</strong> ${businessId || 'No disponible'}</p>
      <p><strong>⏰ Fecha y hora:</strong> ${timestamp}</p>
      <p><strong>💬 Mensaje del bot que generó la alerta:</strong></p>
      <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; margin: 10px 0; border: 2px solid #FF0000;">
        ${message.replace(/\n/g, '<br>')}
      </div>
      ${messagesHtml}
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
    
    // Actualizar el estado de la conversación a importante
    try {
      console.log(`🔍 Actualizando conversación ${conversationId} como importante después de enviar correo...`);
      
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ 
          is_important: true,
          notification_sent: true,
          notification_timestamp: new Date().toISOString(),
          last_message: "⚠️ REQUIERE ATENCIÓN - Notificación enviada"
        })
        .eq('id', conversationId);
      
      if (updateError) {
        console.error(`❌ Error actualizando conversación como importante: ${updateError.message}`);
        
        // Intentar actualizar solo el campo is_important
        try {
          const { error: importantError } = await supabase
            .from('conversations')
            .update({ is_important: true })
            .eq('id', conversationId);
          
          if (importantError) {
            console.error(`❌ Error al actualizar is_important: ${importantError.message}`);
          } else {
            console.log(`✅ Campo is_important actualizado correctamente`);
          }
        } catch (fieldError) {
          console.error(`❌ Error actualizando campo individual: ${fieldError.message}`);
        }
      } else {
        console.log(`✅ Conversación ${conversationId} marcada como importante exitosamente`);
      }
    } catch (updateError) {
      console.error(`❌ Error al actualizar estado de la conversación: ${updateError.message}`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error enviando notificación por correo: ${error.message}`);
    return false;
  }
}

/**
 * Repara los mensajes en la base de datos corrigiendo los sender_type incorrectos.
 * Esta función analiza el contenido para detectar mensajes que probablemente sean del bot/dashboard pero tienen sender_type='user'.
 * @returns {Promise<Object>} Resultado de la operación con estadísticas
 */
async function fixMessagesInDatabase() {
  if (!supabase) {
    console.error('❌ No hay conexión a Supabase, no se pueden reparar los mensajes');
    return { success: false, error: 'No hay conexión a Supabase' };
  }

  try {
    console.log('🔧 Iniciando reparación de mensajes en la base de datos...');
    
    // 1. Obtener mensajes que tienen sender_type='user'
    const { data: suspectMessages, error: selectError } = await supabase
      .from('messages')
      .select('*')
      .eq('sender_type', 'user');
    
    if (selectError) {
      console.error(`❌ Error al consultar mensajes: ${selectError.message}`);
      return { success: false, error: selectError.message };
    }
    
    console.log(`ℹ️ Encontrados ${suspectMessages.length} mensajes con sender_type='user' para analizar`);
    
    // Contador de mensajes
    let correctedCount = 0;
    let analyzedCount = 0;
    
    // 2. Patrones exactos que indican que un mensaje es del bot/dashboard
    const botPatterns = [
      { pattern: "¡Perfecto!", weight: 10 },
      { pattern: "Perfecto!", weight: 10 },
      { pattern: "CUPRA Master", weight: 10 },
      { pattern: "Hola soy Hernán", weight: 10 },
      { pattern: "un asesor te llamará", weight: 10 },
      { pattern: "un asesor te contactará", weight: 10 },
      { pattern: "una persona te contactará", weight: 10 },
      { pattern: "cita ha sido confirmada", weight: 10 },
      { pattern: "CUPRA", weight: 5 },
      { pattern: "asesor te llamará", weight: 8 },
      { pattern: "te llamará a las", weight: 8 }
    ];
    
    // 3. Analizar y corregir mensajes sospechosos
    for (const msg of suspectMessages) {
      analyzedCount++;
      
      // Skip análisis si no hay contenido
      if (!msg.content) {
        console.log(`⏩ Saltando mensaje sin contenido: ${msg.id.substring(0, 8)}`);
        continue;
      }
      
      // Calculando peso total para decidir si es mensaje del bot
      let score = 0;
      let matchedPatterns = [];
      
      for (const { pattern, weight } of botPatterns) {
        if (msg.content.includes(pattern)) {
          score += weight;
          matchedPatterns.push(pattern);
        }
      }
      
      // Debug de cada mensaje analizado
      console.log(`
📝 Analizando mensaje: ID=${msg.id.substring(0, 8)}
   Contenido: "${msg.content.substring(0, 60)}${msg.content.length > 60 ? '...' : ''}"
   Patrones detectados: ${matchedPatterns.length > 0 ? matchedPatterns.join(', ') : 'ninguno'}
   Puntuación: ${score}/10
      `);
      
      // Si la puntuación es 5 o mayor, consideramos que es un mensaje del bot
      if (score >= 5) {
        console.log(`🔄 Corrigiendo mensaje de ID ${msg.id.substring(0, 8)}`);
        
        // Actualizar el mensaje
        const { error: updateError } = await supabase
          .from('messages')
          .update({ 
            sender_type: 'bot',
            is_from_business: true 
          })
          .eq('id', msg.id);
        
        if (updateError) {
          console.error(`❌ Error al actualizar mensaje ${msg.id}: ${updateError.message}`);
        } else {
          correctedCount++;
          console.log(`✅ Mensaje corregido: ${msg.id.substring(0, 8)}`);
        }
      }
    }
    
    console.log(`
✅ Reparación completada:
   - Mensajes analizados: ${analyzedCount}
   - Mensajes corregidos: ${correctedCount}
   - Porcentaje corregido: ${analyzedCount > 0 ? (correctedCount / analyzedCount * 100).toFixed(2) : 0}%
    `);
    
    return { 
      success: true, 
      total: suspectMessages.length,
      analyzed: analyzedCount,
      corrected: correctedCount 
    };
  } catch (error) {
    console.error(`❌ Error en la reparación de mensajes: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Repara los mensajes en la base de datos a partir de una muestra de texto HTML.
 * Esta función toma una muestra de mensajes y busca en la base de datos para corregirlos.
 * @param {string} sampleMessages - Muestra de mensajes en texto plano con formato "Cliente - HH:MM\nContenido"
 * @returns {Promise<Object>} Resultado de la operación con estadísticas
 */
async function fixMessagesFromSample(sampleMessages) {
  if (!supabase) {
    console.error('❌ No hay conexión a Supabase, no se pueden reparar los mensajes');
    return { success: false, error: 'No hay conexión a Supabase' };
  }

  try {
    console.log('🔧 Iniciando reparación de mensajes a partir de muestra...');
    
    // Parsear la muestra de mensajes
    const messageLines = sampleMessages.split('\n');
    const botMessages = [];
    
    // Patrones que indican que un mensaje es del bot
    const botPatterns = [
      "¡Perfecto!",
      "Perfecto!",
      "CUPRA Master",
      "Hola soy Hernán",
      "un asesor te llamará",
      "asesor te llamará",
      "te llamará a las"
    ];
    
    // Analizar las líneas y extraer mensajes del bot
    for (let i = 0; i < messageLines.length; i++) {
      const line = messageLines[i];
      // Si la línea comienza con "Cliente -" y la siguiente línea tiene contenido
      if (line.startsWith("Cliente -") && i + 1 < messageLines.length) {
        const content = messageLines[i + 1];
        const shouldBeBot = botPatterns.some(pattern => content.includes(pattern));
        
        if (shouldBeBot) {
          botMessages.push({
            timestamp: line.split('-')[1].trim(),
            content: content.trim()
          });
          console.log(`🔍 Detectado mensaje del bot: "${content.substring(0, 40)}..." (${line})`);
        }
      }
    }
    
    console.log(`ℹ️ Encontrados ${botMessages.length} mensajes del bot en la muestra que están incorrectamente etiquetados como del cliente`);
    
    // Contador de mensajes
    let correctedCount = 0;
    
    // Para cada mensaje del bot, buscar en la base de datos y corregir
    for (const botMsg of botMessages) {
      console.log(`🔍 Buscando mensaje: "${botMsg.content.substring(0, 40)}..."`);
      
      // Buscar el mensaje en la base de datos por contenido
      const { data: matchingMessages, error: searchError } = await supabase
        .from('messages')
        .select('*')
        .eq('sender_type', 'user')  // Solo los que están incorrectamente como 'user'
        .ilike('content', botMsg.content);  // Buscar por contenido
      
      if (searchError) {
        console.error(`❌ Error al buscar mensaje: ${searchError.message}`);
        continue;
      }
      
      if (!matchingMessages || matchingMessages.length === 0) {
        console.log(`⚠️ No se encontró coincidencia exacta para: "${botMsg.content.substring(0, 40)}..."`);
        
        // Si no hay coincidencia exacta, buscar mensajes similares
        const { data: similarMessages, error: similarError } = await supabase
          .from('messages')
          .select('*')
          .eq('sender_type', 'user')
          .filter('content', 'ilike', `%${botMsg.content.substring(0, 20)}%`);
        
        if (similarError) {
          console.error(`❌ Error al buscar mensajes similares: ${similarError.message}`);
          continue;
        }
        
        if (similarMessages && similarMessages.length > 0) {
          console.log(`ℹ️ Encontrados ${similarMessages.length} mensajes similares:`);
          
          for (const msg of similarMessages) {
            console.log(`   - ID: ${msg.id.substring(0, 8)}, Contenido: "${msg.content.substring(0, 40)}..."`);
            
            // Corregir el mensaje
            const { error: updateError } = await supabase
              .from('messages')
              .update({ 
                sender_type: 'bot',
                is_from_business: true 
              })
              .eq('id', msg.id);
            
            if (updateError) {
              console.error(`❌ Error al actualizar mensaje ${msg.id}: ${updateError.message}`);
            } else {
              correctedCount++;
              console.log(`✅ Mensaje corregido: ${msg.id.substring(0, 8)}`);
            }
          }
        } else {
          console.log(`⚠️ No se encontraron mensajes similares`);
        }
      } else {
        console.log(`ℹ️ Encontrados ${matchingMessages.length} mensajes coincidentes:`);
        
        for (const msg of matchingMessages) {
          console.log(`   - ID: ${msg.id.substring(0, 8)}, Contenido exacto: "${msg.content.substring(0, 40)}..."`);
          
          // Corregir el mensaje
          const { error: updateError } = await supabase
            .from('messages')
            .update({ 
              sender_type: 'bot',
              is_from_business: true 
            })
            .eq('id', msg.id);
          
          if (updateError) {
            console.error(`❌ Error al actualizar mensaje ${msg.id}: ${updateError.message}`);
          } else {
            correctedCount++;
            console.log(`✅ Mensaje corregido: ${msg.id.substring(0, 8)}`);
          }
        }
      }
    }
    
    console.log(`
✅ Reparación completada:
   - Mensajes del bot detectados en muestra: ${botMessages.length}
   - Mensajes corregidos en la base de datos: ${correctedCount}
    `);
    
    return { 
      success: true, 
      sampleSize: botMessages.length,
      corrected: correctedCount 
    };
  } catch (error) {
    console.error(`❌ Error en la reparación de mensajes: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Ejemplo de uso con la muestra proporcionada por el usuario
const sampleData = `Cliente - 02:38
Mejor a las 3
Cliente - 02:38
¡Perfecto! tu cita ha sido confirmada para hoy a las 3 para ver el CUPRA León. Si necesitas algo más, no dudes en decírmelo.
Cliente - 03:57
mejor a la 1
Cliente - 03:57
Hola soy Hernán CUPRA Master de San Ángel, ¿con quién tengo el gusto?
Cliente - 03:58
con graciela quiero que me marque un asesor a las 5
Cliente - 03:58
¡Perfecto! Un asesor te llamará a las 5.
Cliente - 04:06
mejor a las 11
Cliente - 04:06
¡Perfecto! Un asesor te llamará a las 11.
Cliente - 04:10
mejor a las 7
Cliente - 04:10
¡Perfecto! Un asesor te llamará a las 7.
Cliente - 04:28
mejor a las 6
Cliente - 04:28
¡Hola soy Hernán CUPRA Master de San Ángel, con quién tengo el gusto?
Cliente - 04:28
juna quiero que me llamen a las 7
Cliente - 04:29
¡Perfecto! un asesor te llamará a las 7.
Cliente - 04:36
mejor a las 6
Cliente - 04:36
¡Perfecto! un asesor te llamará a las 6.
Cliente - 04:45
mejor a las 4
Cliente - 04:45
¡Hola soy Hernán CUPRA Master de San Ángel, con quién tengo el gusto?
Cliente - 04:45
gracilea quiero que me llame un asseor a las 6`;

// Si este archivo se ejecuta directamente, reparar los mensajes
if (require.main === module) {
  console.log('🔧 Ejecutando script de reparación de mensajes...');
  
  // Usar la muestra proporcionada por el usuario
  fixMessagesFromSample(sampleData)
    .then(result => {
      console.log('Resultado de la reparación desde muestra:', result);
      
      // Si aún quieres ejecutar el método general también
      return fixMessagesInDatabase();
    })
    .then(result => {
      console.log('Resultado de la reparación general:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Error en el script de reparación:', error);
      process.exit(1);
    });
}

// Exportar funciones
module.exports = {
  processMessageForNotification,
  checkForNotificationPhrases,
  loadKeywordsForBusiness,
  clearKeywordsCache,
  sendBusinessNotification,
  getLastMessages,
  fixMessagesInDatabase,
  fixMessagesFromSample,
  DEFAULT_NOTIFICATION_PHRASES
};

// Log de inicialización para saber que el módulo se cargó correctamente
console.log(`
🔔 Módulo de notificaciones inicializado
📧 Remitente: ${EMAIL_USER}
📧 Destinatario por defecto: ${EMAIL_TO_DEFAULT}
🔑 Contraseña configurada: ${EMAIL_APP_PASSWORD ? '✅ SÍ' : '❌ NO'}
🔍 Modo diagnóstico: ACTIVADO
📝 Frases predeterminadas: ${DEFAULT_NOTIFICATION_PHRASES.length}
`);

// Limpiar la caché al inicio
clearKeywordsCache();