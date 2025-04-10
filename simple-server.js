const express = require('express');
const axios = require('axios');
const app = express();
const PORT = 3095;
const nodemailer = require('nodemailer');
const fs = require('fs');

// Obtener credenciales desde variables de entorno
const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY || 'sk_58a31041fdeb4d98b9f0e073792a6e6b';
const GUPSHUP_NUMBER = process.env.GUPSHUP_SOURCE_PHONE || '15557033313';
const GUPSHUP_USERID = process.env.GUPSHUP_USERID || 'crxty1qflktvwvm7sodtrfe9dpvoowm1';
const EMAIL_USER = process.env.EMAIL_USER || 'bexorai@gmail.com';
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD || 'gqwiakerjgrnkylf';
const BCC_EMAIL = process.env.BCC_EMAIL || 'copia@brexor.com';
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || 'joaquinisaza@hotmail.com';

// Frases del bot que indican una solicitud confirmada que requiere notificación
const botConfirmationPhrases = [
  // Solicitud de asistencia humana
  "he registrado tu solicitud para hablar con un asesor",
  "un representante se pondrá en contacto contigo",
  
  // Confirmación de cita
  "tu cita ha sido agendada para",
  "hemos registrado tu cita para el día",
  "cita confirmada para el",
  "cita para", 
  "calendly",
  "agendar cita",
  "link donde podrás registrarla",
  
  // Solicitud de llamada
  "te llamaremos pronto al número",
  "hemos registrado tu solicitud de llamada",
  "recibirás una llamada en",
  
  // Seguimiento
  "daremos seguimiento a tu caso",
  "caso registrado con el folio",
  
  // Nuevas frases de confirmación (2025)
  "¡Perfecto! tu cita ha sido confirmada para",
  "¡Perfecto! un asesor te llamará",
  "¡Perfecto! un asesor te contactará",
  "¡Perfecto! una persona te contactará",
  "¡Perfecto! Un asesor te llamará hoy a las",
  "¡Perfecto! un asesor te llamará mañana a las",
  "¡Perfecto! un asesor te llamará el"
];

// Variable para realizar seguimiento del estado del sistema de correo
let emailSystemWorking = false;

// Configurar transporter solo si nodemailer está disponible
let transporter;
if (nodemailer) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASSWORD
    },
    debug: true,
    logger: true,
    // Aumentar los tiempos de espera
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    // Desactivar verificación TLS para mayor compatibilidad
    tls: {
      rejectUnauthorized: false
    }
  });
  
  // Verificar conexión al iniciar
  transporter.verify()
    .then(() => {
      console.log('✅ Servidor SMTP verificado correctamente');
      emailSystemWorking = true;
      // Enviar correo de prueba para verificar que todo funciona
      sendTestEmail();
    })
    .catch(error => {
      console.error('❌ Error al verificar SMTP:', error);
      console.error('❌ Detalles:', { code: error.code, command: error.command });
      console.log('⚠️ Se ignorarán las solicitudes de envío de correo');
    });
}

// Función para enviar correo de prueba al iniciar
function sendTestEmail() {
  if (!transporter || !emailSystemWorking) return;
  
  const testMailOptions = {
    from: `"WhatsApp Bot - Test" <${EMAIL_USER}>`,
    to: NOTIFICATION_EMAIL,
    subject: 'Prueba de sistema de notificaciones',
    html: `<p>Este es un mensaje de prueba enviado el ${new Date().toISOString()}</p>
           <p>Si recibes este correo, el sistema de notificaciones está funcionando correctamente.</p>`
  };
  
  console.log('📧 Enviando correo de prueba para verificar configuración...');
  transporter.sendMail(testMailOptions)
    .then(info => {
      console.log(`✅ Correo de prueba enviado correctamente: ${info.messageId}`);
    })
    .catch(error => {
      console.error('❌ Error al enviar correo de prueba:', error);
      emailSystemWorking = false;
    });
}

// Función para enviar notificación por correo con reintentos
async function sendEmailNotification(phoneNumber, message) {
  console.log(`📧 INICIANDO ENVÍO DE NOTIFICACIÓN POR CORREO`);
  console.log(`📧 Número de teléfono: ${phoneNumber}`);
  console.log(`📧 Mensaje: "${message}"`);
  
  // Si el sistema de correo no está disponible, guardar en archivo local
  if (!transporter || !emailSystemWorking) {
    console.log('⚠️ Sistema de correo no disponible, guardando notificación localmente');
    saveNotificationToFile(phoneNumber, message);
    return false;
  }
  
  try {
    // Determinar tipo de notificación
    let notificationType = "general";
    let emailSubject = "🔔 Notificación de WhatsApp";
    
    if (message.toLowerCase().includes("cita")) {
      notificationType = "cita";
      emailSubject = "📅 Nueva Cita Agendada por WhatsApp";
    } else if (message.toLowerCase().includes("asesor")) {
      notificationType = "asesor";
      emailSubject = "👤 Cliente Requiere Asistencia por WhatsApp";
    } else if (message.toLowerCase().includes("llamada")) {
      notificationType = "llamada";
      emailSubject = "📞 Solicitud de Llamada por WhatsApp";
    }
    
    // Contenido del correo
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px;">${emailSubject}</h2>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #34495e;">Datos del Cliente</h3>
          <p><strong>Teléfono:</strong> ${phoneNumber}</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h3 style="color: #34495e;">Mensaje que Generó la Notificación</h3>
          <div style="background-color: #e6f7ff; padding: 10px; border-radius: 5px;">
            ${message}
          </div>
        </div>
        
        <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px; text-align: center;">
          Este es un mensaje automático. Por favor, no respondas directamente a este correo.
        </p>
      </div>
    `;
    
    // Opciones del correo
    const mailOptions = {
      from: `"WhatsApp Bot 🤖" <${EMAIL_USER}>`,
      to: NOTIFICATION_EMAIL,
      subject: `${emailSubject} - Cliente ${phoneNumber}`,
      html: emailContent
    };
    
    // Agregar BCC si existe
    if (BCC_EMAIL && BCC_EMAIL !== NOTIFICATION_EMAIL) {
      mailOptions.bcc = BCC_EMAIL;
      console.log(`📧 Agregando BCC: ${BCC_EMAIL}`);
    }
    
    // Sistema de reintentos para el envío
    let attemptCount = 0;
    const maxAttempts = 3;
    let emailSent = false;
    
    while (attemptCount < maxAttempts && !emailSent) {
      attemptCount++;
      console.log(`📧 Intento ${attemptCount}/${maxAttempts} de envío de correo a: ${NOTIFICATION_EMAIL}`);
      
      try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Correo enviado exitosamente: ${info.messageId}`);
        emailSent = true;
      } catch (error) {
        console.error(`❌ Error al enviar correo (intento ${attemptCount}): ${error.message}`);
        
        // Si hay más intentos, esperar antes del siguiente
        if (attemptCount < maxAttempts) {
          const waitTime = Math.pow(2, attemptCount) * 1000; // 2s, 4s, 8s...
          console.log(`⏱️ Esperando ${waitTime/1000}s antes del siguiente intento...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    // Si no se pudo enviar después de todos los intentos, guardar en archivo
    if (!emailSent) {
      console.log('❌ No se pudo enviar correo después de todos los intentos');
      saveNotificationToFile(phoneNumber, message);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error general al enviar correo: ${error.message}`);
    console.error(error.stack);
    saveNotificationToFile(phoneNumber, message);
    return false;
  }
}

// Función para guardar notificación en archivo local cuando falla el correo
function saveNotificationToFile(phoneNumber, message) {
  if (!fs) return;
  
  try {
    const notificationDir = './notification_backup';
    
    // Crear directorio si no existe
    if (!fs.existsSync(notificationDir)) {
      fs.mkdirSync(notificationDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${notificationDir}/notification_${phoneNumber}_${timestamp}.json`;
    
    const data = {
      phoneNumber,
      message,
      timestamp: new Date().toISOString(),
      type: message.toLowerCase().includes("cita") ? "cita" : 
            message.toLowerCase().includes("asesor") ? "asesor" : "general"
    };
    
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`✅ Notificación guardada en archivo: ${filename}`);
  } catch (error) {
    console.error(`❌ Error al guardar notificación en archivo: ${error.message}`);
  }
}

// Función para verificar si un mensaje requiere notificación
function checkForNotificationPhrases(message) {
  console.log(`🔍 Verificando notificación para: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
  
  if (!message || typeof message !== 'string') {
    console.log('❌ Mensaje inválido para verificación de notificación');
    return false;
  }
  
  // Normalizar el mensaje
  const normalizedMessage = message.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Eliminar acentos
  
  // Las únicas frases exactas que deben activar el envío del correo
  const criticalPhrases = [
    "¡perfecto! tu cita ha sido confirmada para",
    "perfecto! tu cita ha sido confirmada para",
    "¡perfecto! un asesor te llamará",
    "perfecto! un asesor te llamará",
    "¡perfecto! un asesor te contactará",
    "perfecto! un asesor te contactará",
    "¡perfecto! una persona te contactará",
    "perfecto! una persona te contactará"
  ];
  
  // Verificar si el mensaje contiene alguna de las frases específicas
  for (const phrase of criticalPhrases) {
    if (normalizedMessage.includes(phrase)) {
      console.log(`✅ COINCIDENCIA EXACTA: "${phrase}"`);
      return true;
    }
  }
  
  console.log(`❌ No se detectaron frases que requieran notificación`);
  return false;
}

// Agregar middleware CORS para permitir solicitudes desde localhost:3000
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Manejar solicitudes OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

app.use(express.json());

// Endpoint para verificar el estado del servidor
app.get('/api/status', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString() });
});

app.get('/status', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Endpoint para diagnosticar el sistema
app.get('/api/diagnose', (req, res) => {
  console.log('🔍 Ejecutando diagnóstico del servidor WhatsApp');
  // Verificar las solicitudes recientes y conexiones activas
  const diagnosticResults = {
    serverStatus: 'online',
    processId: process.pid,
    memoryUsage: process.memoryUsage(),
    endpoints: [
      { path: '/api/send-message', method: 'POST', status: 'active' },
      { path: '/api/send-media', method: 'POST', status: 'active' },
      { path: '/api/status', method: 'GET', status: 'active' },
      { path: '/status', method: 'GET', status: 'active' },
      { path: '/health', method: 'GET', status: 'active' }
    ],
    timestamp: new Date().toISOString()
  };
  
  res.json(diagnosticResults);
});

// Endpoint para enviar mensaje simulado
app.post('/send-message', async (req, res) => {
  try {
    const { phone, message } = req.body;
    
    console.log(`📝 Recibida solicitud para enviar mensaje:`);
    console.log(`📱 Teléfono: ${phone}`);
    console.log(`💬 Mensaje: "${message}"`);
    
    if (!phone || !message) {
      console.log(`❌ Error: faltan datos requeridos`);
      return res.status(400).json({ error: 'Se requiere número de teléfono y mensaje' });
    }
    
    console.log(`🔄 Verificando si el mensaje requiere notificación...`);
    
    // Verificar si el mensaje requiere notificación
    const requiresNotification = checkForNotificationPhrases(message);
    console.log(`🔍 Resultado de checkForNotificationPhrases: ${requiresNotification ? 'REQUIERE NOTIFICACIÓN ✅' : 'NO REQUIERE NOTIFICACIÓN ❌'}`);
    
    if (requiresNotification) {
      console.log(`🔔 DETECTADA FRASE QUE REQUIERE NOTIFICACIÓN. Enviando correo...`);
      
      // Aquí iría la lógica para enviar el correo
      console.log(`📧 INICIANDO ENVÍO DE NOTIFICACIÓN POR CORREO`);
      console.log(`📧 Número de teléfono: ${phone}`);
      console.log(`📧 Mensaje: "${message}"`);
      
      // Configuración para envío de correos
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'bexorai@gmail.com',
          pass: 'gqwi aker jgrn kylf'  // contraseña de aplicación
        },
        debug: true,
        logger: true
      });
      
      const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px;">📅 Nueva Cita Agendada por WhatsApp</h2>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #34495e;">Datos del Cliente</h3>
          <p><strong>Teléfono:</strong> ${phone}</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h3 style="color: #34495e;">Mensaje que Generó la Notificación</h3>
          <div style="background-color: #e6f7ff; padding: 10px; border-radius: 5px;">
            ${message}
          </div>
        </div>
        
        <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px; text-align: center;">
          Este es un mensaje automático. Por favor, no respondas directamente a este correo.
        </p>
      </div>
    `;
      
      const mailOptions = {
        from: '"WhatsApp Bot 🤖" <bexorai@gmail.com>',
        to: 'joaquinisaza@hotmail.com',
        subject: `📅 Nueva Cita Agendada por WhatsApp - Cliente ${phone}`,
        html: emailContent,
      };
      
      // Agregar BCC 
      mailOptions.bcc = 'copia@brexor.com';
      console.log(`📧 Agregando BCC: ${mailOptions.bcc}`);
      
      console.log(`📧 Intento 1/3 de envío de correo a: ${mailOptions.to}`);
      
      try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Correo enviado exitosamente: ${info.messageId}`);
        console.log(`✅ Notificación enviada exitosamente`);
      } catch (emailError) {
        console.error(`❌ Error al enviar correo: ${emailError.message}`);
        // Intentamos una segunda vez
        console.log(`📧 Intento 2/3 de envío de correo...`);
        try {
          const info2 = await transporter.sendMail(mailOptions);
          console.log(`✅ Correo enviado exitosamente en el segundo intento: ${info2.messageId}`);
        } catch (emailError2) {
          console.error(`❌ Error en segundo intento: ${emailError2.message}`);
        }
      }
    }
    
    console.log(`🔄 Enviando mensaje real a GupShup para ${phone}`);
    console.log(`📝 Mensaje: ${message}`);
        
    // Verificar si las credenciales están configuradas
    if (!process.env.GUPSHUP_API_KEY || !process.env.GUPSHUP_NUMBER) {
      console.log(`⚠️ No hay credenciales de GupShup, simulando éxito`);
      return res.json({ 
        success: true, 
        message: 'Mensaje procesado correctamente', 
        notificacion: requiresNotification ? 'Enviada' : 'No requerida' 
      });
    }
    
    try {
      const apiKey = process.env.GUPSHUP_API_KEY;
      console.log(`🔑 Usando API KEY: ${apiKey.substring(0, 6)}...`);
      
      const sourceNumber = process.env.GUPSHUP_NUMBER;
      console.log(`📱 Usando número fuente: ${sourceNumber}`);
      
      const userId = process.env.GUPSHUP_USERID;
      console.log(`👤 Usando user ID: ${userId ? userId.substring(0, 9) + '...' : 'NO CONFIGURADO'}`);
      
      // Endpoint de GupShup
      const apiUrl = 'https://api.gupshup.io/sm/api/v1/msg';
      
      // Configuración de la solicitud
      const formData = new URLSearchParams();
      formData.append('channel', 'whatsapp');
      formData.append('source', sourceNumber);
      formData.append('destination', phone);
      formData.append('message', message);
      formData.append('src.name', sourceNumber);
      
      const headers = {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded',
        'apikey': apiKey
      };
      
      if (userId) {
        headers['userid'] = userId;
      }
      
      // Enviar solicitud a GupShup
      const response = await axios.post(apiUrl, formData, { headers });
      console.log(`✅ Respuesta de GupShup: ${JSON.stringify(response.data)}`);
      
      return res.json({
        success: true,
        message: 'Mensaje enviado correctamente a GupShup',
        response: response.data,
        notificacion: requiresNotification ? 'Enviada' : 'No requerida'
      });
    } catch (error) {
      console.error(`❌ Error al enviar mensaje a GupShup: ${error.message}`);
      
      if (error.response) {
        console.error(`- Estado: ${error.response.status}`);
        console.error(`- Datos: ${JSON.stringify(error.response.data)}`);
      }
      
      return res.status(500).json({
        success: false,
        error: 'Error al enviar mensaje a GupShup',
        details: error.message
      });
    }
  } catch (error) {
    console.error(`❌ Error al enviar mensaje: ${error.message}`);
    return res.status(500).json({ error: 'Error interno al enviar mensaje' });
  }
});

// Endpoint para reiniciar conexiones a WhatsApp
app.post('/api/reset', (req, res) => {
  console.log('🔄 Reiniciando conexiones a WhatsApp');
  
  // Simular reinicio de servicios
  setTimeout(() => {
    console.log('✅ Conexiones reiniciadas correctamente');
  }, 500);
  
  return res.json({
    success: true,
    message: 'Reinicio de conexiones iniciado',
    timestamp: new Date().toISOString()
  });
});

// Endpoint para media
app.post('/api/send-media', (req, res) => {
  const { phoneNumber, mediaUrl, caption } = req.body;
  
  if (!phoneNumber || !mediaUrl) {
    return res.status(400).json({ success: false, error: 'Se requiere phoneNumber y mediaUrl' });
  }
  
  console.log(`📱 Simulando envío de media a WhatsApp: ${phoneNumber}`);
  console.log(`🔗 Media URL: ${mediaUrl}`);
  console.log(`💬 Caption: ${caption || 'N/A'}`);
  
  // Simular éxito
  return res.json({ 
    success: true, 
    messageId: `sim-media-${Date.now()}`,
    timestamp: new Date().toISOString(),
    details: { phoneNumber, mediaUrl, caption }
  });
});

// Endpoint para enviar un mensaje manual
app.post('/api/send-manual-message', async (req, res) => {
  const { phoneNumber, message } = req.body;
  
  if (!phoneNumber || !message) {
    return res.status(400).json({ success: false, error: 'Se requiere phoneNumber y message' });
  }
  
  console.log(`📱 Enviando mensaje manual a WhatsApp: ${phoneNumber}`);
  console.log(`💬 Mensaje: ${message}`);
  
  try {
    // Intentar enviar el mensaje real a GupShup
    const result = await sendMessageToGupShup(phoneNumber, message);
    return res.json(result);
  } catch (error) {
    console.error(`❌ Error en envío manual: ${error.message}`);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString() 
    });
  }
});

// Agregar endpoint para prueba de notificaciones
app.post('/api/test-notification', async (req, res) => {
  try {
    const { message, phoneNumber } = req.body;
    
    if (!message || !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren message y phoneNumber'
      });
    }
    
    console.log(`🧪 PRUEBA DE NOTIFICACIÓN SOLICITADA`);
    console.log(`🧪 Mensaje: "${message}"`);
    console.log(`🧪 Teléfono: ${phoneNumber}`);
    
    // Verificar si el mensaje requiere notificación
    const requiresNotification = checkForNotificationPhrases(message);
    console.log(`🧪 ¿Requiere notificación?: ${requiresNotification ? 'SÍ ✅' : 'NO ❌'}`);
    
    if (requiresNotification) {
      // Enviar notificación
      const notificationSent = await sendEmailNotification(phoneNumber, message);
      
      if (notificationSent) {
        console.log(`✅ Notificación enviada exitosamente`);
        return res.status(200).json({
          success: true,
          message: 'Notificación enviada correctamente',
          notificationSent: true
        });
      } else {
        console.log(`❌ Error al enviar la notificación`);
        return res.status(500).json({
          success: false,
          error: 'Error al enviar la notificación',
          notificationSent: false
        });
      }
    } else {
      console.log(`ℹ️ El mensaje no requiere notificación`);
      return res.status(200).json({
        success: true,
        message: 'El mensaje no requiere notificación',
        requiresNotification: false
      });
    }
  } catch (error) {
    console.error(`❌ Error al procesar solicitud de prueba:`, error);
    return res.status(500).json({
      success: false,
      error: 'Error interno al procesar la solicitud'
    });
  }
});

// Agregar endpoint para forzar notificación aunque el mensaje no lo requiera
app.post('/api/force-notification', async (req, res) => {
  try {
    const { message, phoneNumber } = req.body;
    
    if (!message || !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren message y phoneNumber'
      });
    }
    
    console.log(`🧪 FORZANDO NOTIFICACIÓN`);
    console.log(`🧪 Mensaje: "${message}"`);
    console.log(`🧪 Teléfono: ${phoneNumber}`);
    
    // Enviar notificación sin verificación
    const notificationSent = await sendEmailNotification(phoneNumber, message);
    
    if (notificationSent) {
      console.log(`✅ Notificación forzada enviada exitosamente`);
      return res.status(200).json({
        success: true,
        message: 'Notificación forzada enviada correctamente',
        notificationSent: true
      });
    } else {
      console.log(`❌ Error al enviar la notificación forzada`);
      return res.status(500).json({
        success: false,
        error: 'Error al enviar la notificación forzada',
        notificationSent: false
      });
    }
  } catch (error) {
    console.error(`❌ Error al procesar solicitud de notificación forzada:`, error);
    return res.status(500).json({
      success: false,
      error: 'Error interno al procesar la solicitud'
    });
  }
});

// Agregar endpoint para verificar el estado del servidor SMTP
app.get('/api/email-status', (req, res) => {
  console.log(`🔍 Verificando estado del sistema de correo electrónico`);
  
  // Verificar si el transporter está configurado
  if (!transporter) {
    console.log(`❌ Transporter no configurado`);
    return res.status(200).json({
      success: true,
      emailSystemWorking: false,
      message: 'Sistema de correo no configurado'
    });
  }
  
  // Verificar conexión
  transporter.verify()
    .then(() => {
      console.log(`✅ Servidor SMTP verificado correctamente`);
      
      // Enviar un correo de prueba pequeño para confirmar
      const testMailOptions = {
        from: `"WhatsApp Bot - Test" <${EMAIL_USER}>`,
        to: EMAIL_USER,
        subject: 'Verificación de estado de correo',
        text: `Esta es una prueba de verificación solicitada desde el endpoint /api/email-status a las ${new Date().toISOString()}`
      };
      
      return transporter.sendMail(testMailOptions);
    })
    .then((info) => {
      console.log(`✅ Correo de prueba enviado: ${info?.messageId}`);
      emailSystemWorking = true;
      
      return res.status(200).json({
        success: true,
        emailSystemWorking: true,
        message: 'Sistema de correo funcionando correctamente',
        testEmailId: info?.messageId
      });
    })
    .catch((error) => {
      console.error(`❌ Error en sistema de correo:`, error);
      emailSystemWorking = false;
      
      return res.status(200).json({
        success: true,
        emailSystemWorking: false,
        message: `Error en sistema de correo: ${error.message}`,
        errorCode: error.code,
        errorCommand: error.command
      });
    });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor WhatsApp simulado iniciado en http://localhost:${PORT}`);
  console.log(`📝 Configurado para enviar mensajes reales a GupShup`);
  
  // Verificar la configuración de correo
  console.log(`📧 Configuración de correo:`);
  console.log(`- Remitente: ${EMAIL_USER}`);
  console.log(`- Contraseña: ${EMAIL_PASSWORD ? '✅ Configurada' : '❌ No configurada'}`);
  console.log(`- Destinatario principal: ${NOTIFICATION_EMAIL}`);
  console.log(`- BCC: ${BCC_EMAIL || 'No configurado'}`);
  
  // Verificar conexión con el servidor SMTP
  transporter.verify()
    .then(() => console.log('✅ Conexión con servidor de correo verificada'))
    .catch(err => console.error('❌ Error al verificar servidor de correo:', err));
}); 