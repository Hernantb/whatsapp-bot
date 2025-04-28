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
      messagesHtml = `
        <h3>📝 Historial de mensajes recientes:</h3>
        <div style="background-color: #f9f9f9; padding: 10px; border-radius: 5px; margin: 10px 0; max-height: 400px; overflow-y: auto;">
      `;
      
      // Log para depuración
      console.log('🔍 CLASIFICACIÓN ESTRICTA DE MENSAJES EN EMAIL:');
      console.log(`📱 Teléfono del cliente: ${phoneNumber}`);
      console.log(`🏢 ID del negocio: ${businessId}`);
      
      // Ordenar mensajes cronológicamente (más viejos primero)
      lastMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      
      lastMessages.forEach(msg => {
        // Log detallado de cada mensaje para depuración
        console.log(`
📩 MENSAJE (ID: ${msg.id?.substring(0,8) || 'N/A'}):
   - sender_type: "${msg.sender_type || 'undefined'}"
   - Contenido: "${msg.content?.substring(0,40)}..."
        `);
        
        // IMPORTANTE: USAR DIRECTAMENTE EL CAMPO SENDER_TYPE COMO CRITERIO ABSOLUTO
        // Cualquier mensaje con sender_type 'user' está a la izquierda
        // Cualquier otro tipo (bot, agent, undefined, etc) está a la derecha
        const isFromClient = msg.sender_type === 'user';
        
        // Determinar el nombre a mostrar según el sender_type
        const senderLabel = isFromClient 
          ? 'Cliente' 
          : (msg.sender_type === 'bot' 
              ? 'Bot' 
              : msg.sender_type === 'agent' 
                ? 'Asesor' 
                : 'Sistema');
        
        // Log para confirmar la posición
        console.log(`   → ${isFromClient ? 'IZQUIERDA (Cliente)' : 'DERECHA (Sistema)'} - ${senderLabel}`);
        
        // Formatear la hora del mensaje
        const msgTime = new Date(msg.created_at).toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit'
        });
        
        // Marcar específicamente si es el mensaje que activó la notificación
        const isTriggerMessage = msg.content === message;
        
        // Estilos para los diferentes tipos de mensajes
        if (isFromClient) {
          // CLIENTE - IZQUIERDA (fondo blanco)
          messagesHtml += `
            <div style="overflow: hidden; margin-bottom: 12px;">
              <div style="background-color: #FFFFFF; border: 1px solid #e0e0e0; padding: 8px; border-radius: 10px; margin: 5px 0; display: inline-block; max-width: 80%; text-align: left; float: left; clear: both; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                <div style="font-size: 0.8em; color: #666; margin-bottom: 4px;"><strong>Cliente</strong> - ${msgTime}</div>
                <div style="color: #333;">${msg.content.replace(/\n/g, '<br>')}</div>
              </div>
            </div>
          `;
        } else {
          // SISTEMA (BOT/DASHBOARD) - DERECHA (fondo oscuro)
          messagesHtml += `
            <div style="overflow: hidden; margin-bottom: 12px;">
              <div style="background-color: #2d2d3d; color: #FFFFFF; padding: 8px; border-radius: 10px; margin: 5px 0; display: inline-block; max-width: 80%; text-align: right; float: right; clear: both; box-shadow: 0 1px 2px rgba(0,0,0,0.2);">
                <div style="font-size: 0.8em; color: #FFFFFF; margin-bottom: 4px;"><strong>${senderLabel}</strong> - ${msgTime}</div>
                <div style="color: #FFFFFF;">${msg.content.replace(/\n/g, '<br>')}</div>
                ${isTriggerMessage ? '<div style="color: #FFD0D0; font-weight: bold; margin-top: 5px; font-size: 0.85em;">⚠️ MENSAJE QUE ACTIVÓ LA NOTIFICACIÓN</div>' : ''}
              </div>
            </div>
          `;
        }
      });
      
      messagesHtml += `
        <div style="clear: both;"></div>
        </div>
      `;
    }
    
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

module.exports = {
  checkForNotificationPhrases,
  processMessageForNotification,
  sendBusinessNotification,
  fixMessagesInDatabase,
  fixMessagesFromSample
}; 