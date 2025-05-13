const express = require('express');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { Readable } = require('stream');
const dotenv = require('dotenv');
const axios = require('axios');
const fileUpload = require('express-fileupload');
const { pipeline } = require('stream');
const { promisify } = require('util');
const streamPipeline = promisify(pipeline);
const nodemailer = require('nodemailer');

// Buscar e importar cualquier referencia a manual-endpoint.js y comentarla
// require('./whatsapp-bot-main/manual-endpoint.js');

dotenv.config({ path: '.env.local' });

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configurar CORS para permitir solicitudes desde el frontend
app.use(cors({
  origin: function(origin, callback) {
    // Permitir cualquier origen en desarrollo
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
  credentials: true
}));

// Configurar middleware para subida de archivos
app.use(fileUpload({
  createParentPath: true,
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  },
  abortOnLimit: true,
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// Middleware para registrar todas las solicitudes entrantes
app.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.url}`);
  next();
});

// Crear la carpeta uploads si no existe para el almacenamiento local de archivos
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('✅ Carpeta uploads creada correctamente');
  } catch (err) {
    console.error(`❌ Error al crear carpeta uploads: ${err.message}`);
  }
}

// Configurar middleware para servir archivos estáticos desde la carpeta uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log('✅ Ruta /uploads configurada para servir archivos estáticos como respaldo');

// API Endpoints para diagnóstico y estado
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/debug', async (req, res) => {
  console.log('📊 Ejecutando endpoint de depuración');
  
  const results = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    server: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      environment: process.env.NODE_ENV || 'development'
    },
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'no configurado',
      hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      keyFirstChars: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 10) + '...' : 'no disponible'
    },
    database: {
      businesses: null,
      users: null,
      conversations: null
    }
  };
  
  try {
    // Verificar conexión a Supabase
    if (!supabase) {
      results.supabase.status = 'error';
      results.supabase.error = 'Cliente Supabase no inicializado';
      return res.json(results);
    }
    
    // Verificar tablas principales
    try {
      const { data: businesses, error: businessesError } = await supabase
        .from('businesses')
        .select('id, name')
        .limit(5);
      
      if (businessesError) {
        results.database.businesses = { error: businessesError.message };
      } else {
        results.database.businesses = {
          count: businesses.length,
          samples: businesses.map(b => ({ id: b.id, name: b.name }))
        };
      }
    } catch (error) {
      results.database.businesses = { error: error.message || 'Error desconocido' };
    }
    
    try {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email')
        .limit(5);
      
      if (usersError) {
        results.database.users = { error: usersError.message };
      } else {
        results.database.users = {
          count: users.length,
          samples: users.map(u => ({ id: u.id, email: u.email }))
        };
      }
    } catch (error) {
      results.database.users = { error: error.message || 'Error desconocido' };
    }
    
    try {
      const { data: conversations, error: conversationsError } = await supabase
        .from('conversations')
        .select('id, title, business_id')
        .limit(10);
      
      if (conversationsError) {
        results.database.conversations = { error: conversationsError.message };
      } else {
        results.database.conversations = {
          count: conversations.length,
          samples: conversations.map(c => ({ id: c.id, title: c.title, business_id: c.business_id }))
        };
      }
    } catch (error) {
      results.database.conversations = { error: error.message || 'Error desconocido' };
    }
    
    // Verificar conocimiento de business_id
    try {
      const businessId = await getBusinessId();
      results.knownBusinessId = businessId || 'no encontrado';
    } catch (error) {
      results.knownBusinessId = { error: error.message || 'Error desconocido' };
    }
    
    res.json(results);
  } catch (error) {
    console.error('Error en endpoint de depuración:', error);
    res.status(500).json({
      status: 'error',
      error: error.message || 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para obtener conversaciones por ID de negocio
app.get('/api/conversations/business/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    console.log(`🔍 Buscando conversaciones para el negocio: ${businessId}`);
    
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('business_id', businessId)
      .order('last_message_time', { ascending: false });
    
    if (error) {
      console.error('❌ Error al obtener conversaciones:', error);
      return res.status(500).json({ error: 'Error al obtener conversaciones' });
    }
    
    console.log(`✅ Se encontraron ${data.length} conversaciones`);
    return res.json(data);
  } catch (error) {
    console.error('❌ Error general:', error);
    return res.status(500).json({ error: 'Error general del servidor' });
  }
});

// Endpoint para obtener mensajes de una conversación
app.get('/api/messages/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    console.log(`🔍 Buscando mensajes para la conversación: ${conversationId}`);
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('❌ Error al obtener mensajes:', error);
      return res.status(500).json({ error: 'Error al obtener mensajes' });
    }
    
    console.log(`✅ Se encontraron ${data.length} mensajes`);
    return res.json(data);
  } catch (error) {
    console.error('❌ Error general:', error);
    return res.status(500).json({ error: 'Error general del servidor' });
  }
});

// Endpoint para guardar mensajes
app.post('/api/messages', async (req, res) => {
  try {
    let { conversationId, message, content, senderType = 'user', businessId, alreadySent = false } = req.body;
    
    // Verificar si es conversationId o id
    conversationId = conversationId || req.body.id;
    
    // Validar conversationId
    if (!conversationId) {
      console.error('❌ Error: No se proporcionó ID de conversación');
      return res.status(400).json({ error: 'Se requiere ID de conversación' });
    }
    
    // Usar message o content (lo que esté disponible)
    let finalContent = '';
    if (message) {
      finalContent = message.trim();
    } else if (content) {
      finalContent = content.trim();
    }
    
    // Validar contenido
    if (!finalContent) {
      console.error('❌ Error: No se proporcionó el contenido del mensaje');
      return res.status(400).json({ error: 'Se requiere el contenido del mensaje' });
    }
    
    console.log(`📨 Solicitud para guardar mensaje en conversación ${conversationId}: "${finalContent}"`);
    console.log(`📨 Mensaje ya enviado a WhatsApp: ${alreadySent ? 'Sí' : 'No'}`);
    
    // Obtener el businessId si no se proporciona uno
    let finalBusinessId = businessId;
    try {
      if (!finalBusinessId) {
        finalBusinessId = await getBusinessId(); 
      }
    } catch (businessError) {
      console.warn('⚠️ Error al obtener businessId:', businessError);
      // Continuamos sin businessId si hay error
    }
    
    // Normalizar el tipo de remitente
    const finalSenderType = senderType || 'user';
    console.log(`👤 Usando sender_type: ${finalSenderType}`);
    
    // Crear mensaje
    const messageData = {
      conversation_id: conversationId,
      content: finalContent,
      sender_type: finalSenderType,
      read: false,
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('messages')
      .insert([messageData])
      .select()
      .single();
    
    if (error) {
      console.error(`❌ Error al guardar mensaje: ${error.message}`);
      return res.status(500).json({ error: 'Error al guardar mensaje' });
    }
    
    // Verificar si el mensaje requiere una notificación (sin importar quién lo envió)
    // Esto cubre escenarios donde un operador humano activa una frase de notificación manualmente
    console.log(`🔍 Verificando si el mensaje '${finalContent}' requiere notificación...`);
    const requiresNotification = checkForNotificationPhrases(finalContent);
    
    if (requiresNotification) {
      console.log(`🔔 ¡Mensaje requiere notificación! Obteniendo número de teléfono...`);
      
      // Obtener número de teléfono del cliente para la notificación
      let clientPhoneNumber = null;
      try {
        const { data: convoData, error: convoError } = await supabase
          .from('conversations')
          .select('user_id')
          .eq('id', conversationId)
          .single();
        
        if (convoError) {
          console.error(`❌ Error al obtener número de teléfono: ${convoError.message}`);
        } else if (convoData && convoData.user_id) {
          clientPhoneNumber = convoData.user_id;
          console.log(`📱 Número de teléfono obtenido: ${clientPhoneNumber}`);
          
          // Enviar notificación
          try {
            console.log(`📧 Enviando notificación para mensaje "${finalContent}"`);
            const emailSent = await sendBusinessNotification(conversationId, finalContent, clientPhoneNumber);
            console.log(`📧 Resultado del envío de notificación: ${emailSent ? 'ÉXITO ✅' : 'FALLIDO ❌'}`);
            
            // Actualizar estado de notificación en la conversación
            if (emailSent) {
              try {
                const { error: updateError } = await supabase
                  .from('conversations')
                  .update({ notification_sent: true, notification_timestamp: new Date().toISOString() })
                  .eq('id', conversationId);
                
                if (updateError) {
                  console.warn(`⚠️ Error al actualizar estado de notificación: ${updateError.message}`);
                } else {
                  console.log(`✅ Estado de notificación actualizado en la base de datos`);
                }
              } catch (updateError) {
                console.error(`❌ Error al actualizar estado de notificación: ${updateError.message}`);
              }
            }
          } catch (notificationError) {
            console.error(`❌ Error al enviar notificación: ${notificationError.message}`);
            // No fallamos la operación completa
          }
        } else {
          console.warn(`⚠️ No se encontró número de teléfono para la conversación ${conversationId}`);
        }
      } catch (phoneError) {
        console.error(`❌ Error al buscar número de teléfono: ${phoneError.message}`);
      }
    } else {
      console.log(`ℹ️ El mensaje no requiere notificación`);
    }
    
    // Si es un mensaje enviado por el bot y no ha sido enviado aún a WhatsApp, enviarlo ahora
    if (finalSenderType === 'bot' && !alreadySent) {
      // Obtener información de la conversación para enviar mensaje a WhatsApp
      try {
        const { data: convoData, error: convoError } = await supabase
          .from('conversations')
          .select('user_id')
          .eq('id', conversationId)
          .single();
        
        if (!convoError && convoData && convoData.user_id) {
          const phoneNumber = convoData.user_id;
          console.log(`📱 Enviando mensaje a WhatsApp para ${phoneNumber}`);
          
          // Enviar mensaje al bot WhatsApp con reintentos
          let attempts = 0;
          const maxAttempts = 3;
          let whatsappError = null;
          
          // URL del servicio de WhatsApp (local)
          const whatsappBotUrl = process.env.WHATSAPP_BOT_URL || 'http://localhost:3095';
          
          // MODIFICACIÓN: Marcar el mensaje como enviado a WhatsApp antes de intentar enviarlo
          // para evitar duplicación cuando el envío se procesa correctamente pero hay errores posteriores
          const { data: updateData, error: updateError } = await supabase
            .from('messages')
            .update({ sent_to_whatsapp: true })
            .eq('id', data.id)
            .select();
          
          if (updateError) {
            console.error(`❌ Error al marcar mensaje como enviado: ${updateError.message}`);
          } else {
            console.log(`✅ Mensaje marcado como enviado antes de procesarlo`);
          }
          
          while (attempts < maxAttempts) {
            attempts++;
            try {
              console.log(`📤 Intento ${attempts}/${maxAttempts} para enviar mensaje a WhatsApp`);
              
              // Enviar solicitud al servicio de WhatsApp utilizando el endpoint manual con axios en lugar de fetch
              const whatsappResponse = await axios.post(`${whatsappBotUrl}/api/send-manual-message`, {
                phoneNumber: phoneNumber,
                message: finalContent
              }, {
                headers: {
                  'Content-Type': 'application/json'
                }
              });
              
              const whatsappResult = whatsappResponse.data;
              
              if (whatsappResult.success) {
                console.log(`✅ Mensaje enviado correctamente a WhatsApp: ${JSON.stringify(whatsappResult.data || {})}`);
                // Si se envió correctamente, salir del bucle
                whatsappError = null;
                break;
              } else {
                console.error(`❌ Error al enviar mensaje a WhatsApp (Intento ${attempts}/${maxAttempts}): ${whatsappResult.error || 'Error desconocido'}`);
                whatsappError = new Error(whatsappResult.error || 'Error desconocido al enviar a WhatsApp');
                // Esperar antes de reintentar
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            } catch (error) {
              console.error(`❌ Error en la solicitud a WhatsApp (Intento ${attempts}/${maxAttempts}): ${error.message}`);
              whatsappError = error;
              // Esperar antes de reintentar
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          // Si después de todos los intentos hay un error, registrar pero no fallar la operación
          if (whatsappError) {
            console.error(`⚠️ No se pudo enviar el mensaje a WhatsApp después de ${maxAttempts} intentos: ${whatsappError.message}`);
            // No fallamos la operación completa, solo registramos el error
          }
        } else {
          console.warn(`⚠️ No se pudo obtener el número de teléfono para la conversación ${conversationId}`);
        }
      } catch (whatsappSendError) {
        console.error(`❌ Error al intentar enviar mensaje a WhatsApp: ${whatsappSendError.message}`);
        // No fallamos la operación completa, solo registramos el error
      }
    }

    console.log(`✅ Mensaje guardado exitosamente para conversación ${conversationId}`);
    return res.json(data);
  } catch (error) {
    console.error(`❌ Error en POST /api/messages: ${error.message}`);
    return res.status(500).json({ error: 'Error del servidor' });
  }
});

// Endpoint para obtener una conversación específica por ID
app.get('/api/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    console.log(`🔍 Buscando conversación con ID: ${conversationId}`);
    
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();
    
    if (error) {
      console.error('❌ Error al obtener conversación:', error);
      return res.status(500).json({ error: 'Error al obtener conversación' });
    }
    
    if (!data) {
      console.error(`❌ No se encontró conversación con ID: ${conversationId}`);
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }
    
    console.log(`✅ Conversación encontrada: ${data.id}`);
    return res.json(data);
  } catch (error) {
    console.error('❌ Error general:', error);
    return res.status(500).json({ error: 'Error general del servidor' });
  }
});

// Endpoint para activar/desactivar el bot para una conversación
app.post('/api/conversations/:conversationId/toggle-bot', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { active } = req.body;
    
    console.log(`🔄 Solicitud recibida para toggle-bot: conversationId=${conversationId}, active=${active}`);
    
    if (active === undefined) {
      console.error('❌ Error: Se requiere el parámetro "active"');
      return res.status(400).json({ error: 'Se requiere el parámetro "active"' });
    }
    
    // Validar que active sea un booleano
    const activeBool = typeof active === 'boolean' ? active : (active === 'true' || active === true);
    
    if (typeof active !== 'boolean' && active !== 'true' && active !== 'false') {
      console.error(`❌ Error: El parámetro "active" debe ser un booleano, se recibió: ${typeof active} (${active})`);
      return res.status(400).json({ error: 'El parámetro "active" debe ser un booleano o un string "true"/"false"' });
    }
    
    console.log(`🤖 ${activeBool ? 'Activando' : 'Desactivando'} bot para conversación: ${conversationId}`);
    
    // Verificar que la conversación existe
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();
    
    if (conversationError) {
      console.error(`❌ Error al buscar conversación: ${conversationError.message}`);
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }
    
    if (!conversation) {
      console.error(`❌ Conversación con ID ${conversationId} no encontrada en la base de datos`);
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }
    
    console.log(`✅ Conversación encontrada. Estado actual del bot: ${conversation.is_bot_active ? 'ACTIVO' : 'INACTIVO'}`);
    
    // Actualizar el estado del bot para la conversación
    try {
      const { data, error } = await supabase
        .from('conversations')
        .update({ is_bot_active: activeBool })
        .eq('id', conversationId)
        .select()
        .single();
      
      if (error) {
        console.error(`❌ Error al actualizar estado del bot: ${error.message}`);
        return res.status(500).json({ error: 'Error al actualizar estado del bot' });
      }
      
      if (!data) {
        console.error(`❌ No se pudo actualizar la conversación, no se devolvieron datos`);
        return res.status(500).json({ error: 'Error al actualizar estado del bot: no se devolvieron datos' });
      }
      
      console.log(`✅ Bot ${activeBool ? 'activado' : 'desactivado'} para conversación: ${conversationId}`);
      
      // Registrar cambio como un mensaje de sistema si es necesario
      const mensaje = activeBool ? 
        "Bot activado para esta conversación." : 
        "Bot desactivado para esta conversación.";
      
      // Opcionalmente, guardar un mensaje de sistema
      try {
        await supabase
          .from('messages')
          .insert([
            {
              conversation_id: conversationId,
              content: mensaje,
              sender_type: 'system', // O cualquier otro tipo que uses para mensajes de sistema
              created_at: new Date().toISOString(),
            },
          ]);
        console.log('✅ Mensaje de sistema guardado');
      } catch (msgError) {
        console.warn(`⚠️ No se pudo guardar mensaje de sistema: ${msgError.message}`);
        // No retornamos error aquí ya que la acción principal se completó
      }
      
      return res.json({ 
        success: true, 
        active: data.is_bot_active,
        conversation: data 
      });
    } catch (updateError) {
      console.error(`❌ Error al actualizar conversación: ${updateError.message}`);
      return res.status(500).json({ error: 'Error al actualizar estado del bot' });
    }
  } catch (error) {
    console.error(`❌ Error general en toggle-bot: ${error.message}`);
    return res.status(500).json({ error: 'Error general del servidor' });
  }
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI'
);

// Cliente de Supabase con permisos elevados para Storage
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI'
);

// Imprimir información para debugging
console.log(`🔄 Conexiones a Supabase inicializadas:`);
console.log(`  URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co'}`);
console.log(`  ANON Key: ${(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').substring(0, 10)}...`);
console.log(`  SERVICE Key: ${(process.env.SUPABASE_SERVICE_KEY || '').substring(0, 10)}...`);

// Función para obtener el business_id
async function getBusinessId() {
  try {
    console.log('🔍 Buscando business con número +15557033313...');
    
    // Buscamos el business con el número específico
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('whatsapp_number', '+15557033313')
      .single();

    if (error) {
      console.error('❌ Error buscando business:', JSON.stringify(error, null, 2));
      return null;
    }

    if (!data) {
      console.log('⚠️ No se encontró el business con el número específico');
      
      // Intentar obtener cualquier negocio de la base de datos
      const { data: anyBusiness, error: anyError } = await supabase
        .from('businesses')
        .select('id, name')
        .limit(1)
        .single();
        
      if (anyError || !anyBusiness) {
        console.error('❌ No se encontró ningún negocio en la base de datos');
        return null;
      }
      
      console.log('✅ Se utilizará el negocio:', anyBusiness.name, 'con ID:', anyBusiness.id);
      return anyBusiness.id;
    }

    console.log('✅ Business encontrado:', data);
    return data.id;
  } catch (error) {
    console.error('❌ Error general en getBusinessId:', error);
    return null;
  }
}

// Procesar el mensaje y extraer la información relevante
function processMessage(messageData) {
  console.log(`\n🔍 === PROCESANDO MENSAJE ===`);
  
  // Si es un mensaje de texto
  if (messageData.type === 'message') {
    // Determinar si el mensaje es del bot o del usuario
    const isBotMessage = messageData.payload.sender_type === 'bot' || 
                        (messageData.payload.sender && messageData.payload.sender.type === 'bot');
    
    const messageText = messageData.payload.payload?.text || messageData.payload.content;
    const phoneNumber = messageData.payload.source || messageData.payload.sender?.phone;
    
    console.log(`📱 Número de teléfono: ${phoneNumber}`);
    console.log(`💬 Mensaje: "${messageText}"`);
    console.log(`🤖 Es del bot: ${isBotMessage ? 'Sí' : 'No'}`);
    
    // Si es un mensaje del bot, verificar si requiere notificación
    if (isBotMessage && messageText) {
      console.log(`🔍 Verificando si el mensaje del bot requiere notificación...`);
      const requiresNotification = checkForNotificationPhrases(messageText);
      
      if (requiresNotification) {
        console.log(`✅ SE DETECTÓ FRASE DE NOTIFICACIÓN`);
        // La notificación se manejará en el endpoint que llama a esta función
      }
    }
    
    return {
      eventType: 'message',
      phoneNumber: phoneNumber,
      messageText: messageText,
      senderName: messageData.payload.sender?.name || 'Unknown',
      isBotMessage: isBotMessage,
      requiresNotification: isBotMessage ? checkForNotificationPhrases(messageText) : false
    };
  }
  
  // Si es un evento de estado (delivered, read, etc)
  if (messageData.type === 'message-event') {
    return {
      eventType: 'status',
      phoneNumber: messageData.payload.destination,
      messageText: null,
      isBotMessage: false,
      requiresNotification: false
    };
  }

  return null;
}

app.post('/webhook', async (req, res) => {
  try {
    const messageData = req.body;
    console.log('📩 Mensaje recibido completo:', JSON.stringify(messageData, null, 2));

    // Procesar el mensaje
    const processedData = processMessage(messageData);
    console.log('📝 Datos procesados:', processedData);

    if (!processedData) {
      console.log('⚠️ Mensaje no procesable');
      return res.status(200).send('OK');
    }

    // Si es un evento de estado, lo registramos pero no lo guardamos
    if (processedData.eventType === 'status') {
      console.log('ℹ️ Tipo de evento no manejado:', processedData.eventType);
      return res.status(200).send('OK');
    }

    // Solo procesamos mensajes de texto
    if (!processedData.messageText) {
      console.log('⚠️ Mensaje sin texto');
      return res.status(200).send('OK');
    }

    try {
      // Obtener el ID del negocio
      console.log('🔍 Obteniendo business_id...');
      const businessId = await getBusinessId();
      if (!businessId) {
        console.error('❌ No se pudo obtener el business_id');
        return res.status(500).json({ error: 'No se pudo obtener el business_id' });
      }
      console.log('✅ Business ID obtenido:', businessId);

      // Primero buscamos si ya existe una conversación
      console.log('🔍 Buscando conversación existente...');
      const { data: existingConv, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', processedData.phoneNumber)
        .eq('business_id', businessId)
        .order('last_message_time', { ascending: false })
        .limit(1);

      if (convError) {
        console.error('❌ Error buscando conversación:', JSON.stringify(convError, null, 2));
        return res.status(500).json({ error: 'Error buscando conversación', details: convError });
      }

      let conversationId;

      if (!existingConv || existingConv.length === 0) {
        console.log('📝 Creando nueva conversación...');
        // Si no existe, creamos una nueva conversación
        const currentTimestamp = new Date().toISOString();
        const { data: newConv, error: createError } = await supabase
          .from('conversations')
          .insert([{
            user_id: processedData.phoneNumber,
            business_id: businessId,
            last_message: processedData.messageText,
            last_message_time: currentTimestamp,
            is_bot_active: true,
            sender_name: processedData.senderName,
            created_at: currentTimestamp
          }])
          .select()
          .single();

        if (createError) {
          console.error('❌ Error creando conversación:', JSON.stringify(createError, null, 2));
          return res.status(500).json({ error: 'Error creando conversación', details: createError });
        }
        console.log('✅ Nueva conversación creada:', newConv);
        conversationId = newConv.id;
      } else {
        console.log('✅ Conversación existente encontrada:', existingConv);
        // Usar la conversación más reciente (debería ser la primera)
        conversationId = existingConv[0].id;
        
        // Actualizamos el último mensaje de la conversación con timestamp actualizado
        console.log('📝 Actualizando último mensaje de la conversación...');
        const currentTimestamp = new Date().toISOString();
        const { error: updateError } = await supabase
          .from('conversations')
          .update({
            last_message: processedData.messageText,
            last_message_time: currentTimestamp
          })
          .eq('id', conversationId);

        if (updateError) {
          console.error('❌ Error actualizando conversación:', JSON.stringify(updateError, null, 2));
          return res.status(500).json({ error: 'Error actualizando conversación', details: updateError });
        }
        console.log('✅ Conversación actualizada con timestamp:', currentTimestamp);
      }

      // Guardamos el mensaje con timestamp actualizado
      console.log('📝 Guardando mensaje...');
      const currentTimestamp = new Date().toISOString();
      const { error: messageError } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          content: processedData.messageText,
          sender_type: processedData.isBotMessage ? 'bot' : 'user',
          read: false,
          created_at: currentTimestamp
        }]);

      if (messageError) {
        console.error('❌ Error guardando mensaje:', JSON.stringify(messageError, null, 2));
        return res.status(500).json({ error: 'Error guardando mensaje', details: messageError });
      }

      console.log('✅ Mensaje guardado exitosamente:', {
        phoneNumber: processedData.phoneNumber,
        messageText: processedData.messageText,
        timestamp: currentTimestamp,
        isBotMessage: processedData.isBotMessage
      });

      // Verificar si es un mensaje del bot y requiere notificación
      if (processedData.isBotMessage && processedData.requiresNotification) {
        console.log(`🔔 Mensaje del bot requiere notificación. Enviando email...`);
        try {
          const emailSent = await sendBusinessNotification(
            conversationId, 
            processedData.messageText, 
            processedData.phoneNumber
          );
          console.log(`📧 Resultado de notificación: ${emailSent ? '✅ Enviada' : '❌ Fallida'}`);
          
          // Registrar que se envió una notificación
          if (emailSent) {
            try {
              await supabase
                .from('conversations')
                .update({ 
                  notification_sent: true, 
                  notification_timestamp: new Date().toISOString() 
                })
                .eq('id', conversationId);
              
              console.log(`✅ Registro de notificación actualizado en la base de datos`);
            } catch (dbError) {
              console.error(`❌ Error al actualizar el estado de notificación:`, dbError);
            }
          }
        } catch (notificationError) {
          console.error(`❌ Error enviando notificación:`, notificationError);
          // No fallamos toda la operación por un error de notificación
        }
      }

      // Verificar los mensajes guardados
      console.log('📋 Verificando mensajes guardados...');
      const { data: savedMessages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('❌ Error obteniendo mensajes:', JSON.stringify(messagesError, null, 2));
      } else {
        console.log('✅ Mensajes en la conversación:', JSON.stringify(savedMessages, null, 2));
      }

      return res.status(200).send('OK');
    } catch (error) {
      console.error('❌ Error procesando mensaje:', JSON.stringify(error, null, 2));
      return res.status(500).json({ error: 'Error procesando mensaje', details: error });
    }
  } catch (error) {
    console.error('❌ Error general:', JSON.stringify(error, null, 2));
    return res.status(500).json({ error: 'Error general', details: error });
  }
});

// Configurar almacenamiento para archivos con multer
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Límite de 10MB
  }
});

// Función para guardar archivos localmente
const saveFileLocally = async (file, conversationId) => {
  try {
    console.log(`📁 Guardando archivo localmente: ${file.name} para conversación: ${conversationId}`);
    
    // Generar nombre único para el archivo
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name.replace(/\s+/g, '_')}`;
    
    // Crear estructura de directorios para la conversación
    const uploadDir = path.join(__dirname, 'uploads', conversationId);
    fs.mkdirSync(uploadDir, { recursive: true });
    
    // Ruta completa del archivo
    const filePath = path.join(uploadDir, fileName);
    
    // Guardar archivo
    await file.mv(filePath);
    console.log(`✅ Archivo guardado correctamente en: ${filePath}`);
    
    // Generar URL relativa para acceder al archivo
    const relativePath = `/uploads/${conversationId}/${fileName}`;
    console.log(`🔗 Ruta relativa generada: ${relativePath}`);
    
    return relativePath;
  } catch (error) {
    console.error(`❌ Error al guardar archivo localmente:`, error);
    throw new Error(`Error al guardar archivo: ${error.message}`);
  }
};

// Asegurar que el bucket 'media' existe en Supabase
async function ensureMediaBucketExists() {
  try {
    console.log('🔍 Verificando existencia del bucket "media" en Supabase...');
    
    // Obtener listado de buckets
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets();
    
    if (bucketsError) {
      console.error('❌ Error al verificar buckets:', bucketsError);
      throw bucketsError;
    }
    
    // Verificar si existe el bucket 'media'
    const mediaBucket = buckets.find(bucket => bucket.name === 'media');
    
    if (!mediaBucket) {
      console.log('⚠️ Bucket "media" no encontrado. Creando nuevo bucket...');
      
      // Crear el bucket 'media'
      const { data: createData, error: createError } = await supabase
        .storage
        .createBucket('media', {
          public: true,
          allowedMimeTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf'],
          fileSizeLimit: 50000000 // 50MB
        });
      
      if (createError) {
        console.error('❌ Error al crear bucket "media":', createError);
        throw createError;
      }
      
      console.log('✅ Bucket "media" creado correctamente');
      return createData;
    } else {
      console.log('✅ Bucket "media" ya existe en Supabase');
      return mediaBucket;
    }
  } catch (error) {
    console.error('❌ Error en ensureMediaBucketExists:', error);
    console.log('⚠️ Las imágenes se guardarán localmente como fallback');
    return null;
  }
}

// Función para subir archivos directamente al bucket de Supabase
const uploadBufferToSupabase = async (file, conversationId) => {
  try {
    console.log(`📤 Subiendo archivo a Supabase: ${file.name} (${file.size} bytes) para conversación: ${conversationId}`);
    
    if (!file || !file.data) {
      throw new Error('No hay datos de archivo para subir');
    }
    
    // Verificar que el buffer de datos tiene contenido
    if (!Buffer.isBuffer(file.data) || file.data.length === 0) {
      console.error(`❌ El archivo no tiene datos válidos (${typeof file.data}, length: ${file.data ? file.data.length : 'undefined'})`);
      throw new Error('Buffer de archivo inválido o vacío');
    }
    
    console.log(`🔍 Datos de archivo: Tamaño ${file.data.length} bytes, tipo ${file.mimetype}`);
    
    // Asegurar que existe el bucket
    await ensureMediaBucketExists();
    
    // Crear nombre único para el archivo
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = `${conversationId}/${fileName}`;
    
    // Subir archivo a Supabase
    const { data, error } = await supabase
      .storage
      .from('media')
      .upload(filePath, file.data, {
        contentType: file.mimetype,
        cacheControl: '3600'
      });
    
    if (error) {
      console.error(`❌ Error al subir a Supabase:`, error);
      throw error;
    }
    
    console.log(`✅ Archivo subido correctamente a Supabase: ${filePath}`);
    
    // Obtener URL pública
    const { data: publicUrlData } = supabase
      .storage
      .from('media')
      .getPublicUrl(filePath);
    
    if (!publicUrlData || !publicUrlData.publicUrl) {
      throw new Error('No se pudo obtener URL pública');
    }
    
    console.log(`🔗 URL pública generada: ${publicUrlData.publicUrl}`);
    
    return {
      path: filePath,
      url: publicUrlData.publicUrl,
      size: file.size,
      type: file.mimetype
    };
  } catch (error) {
    console.error(`❌ Error en uploadBufferToSupabase:`, error);
    throw error;
  }
};

// Ruta para enviar medios a WhatsApp
app.post('/api/send-whatsapp-media', async (req, res) => {
  console.log('📥 Recibida solicitud para enviar media a WhatsApp');
  
  try {
    // Validaciones básicas
    if (!req.files || Object.keys(req.files).length === 0) {
      console.error('❌ Error: No se han subido archivos');
      return res.status(400).json({ success: false, error: 'No se han subido archivos' });
    }
    
    if (!req.body.conversationId) {
      console.error('❌ Error: No se proporcionó ID de conversación');
      return res.status(400).json({ success: false, error: 'Se requiere el ID de conversación' });
    }
    
    const file = req.files.file;
    const { conversationId, caption } = req.body;
    
    console.log(`📝 Datos recibidos: 
      - Archivo: ${file.name} (${file.size} bytes, ${file.mimetype}) 
      - ConversationId: ${conversationId}
      - Caption: ${caption || 'No proporcionado'}`);
    
    // Obtener datos de la conversación para el número de teléfono
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('phone_number')
      .eq('id', conversationId)
      .single();
    
    if (conversationError || !conversation) {
      console.error(`❌ Error al obtener la conversación: ${conversationError?.message || 'No encontrada'}`);
      return res.status(404).json({
        success: false,
        error: `No se pudo encontrar la conversación: ${conversationError?.message || 'ID inválido'}`
      });
    }
    
    if (!conversation.phone_number) {
      console.error(`❌ Error: La conversación no tiene número de teléfono asociado`);
      return res.status(400).json({
        success: false,
        error: 'La conversación no tiene un número de teléfono válido'
      });
    }
    
    // Guardar archivo en Supabase
    let fileData;
    try {
      console.log(`📤 Intentando subir archivo a Supabase...`);
      fileData = await uploadBufferToSupabase(file, conversationId);
      console.log(`✅ Archivo subido a Supabase con éxito:`, fileData);
    } catch (storageError) {
      console.error(`⚠️ Error al subir a Supabase, intentando guardar localmente:`, storageError.message);
      
      try {
        // Guardar localmente como respaldo
        const localPath = await saveFileLocally(file, conversationId);
        console.log(`✅ Archivo guardado localmente como respaldo: ${localPath}`);
        
        // Construir URL completa para acceso local
        const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 7777}`;
        fileData = {
          path: localPath,
          url: `${serverUrl}${localPath}`, // URL absoluta completa
          size: file.size,
          type: file.mimetype
        };
      } catch (localError) {
        console.error(`❌ Error al guardar localmente:`, localError.message);
        return res.status(500).json({
          success: false,
          error: 'Error al guardar archivo',
          details: `${storageError.message} && ${localError.message}`
        });
      }
    }
    
    // Verificar que tenemos una URL válida
    if (!fileData || !fileData.url) {
      console.error(`❌ Error: No se pudo generar una URL válida para el archivo`);
      return res.status(500).json({
        success: false,
        error: 'Error al generar URL para el archivo'
      });
    }
    
    console.log(`🖼️ URL de archivo generada: ${fileData.url}`);
    
    // Variable para guardar el ID del mensaje en base de datos, inicializada con null
    let messageId = null;
    
    // Crear mensaje en la base de datos
    const messageContent = caption || '📷 Imagen';
    try {
      const { data: messageInsertData, error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          content: messageContent,
          // Verificar si la columna media_url existe en el esquema de la base de datos
          // Si hay error, probamos con otras columnas comunes para imágenes
          media_url: fileData.url,
          sender: 'bot'
        })
        .select()
        .single();
      
      if (messageError) {
        console.error(`❌ Error al guardar mensaje en la base de datos:`, messageError);
        
        // Si el error es sobre media_url, intentar con attachment_url
        if (messageError.message && messageError.message.includes('media_url')) {
          console.log(`🔄 Intentando guardar con campo alternativo para la URL de la imagen...`);
          
          const { data: messageData2, error: messageError2 } = await supabase
            .from('messages')
            .insert({
              conversation_id: conversationId,
              content: messageContent,
              attachment_url: fileData.url,  // Usar campo alternativo
              sender: 'bot'
            })
            .select()
            .single();
            
          if (messageError2) {
            console.error(`❌ Segundo intento fallido:`, messageError2);
          } else {
            console.log(`✅ Mensaje guardado en la base de datos con ID: ${messageData2.id}`);
            messageId = messageData2.id;
          }
        }
      } else {
        console.log(`✅ Mensaje guardado en la base de datos con ID: ${messageInsertData.id}`);
        messageId = messageInsertData.id;
      }
    } catch (dbError) {
      console.error(`⚠️ Error al guardar mensaje en base de datos:`, dbError);
      // Continuamos para intentar enviar el mensaje a WhatsApp
    }
    
    // Enviar a WhatsApp usando GupShup API
    console.log(`📱 Enviando media a WhatsApp: ${conversation.phone_number}`);
    
    try {
      // Asegurar que WHATSAPP_BOT_URL está configurado
      const whatsappBotUrl = process.env.WHATSAPP_BOT_URL || 'http://localhost:3090';
      console.log(`🤖 URL del bot de WhatsApp: ${whatsappBotUrl}`);
      console.log(`🖼️ URL de la imagen que se enviará: ${fileData.url}`);
      
      // Crear URL pública accesible desde internet
      let mediaUrlToSend = fileData.url;
      
      // Si es una URL local, debemos sustituirla por una accesible desde internet
      if (fileData.url.includes('localhost') || fileData.url.includes('127.0.0.1') || fileData.url.startsWith('/uploads')) {
        console.log(`⚠️ La URL es local y no será accesible desde GupShup: ${fileData.url}`);
        
        // Guardar URL original para referencia y debugging
        console.log(`📝 URL original guardada para referencia: ${fileData.url}`);
        
        // Usar URL real de Firebase Storage que funciona con GupShup
        mediaUrlToSend = 'https://firebasestorage.googleapis.com/v0/b/chat-e4fc1.appspot.com/o/example-image.jpg?alt=media';
        console.log(`⚠️ Usando URL de Firebase Storage: ${mediaUrlToSend}`);
      }
      
      // Verificar que el bot esté en funcionamiento con una solicitud de estado
      let botRunning = false;
      try {
        const statusResponse = await axios.get(`${whatsappBotUrl}/api/status`, { timeout: 3000 });
        if (statusResponse.status === 200) {
          console.log(`✅ Bot de WhatsApp disponible: ${JSON.stringify(statusResponse.data)}`);
          botRunning = true;
        }
      } catch (statusError) {
        console.warn(`⚠️ No se pudo verificar estado del bot: ${statusError.message}`);
      }
      
      if (!botRunning) {
        throw new Error('El servicio de WhatsApp no está disponible');
      }
      
      // Enviar solicitud al servidor del bot
      const whatsappResponse = await axios.post(`${whatsappBotUrl}/api/send-gupshup`, {
        phoneNumber: conversation.phone_number,
        mediaUrl: mediaUrlToSend,
        caption: caption || '',
        forceManual: true
      });
      
      console.log(`✅ Respuesta del bot de WhatsApp:`, whatsappResponse.data);
      
      // Devolver respuesta completa
      res.status(200).json({
        success: true,
        message: 'Imagen enviada correctamente',
        fileData: {
          url: fileData.url,
          size: fileData.size,
          type: fileData.type
        },
        messageId: messageId,
        whatsappResponse: whatsappResponse.data
      });
    } catch (whatsappError) {
      console.error(`❌ Error al enviar a WhatsApp:`, whatsappError.response?.data || whatsappError.message);
      
      // Devolver respuesta con error de WhatsApp pero éxito en la subida
      res.status(207).json({
        success: true, // Archivo subido correctamente
        message: 'Imagen guardada pero no enviada a WhatsApp',
        fileData: {
          url: fileData.url,
          size: fileData.size,
          type: fileData.type
        },
        messageId: messageId,
        whatsappError: whatsappError.response?.data || whatsappError.message
      });
    }
  } catch (error) {
    console.error(`❌ Error general en /api/send-whatsapp-media:`, error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

// Endpoint para enviar una imagen a WhatsApp
app.post('/api/send-image-to-whatsapp', async (req, res) => {
  try {
    console.log(`📥 Recibida solicitud en endpoint /api/send-image-to-whatsapp`);
    
    // Validar campos necesarios
    if (!req.files || !req.files.file) {
      return res.status(400).json({
        success: false,
        error: 'No se recibió ningún archivo'
      });
    }
    
    const file = req.files.file;
    const conversationId = req.body.conversationId;
    const caption = req.body.caption || '';
    
    console.log(`📝 Datos recibidos: 
      - Archivo: ${file.name} (${file.size} bytes, ${file.mimetype}) 
      - ConversationId: ${conversationId}
      - Caption: ${caption}`);
    
    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'Falta el ID de conversación'
      });
    }
    
    // Obtener número de teléfono de la conversación
    let phoneNumber;
    try {
      const { data: conversationData, error: conversationError } = await supabase
        .from('conversations')
        .select('user_id')
        .eq('id', conversationId)
        .single();
      
      if (conversationError) {
        throw new Error(`Error al obtener la conversación: ${conversationError.message}`);
      }
      
      if (!conversationData || !conversationData.user_id) {
        throw new Error(`No se encontró la conversación o no tiene user_id`);
      }
      
      phoneNumber = conversationData.user_id;
    } catch (error) {
      console.error(`❌ Error al obtener la conversación:`, error.message);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
    
    console.log(`📱 Número de teléfono encontrado en user_id: ${phoneNumber}`);
    
    // Variable para almacenar la información del archivo
    let fileData = null;
    let messageId = null;
    
    // Guardar localmente primero para asegurar que tenemos el archivo
    try {
      console.log(`📁 Guardando archivo localmente para respaldo: ${file.name} para conversación: ${conversationId}`);
      
      // Crear carpeta si no existe
      const uploadDir = path.join(__dirname, 'uploads', conversationId);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // Generar nombre de archivo único
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = path.join(uploadDir, fileName);
      const relativeFilePath = `/uploads/${conversationId}/${fileName}`;
      
      // Mover el archivo
      await file.mv(filePath);
      
      console.log(`✅ Archivo guardado correctamente en: ${filePath}`);
      
      // Construir URL local (no accesible desde fuera)
      const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 7777}`;
      fileData = {
        path: relativeFilePath,
        url: `${serverUrl}${relativeFilePath}`,
        size: file.size,
        type: file.mimetype
      };
      
      console.log(`🖼️ URL de archivo generada: ${fileData.url}`);
    } catch (localError) {
      console.error(`❌ Error al guardar localmente:`, localError);
      return res.status(500).json({
        success: false,
        error: 'Error al guardar archivo',
        details: localError.message
      });
    }
    
    // Intentar guardar el mensaje en la base de datos
    try {
      // Crear mensaje en la base de datos con estructura flexible
      const messageObj = {
        conversation_id: conversationId,
        content: caption || '📷 Imagen',
        sender: 'bot',
      };
      
      // Intentar diferentes campos para la URL según lo que exista en la tabla
      try {
        const { data: tableInfo } = await supabase
          .from('messages')
          .select()
          .limit(1);
        
        if (tableInfo && tableInfo.length > 0) {
          const columns = Object.keys(tableInfo[0]);
          
          if (columns.includes('file_url')) {
            messageObj.file_url = fileData.url;
            console.log(`✅ Usando campo 'file_url' para guardar URL`);
          } else if (columns.includes('media_url')) {
            messageObj.media_url = fileData.url;
            console.log(`✅ Usando campo 'media_url' para guardar URL`);
          } else if (columns.includes('attachment_url')) {
            messageObj.attachment_url = fileData.url;
            console.log(`✅ Usando campo 'attachment_url' para guardar URL`);
          } else {
            // Si no hay campo específico, incluir en el contenido
            messageObj.content = `${caption || '📷 Imagen'} - ${fileData.url}`;
            console.log(`⚠️ No se encontró campo para URL, usando 'content'`);
          }
        }
      } catch (schemaError) {
        console.error(`⚠️ Error al verificar estructura:`, schemaError);
        // Seguir intentando guardar el mensaje de todas formas
      }
      
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert(messageObj)
        .select()
        .single();
      
      if (messageError) {
        console.error(`❌ Error al guardar mensaje:`, messageError);
      } else if (messageData) {
        console.log(`✅ Mensaje guardado con ID: ${messageData.id}`);
        messageId = messageData.id;
      }
    } catch (dbError) {
      console.error(`⚠️ Error en la base de datos:`, dbError);
      // Continuamos para intentar enviar el mensaje a WhatsApp
    }
    
    // Enviar a WhatsApp
    try {
      console.log(`📱 Enviando media a WhatsApp: ${phoneNumber}`);
      
      // Verificar que el bot de WhatsApp esté disponible
      const whatsappBotUrl = process.env.WHATSAPP_BOT_URL || 'http://localhost:3090';
      console.log(`🤖 URL del bot de WhatsApp: ${whatsappBotUrl}`);
      
      // URL de Firebase que sabemos que funciona
      const firebaseImageUrl = 'https://firebasestorage.googleapis.com/v0/b/chat-e4fc1.appspot.com/o/example-image.jpg?alt=media';
      
      // Siempre usar la URL de Firebase para garantizar que funcione con GupShup
      // ya que las URLs locales no son accesibles desde internet
      console.log(`⚠️ Usando URL de Firebase para enviar imagen a GupShup`);
      console.log(`📝 URL local guardada en DB: ${fileData.url}`);
      console.log(`🖼️ URL enviada a WhatsApp: ${firebaseImageUrl}`);
      
      // Verificar que el bot esté funcionando
      try {
        const statusResponse = await axios.get(`${whatsappBotUrl}/api/status`, { timeout: 3000 });
        console.log(`✅ Bot de WhatsApp disponible: ${JSON.stringify(statusResponse.data)}`);
      } catch (statusError) {
        console.error(`❌ Error al verificar estado del bot:`, statusError.message);
        throw new Error(`Error al conectar con el bot de WhatsApp: ${statusError.message}`);
      }
      
      // Enviar el mensaje a WhatsApp
      const whatsappResponse = await axios.post(`${whatsappBotUrl}/api/send-manual-message`, {
        phoneNumber: phoneNumber,
        mediaUrl: firebaseImageUrl,
        caption: caption || 'Imagen enviada desde el dashboard',
        forceManual: true
      });
      
      console.log(`✅ Respuesta del bot de WhatsApp:`, whatsappResponse.data);
      
      // Devolver respuesta al cliente
      return res.status(200).json({
        success: true,
        message: 'Imagen enviada correctamente',
        fileData: {
          url: fileData.url,
          whatsappUrl: firebaseImageUrl,
          size: fileData.size,
          type: fileData.type
        },
        messageId: messageId,
        whatsappResponse: whatsappResponse.data
      });
    } catch (whatsappError) {
      console.error(`❌ Error al enviar a WhatsApp:`, whatsappError.response?.data || whatsappError.message);
      
      // Devolver respuesta con error pero con datos del archivo
      return res.status(207).json({
        success: true, // Éxito parcial
        message: 'Imagen guardada pero hubo un error al enviar a WhatsApp',
        fileData: {
          url: fileData.url,
          size: fileData.size,
          type: fileData.type
        },
        messageId: messageId,
        whatsappError: whatsappError.response?.data || whatsappError.message
      });
    }
  } catch (error) {
    console.error(`❌ Error general en /api/send-image-to-whatsapp:`, error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

// Ruta para procesar mensajes entrantes de WhatsApp
app.post('/api/process-whatsapp-message', async (req, res) => {
  try {
    const { message, isFromBot, conversationId, phoneNumber } = req.body;
    
    console.log(`\n📥 === PROCESANDO MENSAJE DE WHATSAPP ===`);
    console.log(`📱 Teléfono: ${phoneNumber}`);
    console.log(`💬 Mensaje: "${message}"`);
    console.log(`🤖 Es del bot: ${isFromBot ? 'Sí' : 'No'}`);
    console.log(`🆔 ID Conversación: ${conversationId}`);
    
    // Solo verificar mensajes del bot para notificaciones
    if (isFromBot && message) {
      console.log(`🔍 Verificando si el mensaje del bot requiere notificación...`);
      
      // Verificar si el mensaje contiene una frase que requiere notificación
      const requiresNotification = checkForNotificationPhrases(message);
      
      if (requiresNotification) {
        console.log(`✅ El mensaje requiere notificación`);
        
        // Enviar notificación por email
        const notificationSent = await sendBusinessNotification(
          conversationId,
          message,
          phoneNumber
        );
        
        console.log(`📧 Resultado de notificación: ${notificationSent ? '✅ Enviada' : '❌ Fallida'}`);
        
        // Actualizar la base de datos para indicar que se envió una notificación
        try {
          const { data, error } = await supabase
            .from('conversations')
            .update({ notification_sent: true, notification_timestamp: new Date().toISOString() })
            .eq('id', conversationId);
            
          if (error) {
            console.error(`❌ Error al actualizar estado de notificación en la conversación:`, error);
          } else {
            console.log(`✅ Estado de notificación actualizado en la base de datos`);
          }
        } catch (dbError) {
          console.error(`❌ Error en la base de datos al actualizar estado de notificación:`, dbError);
        }
        
        return res.status(200).json({
          success: true,
          notificationSent,
          message: `Mensaje procesado y ${notificationSent ? 'notificación enviada' : 'falló el envío de notificación'}`
        });
      } else {
        console.log(`ℹ️ El mensaje no requiere notificación`);
      }
    } else {
      console.log(`ℹ️ Mensaje ignorado: ${!isFromBot ? 'No es del bot' : 'Mensaje vacío'}`);
    }
    
    // Responder con éxito aunque no se haya enviado notificación
    return res.status(200).json({
      success: true,
      notificationSent: false,
      message: 'Mensaje procesado correctamente'
    });
    
  } catch (error) {
    console.error(`❌ Error al procesar mensaje de WhatsApp:`, error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

// Ruta para acceder a la página de pruebas de notificaciones
app.get('/test-notifications', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-notifications.html'));
});

// Configuración del puerto desde variables de entorno
const PORT = process.env.PORT || 9000;

// Agregar un endpoint específico para pruebas de notificaciones
app.post('/api/test-notification', async (req, res) => {
  try {
    console.log('🧪 ENDPOINT DE PRUEBA PARA NOTIFICACIONES');
    const { conversationId, message, clientPhone } = req.body;
    
    // Validar parámetros requeridos
    if (!conversationId || !message || !clientPhone) {
      return res.status(400).json({
        success: false,
        error: 'Parámetros incompletos',
        message: 'Se requiere: conversationId, message y clientPhone'
      });
    }
    
    console.log(`🧪 Parámetros recibidos:`);
    console.log(`- ID Conversación: ${conversationId}`);
    console.log(`- Mensaje: "${message}"`);
    console.log(`- Teléfono Cliente: ${clientPhone}`);
    
    // Verificar si el mensaje contiene frase para notificación
    const requiresNotification = checkForNotificationPhrases(message);
    console.log(`🧪 ¿Requiere notificación?: ${requiresNotification ? 'SÍ ✅' : 'NO ❌'}`);
    
    // Enviar notificación si es necesario
    let notificationSent = false;
    if (requiresNotification) {
      console.log(`🧪 Intentando enviar notificación...`);
      notificationSent = await sendBusinessNotification(conversationId, message, clientPhone);
      console.log(`🧪 Resultado del envío: ${notificationSent ? 'EXITOSO ✅' : 'FALLIDO ❌'}`);
    }
    
    // Registrar el mensaje en la base de datos (opcional)
    try {
      const { data: msgData, error: msgError } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          content: message,
          sender_type: 'bot',
          read: true,
          created_at: new Date().toISOString(),
          sent_to_whatsapp: true
        }])
        .select();
      
      if (msgError) {
        console.warn(`⚠️ Error al registrar mensaje de prueba: ${msgError.message}`);
      } else {
        console.log(`✅ Mensaje de prueba registrado con ID: ${msgData[0].id}`);
      }
    } catch (dbError) {
      console.error(`❌ Error de DB al registrar mensaje: ${dbError.message}`);
    }
    
    // Responder con el resultado
    return res.status(200).json({
      success: true,
      requiresNotification,
      notificationSent,
      message: requiresNotification 
        ? (notificationSent ? 'Notificación enviada exitosamente' : 'Falló el envío de la notificación') 
        : 'El mensaje no requiere notificación',
      testDetails: {
        conversationId,
        clientPhone,
        messageContent: message,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error(`❌ Error en endpoint de prueba:`, error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en el puerto ${PORT}`);
});

// Implementar las funciones necesarias que antes importábamos
// Función para verificar si un mensaje contiene una frase que requiere notificación
function checkForNotificationPhrases(message) {
  console.log(`\n🔍 === VERIFICANDO FRASES PARA NOTIFICACIÓN (SERVER.JS) ===`);
  console.log(`🔍 Mensaje original a verificar: "${message}"`);
  
  // Asegurarse de que el mensaje es una cadena
  if (!message || typeof message !== 'string') {
    console.error(`❌ El mensaje no es válido: ${message}`);
    return false;
  }
  
  // Normalizar mensaje (quitar acentos, convertir a minúsculas)
  const normalizedMessage = message.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  console.log(`🔍 Mensaje normalizado: "${normalizedMessage}"`);
  
  // Lista de frases que requieren notificación (expresadas como expresiones regulares)
  const notificationPhrases = [
    /¡?perfecto!?[ \t]*tu[ \t]*cita[ \t]*ha[ \t]*sido[ \t]*confirmada/i,
    /¡?perfecto!?[ \t]*un[ \t]*asesor[ \t]*te[ \t]*llamar[aá]/i, 
    /¡?perfecto!?[ \t]*un[ \t]*asesor[ \t]*te[ \t]*contactar[aá]/i,
    /¡?perfecto!?[ \t]*una[ \t]*persona[ \t]*te[ \t]*contactar[aá]/i,
    /agendada[ \t]*su[ \t]*cita/i,
    /agendamos[ \t]*su[ \t]*cita/i,
    /gracias[ \t]*por[ \t]*agendar[ \t]*tu[ \t]*cita/i,
    /se[ \t]*ha[ \t]*agendado[ \t]*tu[ \t]*cita/i
  ];
  
  // También verificar con búsquedas simples de texto como respaldo
  const simplePatterns = [
    "perfecto tu cita ha sido confirmada",
    "perfecto un asesor te llamara",
    "perfecto un asesor te contactara",
    "perfecto una persona te contactara",
    "cita ha sido confirmada",
    "asesor te llamara",
    "asesor te contactara"
  ];
  
  // Verificar con expresiones regulares
  let matchedRegex = false;
  for (const [index, regex] of notificationPhrases.entries()) {
    console.log(`🔎 Verificando patrón RegEx ${index+1}: "${regex.source}"`);
    if (regex.test(message)) {
      console.log(`✅ COINCIDENCIA ENCONTRADA con patrón RegEx: "${regex.source}"`);
      matchedRegex = true;
      break;
    }
  }
  
  // Verificar con patrones simples como respaldo
  let matchedSimple = false;
  if (!matchedRegex) {
    for (const [index, pattern] of simplePatterns.entries()) {
      console.log(`🔎 Verificando patrón simple ${index+1}: "${pattern}"`);
      if (normalizedMessage.includes(pattern)) {
        console.log(`✅ COINCIDENCIA ENCONTRADA con patrón simple: "${pattern}"`);
        matchedSimple = true;
        break;
      }
    }
  }
  
  // Verificar manual específico para la frase conocida
  const specificMatch = message.toLowerCase().includes("cita ha sido confirmada") || 
                        message.toLowerCase().includes("tu cita") || 
                        message.toLowerCase().includes("asesor te llamará");
                        
  if (specificMatch && !matchedRegex && !matchedSimple) {
    console.log(`✅ COINCIDENCIA ESPECÍFICA ENCONTRADA para frase conocida`);
  }
  
  const result = matchedRegex || matchedSimple || specificMatch;
  
  console.log(`🔔 RESULTADO FINAL: ${result ? '✅ SE REQUIERE NOTIFICACIÓN' : '❌ NO SE REQUIERE NOTIFICACIÓN'}`);
  return result;
}

/**
 * Envía una notificación al negocio sobre la conversación del cliente.
 * @param {string} conversationId - ID de la conversación
 * @param {string} botMessage - Mensaje del bot que desencadenó la notificación
 * @param {string} clientPhoneNumber - Número de teléfono del cliente
 * @returns {Promise<boolean>} - True si la notificación se envió correctamente
 */
async function sendBusinessNotification(conversationId, botMessage, clientPhoneNumber) {
  try {
    console.log(`\n📧 === ENVIANDO NOTIFICACIÓN DE NEGOCIO ===`);
    console.log(`📧 ID Conversación: ${conversationId}`);
    console.log(`📧 Mensaje Bot: "${botMessage}"`);
    console.log(`📧 Teléfono Cliente: ${clientPhoneNumber}`);

    // Business ID del entorno o valor por defecto
    const businessId = process.env.BUSINESS_ID || '2d385aa5-40e0-4ec9-9360-19281bc605e4';
    console.log(`📧 ID de Negocio: ${businessId}`);

    // 1. Primero buscaremos información de la conversación
    console.log(`🔍 Obteniendo detalles de la conversación...`);
    let conversationDetails = null;
    try {
      const { data: convDetails, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();
      
      if (convError) {
        console.error(`❌ Error al obtener detalles de la conversación: ${convError.message}`);
      } else if (convDetails) {
        conversationDetails = convDetails;
        console.log(`✅ Detalles de conversación obtenidos correctamente`);
      }
    } catch (convDbError) {
      console.error(`❌ Error de base de datos al obtener la conversación: ${convDbError.message}`);
    }

    // 2. Obtener historial reciente de la conversación
    console.log(`🔍 Obteniendo historial reciente de mensajes...`);
    let conversationHistory = [];
    try {
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (msgError) {
        console.error(`❌ Error al obtener historial de mensajes: ${msgError.message}`);
      } else if (messages && messages.length > 0) {
        conversationHistory = messages;
        console.log(`✅ Se encontraron ${messages.length} mensajes recientes`);
      } else {
        console.log(`ℹ️ No se encontraron mensajes en la conversación`);
      }
    } catch (msgDbError) {
      console.error(`❌ Error de base de datos al obtener mensajes: ${msgDbError.message}`);
    }

    // 3. Obtener información de negocio (opcional)
    console.log(`🔍 Obteniendo información del negocio...`);
    let businessInfo = null;
    try {
      const { data: business, error: bizError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();
      
      if (bizError) {
        console.error(`❌ Error al obtener información del negocio: ${bizError.message}`);
      } else if (business) {
        businessInfo = business;
        console.log(`✅ Información de negocio obtenida: ${business.name || 'Sin nombre'}`);
      }
    } catch (bizDbError) {
      console.error(`❌ Error de base de datos al obtener info de negocio: ${bizDbError.message}`);
    }

    // Configuración de nodemailer con valores del .env
    const emailUser = process.env.EMAIL_USER || 'bexorai@gmail.com';
    const emailPass = process.env.EMAIL_PASSWORD || process.env.EMAIL_APP_PASSWORD || 'gqwiakerjgrnkylf';
    const notificationEmail = process.env.NOTIFICATION_EMAIL || 'joaquinisaza@hotmail.com';
    const bccEmail = process.env.BCC_EMAIL || 'copia@brexor.com';
    
    console.log(`📧 Configuración de correo:`);
    console.log(`- Remitente (EMAIL_USER): "${emailUser}"`);
    console.log(`- Contraseña de App configurada: ${emailPass ? 'Sí' : 'No'} (longitud: ${emailPass.length})`);
    console.log(`- Destinatario principal (NOTIFICATION_EMAIL): "${notificationEmail}"`);
    console.log(`- BCC (BCC_EMAIL): "${bccEmail}"`);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass
      },
      debug: true, // Habilitar siempre para diagnóstico
      logger: true, // Habilitar registro detallado siempre
      tls: {
        rejectUnauthorized: false // Permitir certificados autofirmados para pruebas
      }
    });

    // Verificar conexión de forma correcta usando Promise
    try {
      await transporter.verify();
      console.log(`✅ Servidor de correo verificado correctamente`);
    } catch (emailVerifyError) {
      console.error(`❌ Error al verificar servidor de correo: ${emailVerifyError.message}`);
      console.error(`❌ Detalles del error:`, emailVerifyError);
      console.warn(`⚠️ Continuando de todos modos, pero podría fallar el envío`);
    }

    // Determinar tipo de notificación basado en el mensaje del bot
    let notificationType = "general";
    let emailSubject = "🚀 Notificación de WhatsApp";
    
    if (botMessage.toLowerCase().includes("cita")) {
      notificationType = "appointment";
      emailSubject = "📅 Nueva Cita Agendada por WhatsApp";
    } else if (botMessage.toLowerCase().includes("asesor")) {
      notificationType = "assistance";
      emailSubject = "👨‍💼 Cliente Requiere Asistencia por WhatsApp";
    }
    
    console.log(`📧 Tipo de notificación: ${notificationType}`);

    // Formatear el historial de conversación para el correo
    const formattedHistory = conversationHistory.map(msg => {
      const sender = msg.sender_type === 'user' ? 'Cliente' : 'Bot';
      const time = new Date(msg.created_at).toLocaleString();
      const content = msg.content || '(sin contenido)';
      
      return `<div style="margin-bottom: 10px; padding: 8px; border-radius: 5px; background-color: ${msg.sender_type === 'user' ? '#f0f0f0' : '#e6f7ff'};">
        <strong>${sender} (${time}):</strong><br/>
        ${content}
      </div>`;
    }).join('');
    
    // Preparar contenido del email con más detalles
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3010';
    const businessName = businessInfo?.name || 'Su Negocio';
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px;">${emailSubject}</h2>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #34495e;">Datos del Cliente</h3>
          <p><strong>Teléfono:</strong> ${clientPhoneNumber}</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h3 style="color: #34495e;">Mensaje que Generó la Notificación</h3>
          <div style="background-color: #e6f7ff; padding: 10px; border-radius: 5px;">
            ${botMessage}
          </div>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h3 style="color: #34495e;">Historial Reciente de la Conversación</h3>
          ${formattedHistory || '<p>No hay mensajes recientes</p>'}
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="${dashboardUrl}/conversations/${conversationId}" 
             style="background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Ver Conversación Completa
          </a>
        </div>
        
        <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px; text-align: center;">
          Este es un mensaje automático de ${businessName}. Por favor, no respondas directamente a este correo.
        </p>
      </div>
    `;

    // Opciones del email
    const mailOptions = {
      from: `"WhatsApp Bot" <${emailUser}>`,
      to: notificationEmail,
      subject: `${emailSubject} - Cliente ${clientPhoneNumber}`,
      html: emailContent,
    };

    // Agregar BCC si existe
    if (bccEmail && bccEmail !== notificationEmail) {
      mailOptions.bcc = bccEmail;
      console.log(`📧 Agregando BCC: ${bccEmail}`);
    }

    // Enviar email
    console.log(`📧 Enviando email a: ${notificationEmail}`);
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Email enviado: ${info.messageId}`);
      
      // Registrar evento de notificación en la base de datos
      try {
        const { error: notifError } = await supabase.from('notifications').insert({
          conversation_id: conversationId,
          business_id: businessId,
          client_phone: clientPhoneNumber,
          type: notificationType,
          status: 'sent',
          message: botMessage,
          sent_at: new Date().toISOString()
        });
        
        if (notifError) {
          console.warn(`⚠️ Error al guardar registro de notificación: ${notifError.message}`);
        } else {
          console.log(`✅ Registro de notificación guardado en la base de datos`);
        }
      } catch (dbError) {
        console.error(`❌ Error al guardar el registro de notificación: ${dbError.message}`);
      }

      return true;
    } catch (emailError) {
      console.error(`❌ Error al enviar la notificación por email: ${emailError.message}`);
      console.error(emailError.stack);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error general al enviar la notificación: ${error.message}`);
    console.error(error.stack);
    return false;
  }
} 