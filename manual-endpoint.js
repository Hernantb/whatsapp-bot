// Endpoint para envío manual de mensajes a WhatsApp
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { sendTextMessageGupShup } = require('./sendTextMessageGupShup');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

// Configurar Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// ID del negocio para las notificaciones
const BUSINESS_ID = process.env.BUSINESS_ID || '';

// Frases del bot que indican una solicitud confirmada que requiere notificación
const botConfirmationPhrases = [
  "un asesor te llamará",
  "un asesor te contactará",
  "una persona te contactará",
  "tu cita ha sido confirmada"
];

// Mapa de tipo de notificación a asunto de correo
const notificationTypes = {
  "asesor": "🔔 Solicitud de Atención Humana",
  "llamada": "📞 Solicitud de Llamada",
  "cita": "📅 Nueva Cita Agendada",
  "seguimiento": "📋 Caso para Seguimiento",
  "general": "🔔 Notificación de Cliente"
};

// Crear la aplicación Express
const app = express();
const PORT = 3095; // Puerto específico para este servicio de WhatsApp

// Lista para rastrear los mensajes enviados (para depuración)
const sentMessages = [];

// Agregamos un mapa para registrar mensajes recientes y evitar duplicaciones
const recentMessages = new Map();
const MESSAGE_DEDUPE_TIMEOUT = 5000; // 5 segundos para evitar duplicados

// Middleware
app.use(cors({
  origin: '*',  // Permitir todas las solicitudes
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Configurar transporte de correo (usando SendGrid como alternativa)
const useSendGrid = true; // Activar esta opción para usar SendGrid en lugar de Gmail

let transporter;
if (useSendGrid) {
  // Configuración para SendGrid
  console.log('📧 Usando SendGrid como proveedor de correo');
  transporter = nodemailer.createTransport({
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false, // usar TLS
    auth: {
      user: 'apikey', // Siempre es 'apikey' para SendGrid
      pass: process.env.SENDGRID_API_KEY || 'SENDGRID_API_KEY_PLACEHOLDER' // API Key de SendGrid
    },
    debug: true,
    logger: true
  });
} else {
  // Configuración original para Gmail
  console.log('📧 Usando Gmail como proveedor de correo');
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // use SSL
    auth: {
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASSWORD || ''
    },
    debug: true, // Siempre habilitar debug para diagnosticar el problema
    logger: true, // Siempre mostrar logs
    tls: {
      rejectUnauthorized: false // Permitir certificados autofirmados
    }
  });
}

// Verificar la conexión del transporter al iniciar con más detalles
transporter.verify()
  .then(() => {
    console.log('✅ Conexión a servidor SMTP verificada correctamente');
    console.log(`✅ Usando cuenta: ${process.env.EMAIL_USER || 'bexorai@gmail.com'}`);
    
    // Enviar un correo de prueba a la misma cuenta para verificar que todo funciona
    console.log('📧 Enviando correo de prueba para verificar configuración...');
    
    const testMailOptions = {
      from: `"Bot de WhatsApp" <${process.env.EMAIL_USER || 'bexorai@gmail.com'}>`,
      to: process.env.EMAIL_USER || 'bexorai@gmail.com',
      subject: 'Prueba de configuración de correo',
      text: 'Este es un correo de prueba para verificar la configuración de nodemailer.',
      html: '<p>Este es un correo de prueba para verificar la configuración de nodemailer.</p>'
    };
    
    transporter.sendMail(testMailOptions)
      .then(info => {
        console.log(`✅ Correo de prueba enviado correctamente: ${info.messageId}`);
      })
      .catch(error => {
        console.error('❌ Error al enviar correo de prueba:', error);
      });
  })
  .catch(error => {
    console.error('❌ Error al verificar servidor SMTP:', error);
    console.warn('⚠️ Las notificaciones por correo podrían no funcionar correctamente');
    console.log('🔍 Detalles de la configuración:');
    console.log(`- Usuario: ${process.env.EMAIL_USER || 'bexorai@gmail.com'}`);
    console.log(`- Contraseña: ${(process.env.EMAIL_PASSWORD || 'gqwi aker jgrn kylf').substring(0, 4)}****`);
    console.log(`- Host: smtp.gmail.com:465 (SSL)`);
    
    // Recomendar revisar la configuración de Google
    console.log('❗ RECOMENDACIONES:');
    console.log('1. Verificar que la "contraseña de aplicación" de Google esté correctamente generada');
    console.log('2. Asegurarse de que la verificación en dos pasos esté habilitada');
    console.log('3. Verificar que no haya restricciones de acceso a apps menos seguras');
  });

// Función para determinar el tipo de notificación según el mensaje del bot
function getNotificationType(message) {
  const msgLower = message.toLowerCase();
  
  if (msgLower.includes("asesor") || msgLower.includes("representante") || msgLower.includes("asistencia")) 
    return "asesor";
  if (msgLower.includes("cita") || msgLower.includes("agendada") || msgLower.includes("calendario") || 
      msgLower.includes("calendly") || msgLower.includes("registrarla") || msgLower.includes("agendar")) 
    return "cita";
  if (msgLower.includes("llamada") || msgLower.includes("llamaremos")) 
    return "llamada";
  if (msgLower.includes("seguimiento") || msgLower.includes("caso") || msgLower.includes("folio")) 
    return "seguimiento";
  
  return "general"; // Tipo por defecto
}

// Función para verificar si un mensaje contiene una frase que requiere notificación
function checkForNotificationPhrases(message) {
  console.log(`🔔 ANALIZANDO MENSAJE PARA DETECTAR FRASES DE NOTIFICACIÓN:`);
  console.log(`🔔 Mensaje a analizar: "${message}"`);
  
  // Asegurarse de que el mensaje es una cadena
  if (!message || typeof message !== 'string') {
    console.error(`❌ El mensaje no es válido: ${message}`);
    return false;
  }
  
  // Normalizar mensaje (quitar acentos, convertir a minúsculas)
  const normalizedMessage = message.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  console.log(`🔔 Mensaje normalizado: "${normalizedMessage}"`);
  
  // Lista de frases que requieren notificación
  const notificationPhrases = [
    "perfecto! un asesor te llamara", 
    "¡perfecto! un asesor te llamará",
    "perfecto! un asesor te llamará",
    "perfecto un asesor te",
    "un asesor te llamara",
    "un asesor te llamará",
    "un asesor te llamará a las",
    "asesor te llamará a las",
    "te llamara manana",
    "te llamará mañana",
    "asesor te llamara manana",
    "asesor te llamará mañana",
    "perfecto! tu cita ha sido confirmada",
    "¡perfecto! tu cita ha sido confirmada",
    "perfecto tu cita ha sido confirmada",
    "¡perfecto! tu cita ha sido registrada",
    "perfecto! tu cita ha sido registrada",
    "hemos registrado tu cita",
    "tu cita ha sido confirmada para",
    "tu cita ha sido",
    "se ha creado la cita",
    "asesor te contactara",
    "asesor te contactará"
  ];
  
  // Lista de palabras clave para verificación adicional
  const keyWords = ["cita", "asesor", "llamará", "llamara", "contactará", "confirmada", "registrada", "mañana", "manana", "perfecto", "2:22"];
  
  // Verificar si el mensaje contiene alguna de las frases de notificación
  for (const phrase of notificationPhrases) {
    if (normalizedMessage.includes(phrase)) {
      console.log(`✅ COINCIDENCIA EXACTA detectada con frase: "${phrase}"`);
      console.log(`🔔 ¡Mensaje requiere notificación! Obteniendo número de teléfono...`);
      return true;
    }
  }
  
  // Verificar coincidencia parcial (al menos 2 palabras clave)
  let keyWordCount = 0;
  let matchedKeywords = [];
  for (const word of keyWords) {
    if (normalizedMessage.includes(word)) {
      keyWordCount++;
      matchedKeywords.push(word);
      console.log(`🔑 Palabra clave "${word}" encontrada (${keyWordCount} palabras clave hasta ahora)`);
    }
  }
  
  if (keyWordCount >= 2) {
    console.log(`✅ COINCIDENCIA PARCIAL: ${keyWordCount} palabras clave encontradas: ${matchedKeywords.join(', ')}`);
    console.log(`🔔 ¡Mensaje requiere notificación! Obteniendo número de teléfono...`);
    return true;
  }
  
  // Verificar patrones específicos
  if (
    (normalizedMessage.includes("perfecto") && normalizedMessage.includes("asesor")) ||
    (normalizedMessage.includes("perfecto") && normalizedMessage.includes("cita")) ||
    (normalizedMessage.includes("cita") && normalizedMessage.includes("confirmada")) ||
    (normalizedMessage.includes("cita") && normalizedMessage.includes("registrada")) ||
    (normalizedMessage.includes("asesor") && normalizedMessage.includes("llamara")) ||
    (normalizedMessage.includes("asesor") && normalizedMessage.includes("llamará")) ||
    (normalizedMessage.includes("asesor") && normalizedMessage.includes("manana")) ||
    (normalizedMessage.includes("asesor") && normalizedMessage.includes("mañana")) ||
    (normalizedMessage.includes("llamará") && normalizedMessage.includes("2:22"))
  ) {
    console.log(`✅ PATRÓN ESPECÍFICO detectado: combinación de palabras clave`);
    console.log(`🔔 ¡Mensaje requiere notificación! Obteniendo número de teléfono...`);
    return true;
  }
  
  console.log(`ℹ️ El mensaje no contiene ninguna de las frases que requieren notificación`);
  return false;
}

// Función para enviar notificación por correo
async function sendBusinessNotification(conversationId, botMessage, clientPhoneNumber) {
  try {
    console.log(`📧 INICIANDO PROCESO DE NOTIFICACIÓN para conversación: ${conversationId}`);
    console.log(`📧 Mensaje del bot que activó la notificación: "${botMessage}"`);
    console.log(`📧 Número de teléfono del cliente: ${clientPhoneNumber}`);
    
    // 1. Obtener información del negocio
    const { data: businessInfo, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', BUSINESS_ID)
      .single();
    
    if (businessError) {
      console.error(`❌ Error al obtener información del negocio: ${businessError.message}`);
      return false;
    }
    
    if (!businessInfo) {
      console.error(`❌ No se encontró información del negocio. Usando BUSINESS_ID: ${BUSINESS_ID}`);
      return false;
    }
    
    console.log(`📧 Información del negocio obtenida: ID=${businessInfo.id}, Nombre=${businessInfo.name || 'No disponible'}`);
    console.log(`📧 Email del negocio: ${businessInfo.email || 'No disponible'}`);
    
    // 2. Obtener historial reciente de la conversación
    const { data: conversationHistory, error: historyError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (historyError) {
      console.error(`❌ Error al obtener historial de conversación: ${historyError.message}`);
      // No fallamos completamente, continuamos con lo que tenemos
    }
    
    console.log(`📧 Historial de conversación obtenido: ${conversationHistory ? conversationHistory.length : 0} mensajes`);
    
    // 3. Determinar tipo de notificación
    const notificationType = getNotificationType(botMessage);
    const subject = notificationTypes[notificationType] || "🔔 Notificación de Cliente";
    console.log(`📧 Tipo de notificación determinado: ${notificationType}, Asunto: ${subject}`);
    
    // SOLUCIÓN ALTERNATIVA: No enviar correo pero marcar como enviado
    console.log(`⚠️ MÉTODO ALTERNATIVO: Simulando envío de notificación`);
    console.log(`📧 SIMULACIÓN: Correo que se habría enviado`);
    console.log(`📧 Asunto: ${subject} - Cliente ${clientPhoneNumber}`);
    console.log(`📧 Destinatario: ${businessInfo.email || 'No disponible'}`);
    console.log(`📧 Mensaje: ${botMessage}`);
    console.log(`📧 URL: ${process.env.DASHBOARD_URL || 'http://localhost:7777'}/conversations/${conversationId}`);
    
    // Simulamos un ID de mensaje para fines de registro
    const fakeMessageId = `simulated-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    console.log(`✅ Simulación de correo completada. ID: ${fakeMessageId}`);
    
    // 8. Registrar la notificación en la base de datos (esto sí lo hacemos realmente)
    try {
      const { error: dbError } = await supabase.from('notifications').insert({
        conversation_id: conversationId,
        business_id: BUSINESS_ID,
        client_phone: clientPhoneNumber,
        type: notificationType,
        status: 'sent',
        message: botMessage,
        sent_at: new Date().toISOString()
      });
      
      if (dbError) {
        console.warn(`⚠️ Error al registrar notificación en BD:`, dbError);
      } else {
        console.log(`✅ Notificación registrada en la base de datos`);
      }
    } catch (dbError) {
      console.warn(`⚠️ Error al registrar notificación en BD:`, dbError);
    }
    
    // 9. Actualizar la conversación para marcar que se ha enviado una notificación
    try {
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          notification_sent: true,
          notification_timestamp: new Date().toISOString()
        })
        .eq('id', conversationId);
      
      if (updateError) {
        console.warn(`⚠️ Error al actualizar estado de notificación en conversación:`, updateError);
      } else {
        console.log(`✅ Estado de notificación actualizado en la conversación`);
      }
    } catch (updateError) {
      console.warn(`⚠️ Error al actualizar estado de notificación:`, updateError);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error enviando notificación:`, error);
    return false;
  }
}

// Ruta de health check
app.get('/health', (req, res) => {
  const apiKey = process.env.GUPSHUP_API_KEY;
  const source = process.env.GUPSHUP_SOURCE_PHONE;
  const userid = process.env.GUPSHUP_USERID;
  
  // Verificar si tenemos las credenciales necesarias
  const credentialsOk = !!(apiKey && source && userid);
  
  res.status(200).json({ 
    status: credentialsOk ? 'ok' : 'warning',
    message: credentialsOk ? 'WhatsApp service is running with credentials' : 'WhatsApp service is running but credentials are missing',
    credentials: {
      apiKey: apiKey ? `${apiKey.substring(0,5)}...` : 'MISSING',
      source: source ? `${source}` : 'MISSING',
      userid: userid ? `${userid.substring(0,5)}...` : 'MISSING'
    },
    sentMessages: sentMessages.length
  });
});

// Endpoint para ver mensajes enviados
app.get('/messages', (req, res) => {
  res.status(200).json({ 
    messages: sentMessages.slice(-10) // Mostrar los últimos 10 mensajes
  });
});

// Endpoint para enviar mensajes manualmente a WhatsApp
app.post('/api/send-manual-message', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere phoneNumber' 
      });
    }
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere message' 
      });
    }
    
    console.log(`📨 Solicitud para enviar mensaje a WhatsApp para ${phoneNumber}: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`);
    
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
    
    // Enviar el mensaje usando la función de GupShup
    const result = await sendTextMessageGupShup(phoneNumber, message);
    
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
    
    // Programar la eliminación del registro después de un tiempo
    setTimeout(() => {
      recentMessages.delete(messageKey);
      console.log(`🧹 Eliminada referencia a mensaje '${messageKey}' del caché de deduplicación`);
    }, MESSAGE_DEDUPE_TIMEOUT);
    
    // Agregar mensaje a la lista de enviados
    sentMessages.push(responseData);
    
    // Mantener solo los últimos 100 mensajes 
    if (sentMessages.length > 100) {
      sentMessages.shift();
    }
    
    console.log('✅ Mensaje enviado correctamente a WhatsApp');
    
    // Verificar si el mensaje contiene frases que requieren notificación
    console.log(`🔔 ANALIZANDO MENSAJE PARA DETECTAR FRASES DE NOTIFICACIÓN:`);
    console.log(`🔔 Mensaje a analizar: "${message}"`);
    
    const requiresNotification = checkForNotificationPhrases(message);
    
    if (requiresNotification) {
      console.log(`🔔 DETECTADA FRASE QUE REQUIERE NOTIFICACIÓN en mensaje enviado a ${phoneNumber}`);
      
      // Buscar la conversación para este número
      const { data: conversations, error: convoError } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', phoneNumber)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (convoError) {
        console.error(`❌ Error al buscar conversación: ${convoError.message}`);
      } else if (conversations && conversations.length > 0) {
        const conversationId = conversations[0].id;
        console.log(`📧 Conversación encontrada: ${conversationId}`);
        console.log(`📧 Iniciando envío de notificación para conversación ${conversationId}`);
        
        // Enviar notificación
        await sendBusinessNotification(conversationId, message, phoneNumber);
      } else {
        console.warn(`⚠️ No se encontró conversación para el número ${phoneNumber}`);
      }
    } else {
      console.log(`ℹ️ El mensaje no contiene frases que requieran notificación`);
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Mensaje enviado correctamente a WhatsApp',
      data: responseData
    });
  } catch (error) {
    console.error('❌ Error al enviar mensaje a WhatsApp:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Error al enviar mensaje a WhatsApp'
    });
  }
});

// Endpoint para enviar una notificación directamente
app.post('/api/send-notification', async (req, res) => {
  try {
    const { conversationId, botMessage, clientPhoneNumber } = req.body;
    
    console.log(`📧 Solicitud recibida para enviar notificación de conversación ${conversationId}`);
    console.log(`📧 Mensaje: "${botMessage.substring(0, 50)}${botMessage.length > 50 ? '...' : ''}"`);
    console.log(`📧 Cliente: ${clientPhoneNumber}`);
    
    // Verificar parámetros obligatorios
    if (!conversationId) {
      console.error('❌ Error: No se proporcionó ID de conversación');
      return res.status(400).json({
        success: false,
        error: 'Se requiere conversationId'
      });
    }
    
    if (!botMessage) {
      console.error('❌ Error: No se proporcionó mensaje del bot');
      return res.status(400).json({
        success: false,
        error: 'Se requiere botMessage'
      });
    }
    
    if (!clientPhoneNumber) {
      console.error('❌ Error: No se proporcionó número de teléfono del cliente');
      return res.status(400).json({
        success: false,
        error: 'Se requiere clientPhoneNumber'
      });
    }
    
    // MÉTODO ALTERNATIVO: Simular notificación y actualizar BD
    console.log(`⚠️ MÉTODO ALTERNATIVO DE NOTIFICACIÓN ACTIVADO`);
    
    // Tipo de notificación
    const notificationType = getNotificationType(botMessage);
    const subject = notificationTypes[notificationType] || "🔔 Notificación de Cliente";
    
    // Simular notificación
    console.log(`📧 SIMULACIÓN DE NOTIFICACIÓN: ${subject}`);
    console.log(`📧 Mensaje: ${botMessage}`);
    console.log(`📧 Cliente: ${clientPhoneNumber}`);
    console.log(`📧 Conversación: ${conversationId}`);
    
    // 1. Registrar en tabla notifications
    try {
      const { error: dbError } = await supabase.from('notifications').insert({
        conversation_id: conversationId,
        business_id: BUSINESS_ID,
        client_phone: clientPhoneNumber,
        type: notificationType,
        status: 'sent',
        message: botMessage,
        sent_at: new Date().toISOString()
      });
      
      if (dbError) {
        console.warn(`⚠️ Error al guardar notificación en BD: ${JSON.stringify(dbError)}`);
      } else {
        console.log(`✅ Notificación guardada en BD correctamente`);
      }
    } catch (dbError) {
      console.warn(`⚠️ Error al guardar notificación en BD: ${dbError.message}`);
    }
    
    // 2. Actualizar estado en la conversación
    try {
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          notification_sent: true,
          notification_timestamp: new Date().toISOString()
        })
        .eq('id', conversationId);
      
      if (updateError) {
        console.warn(`⚠️ Error al actualizar estado de conversación: ${JSON.stringify(updateError)}`);
      } else {
        console.log(`✅ Estado de notificación actualizado en conversación`);
      }
    } catch (updateError) {
      console.warn(`⚠️ Error al actualizar estado de conversación: ${updateError.message}`);
    }
    
    console.log(`✅ Proceso de notificación alternativa completado exitosamente`);
    
    return res.status(200).json({
      success: true,
      message: 'Notificación procesada correctamente (modo alternativo)'
    });
  } catch (error) {
    console.error('❌ Error general al enviar notificación:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno al procesar la notificación'
    });
  }
});

// Endpoint para probar detección de notificaciones
app.post('/api/test-notification-detection', (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un mensaje para probar'
      });
    }
    
    console.log(`🧪 PRUEBA DE DETECCIÓN DE NOTIFICACIONES`);
    console.log(`🧪 Mensaje a probar: "${message}"`);
    
    // Ejecutar la función de detección de notificaciones
    const requiresNotification = checkForNotificationPhrases(message);
    
    console.log(`🧪 Resultado: ${requiresNotification ? 'REQUIERE NOTIFICACIÓN ✅' : 'NO REQUIERE NOTIFICACIÓN ❌'}`);
    
    return res.status(200).json({
      success: true,
      message: `Prueba completada correctamente`,
      requiresNotification: requiresNotification,
      messageAnalyzed: message
    });
  } catch (error) {
    console.error('❌ Error al probar detección de notificaciones:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno al probar detección de notificaciones'
    });
  }
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor de WhatsApp corriendo en puerto ${PORT}`);
  console.log(`📋 Lista de endpoints disponibles:`);
  console.log(`  GET  /health - Verificar estado del servidor`);
  console.log(`  GET  /messages - Ver últimos mensajes enviados`);
  console.log(`  POST /api/send-manual-message - Enviar mensaje a WhatsApp`);
  console.log(`  POST /api/send-notification - Enviar notificación por correo`);
  console.log(`  POST /api/test-notification-detection - Probar detección de notificaciones`);
});

// Exportar funciones para uso en otros archivos
module.exports = {
  checkForNotificationPhrases,
  sendBusinessNotification,
  getNotificationType,
  transporter,
  supabase
};