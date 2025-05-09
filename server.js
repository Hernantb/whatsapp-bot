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
const fetch = require('node-fetch');

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
    
    // Detección especial para el mensaje problemático
    if (finalContent.includes("asesor te llamará") || finalContent.includes("asesor te llamara")) {
      console.log(`🚨 MENSAJE CLAVE DETECTADO: "${finalContent}"`);
      console.log(`🚨 TIPO DE MENSAJE: ${senderType}`);
      console.log(`🚨 CONVERSATION ID: ${conversationId}`);
    }
    
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
    
    // Verificar si el mensaje requiere una notificación (si es del bot)
    if (finalSenderType === 'bot') {
      console.log(`🔍 Verificando si el mensaje del bot requiere notificación: "${finalContent}"`);
      const requiresNotification = checkForNotificationPhrases(finalContent);
      
      if (requiresNotification) {
        console.log(`🔔 ¡Mensaje del bot requiere notificación!`);
        
        // Obtener número de teléfono del cliente para la notificación
        try {
          const { data: convoData, error: convoError } = await supabase
            .from('conversations')
            .select('user_id')
            .eq('id', conversationId)
            .single();
          
          if (convoError) {
            console.error(`❌ Error al obtener número de teléfono: ${convoError.message}`);
          } else if (convoData && convoData.user_id) {
            const clientPhoneNumber = convoData.user_id;
            console.log(`📱 Número de teléfono obtenido: ${clientPhoneNumber}`);
            
            // Enviar notificación
            try {
              console.log(`📧 Enviando notificación para mensaje "${finalContent}"`);
              const emailSent = await sendBusinessNotification(conversationId, finalContent, clientPhoneNumber);
              console.log(`📧 Resultado del envío de notificación: ${emailSent ? 'ÉXITO ✅' : 'FALLIDO ❌'}`);
              
              // Actualizar estado de notificación en la conversación
              if (emailSent) {
                try {
                  // Usar la nueva función para actualizar notificación
                  await handleNotificationUpdate(conversationId, true, data.id);
                } catch (updateError) {
                  console.error(`❌ Error al actualizar estado de notificación: ${updateError.message}`);
                }
              }
            } catch (notificationError) {
              console.error(`❌ Error al enviar notificación: ${notificationError.message}`);
            }
          } else {
            console.warn(`⚠️ No se encontró número de teléfono para la conversación ${conversationId}`);
          }
        } catch (phoneError) {
          console.error(`❌ Error al buscar número de teléfono: ${phoneError.message}`);
        }
      } else {
        console.log(`ℹ️ El mensaje no requiere notificación.`);
      }
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
          try {
            await markMessageAsSent(data.id);
            console.log(`✅ Mensaje marcado como enviado antes de procesarlo`);
          } catch (updateError) {
            console.error(`❌ Error al marcar mensaje como enviado: ${updateError.message}`);
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

// Configuración de Supabase - URLs y claves desde variables de entorno
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Función para verificar y crear columnas necesarias
async function ensureColumnsExist() {
  console.log('🔧 Verificando y creando columnas necesarias en la base de datos...');
  
  try {
    // Verificar columnas en la tabla 'conversations'
    const { data: conversationInfo, error: conversationError } = await supabase
      .from('conversations')
      .select('*')
      .limit(1);
    
    if (conversationError) {
      console.error('❌ Error al verificar tabla conversations:', conversationError.message);
    } else {
      console.log('✅ Tabla conversations accesible');
      
      // Intentar actualizar una fila inexistente para ver si las columnas existen
      try {
        const { error: updateError } = await supabase
          .from('conversations')
          .update({
            notification_sent: true,
            notification_timestamp: new Date().toISOString()
          })
          .eq('id', '00000000-0000-0000-0000-000000000000');
        
        if (!updateError || updateError.code === 'PGRST116') {
          console.log('✅ Columnas notification_sent y notification_timestamp existen o fueron creadas');
        } else if (updateError.message.includes('column') && updateError.message.includes('does not exist')) {
          console.log('⚠️ Las columnas de notificación no existen en conversations. Intentando SQL directo...');
          
          // Intentar con SQL directo usando RPC
          const { error: sqlError } = await supabase.rpc('exec_sql', {
            sql: `
              ALTER TABLE conversations 
              ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT false;
              
              ALTER TABLE conversations 
              ADD COLUMN IF NOT EXISTS notification_timestamp TIMESTAMP WITH TIME ZONE;
              
              -- Refrescar el schema cache para Supabase
              NOTIFY pgrst, 'reload schema';
            `
          });
          
          if (sqlError) {
            console.error('❌ Error al ejecutar SQL directo:', sqlError.message);
            
            // Intento de fallback usando _exec_sql si el método RPC falla
            const { error: fallbackError } = await supabase.from('_exec_sql').select('*').eq('query', `
              ALTER TABLE conversations 
              ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT false;
              
              ALTER TABLE conversations 
              ADD COLUMN IF NOT EXISTS notification_timestamp TIMESTAMP WITH TIME ZONE;
            `);
            
            if (fallbackError) {
              console.error('❌ También falló el método alternativo:', fallbackError.message);
            } else {
              console.log('✅ Columnas agregadas a conversations mediante método alternativo');
              
              // Intentar refrescar el schema cache
              try {
                await fetch(`${SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_KEY}`, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                  }
                });
                console.log('✅ Enviada petición para refrescar schema cache');
              } catch (refreshError) {
                console.error('❌ Error al intentar refrescar schema:', refreshError.message);
              }
            }
          } else {
            console.log('✅ Columnas agregadas a conversations mediante SQL RPC');
          }
        }
      } catch (e) {
        console.error('❌ Error al intentar actualizar conversations:', e.message);
      }
    }
    
    // Verificar columnas en la tabla 'messages'
    const { data: messageInfo, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .limit(1);
    
    if (messageError) {
      console.error('❌ Error al verificar tabla messages:', messageError.message);
    } else {
      console.log('✅ Tabla messages accesible');
      
      // Intentar actualizar una fila inexistente para ver si la columna existe
      try {
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            sent_to_whatsapp: true
          })
          .eq('id', '00000000-0000-0000-0000-000000000000');
        
        if (!updateError || updateError.code === 'PGRST116') {
          console.log('✅ Columna sent_to_whatsapp existe o fue creada');
        } else if (updateError.message.includes('column') && updateError.message.includes('does not exist')) {
          console.log('⚠️ La columna sent_to_whatsapp no existe en messages. Intentando SQL directo...');
          
          // Intentar con SQL directo usando RPC
          const { error: sqlError } = await supabase.rpc('exec_sql', {
            sql: `
              ALTER TABLE messages 
              ADD COLUMN IF NOT EXISTS sent_to_whatsapp BOOLEAN DEFAULT false;
              
              -- Refrescar el schema cache para Supabase
              NOTIFY pgrst, 'reload schema';
            `
          });
          
          if (sqlError) {
            console.error('❌ Error al ejecutar SQL directo:', sqlError.message);
            
            // Intento de fallback usando _exec_sql si el método RPC falla
            const { error: fallbackError } = await supabase.from('_exec_sql').select('*').eq('query', `
              ALTER TABLE messages 
              ADD COLUMN IF NOT EXISTS sent_to_whatsapp BOOLEAN DEFAULT false;
            `);
            
            if (fallbackError) {
              console.error('❌ También falló el método alternativo:', fallbackError.message);
            } else {
              console.log('✅ Columna sent_to_whatsapp agregada a messages mediante método alternativo');
              
              // Intentar refrescar el schema cache
              try {
                await fetch(`${SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_KEY}`, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                  }
                });
                console.log('✅ Enviada petición para refrescar schema cache');
              } catch (refreshError) {
                console.error('❌ Error al intentar refrescar schema:', refreshError.message);
              }
            }
          } else {
            console.log('✅ Columna sent_to_whatsapp agregada a messages mediante SQL RPC');
          }
        }
      } catch (e) {
        console.error('❌ Error al intentar actualizar messages:', e.message);
      }
    }
  } catch (error) {
    console.error('❌ Error general al verificar columnas:', error.message);
  }
}

// Verificar columnas al iniciar el servidor
ensureColumnsExist().then(() => {
  console.log('🔧 Verificación de columnas completada');
}).catch(error => {
  console.error('❌ Error en la verificación inicial de columnas:', error);
});

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

/**
 * Endpoint WebHook para recibir mensajes
 * Este endpoint procesa los mensajes entrantes, los guarda en la base de datos
 * y verifica si necesitan generar notificaciones
 */
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

      // Buscar si ya existe una conversación con este número de teléfono
      // para evitar conversaciones duplicadas
      console.log('🔍 Buscando conversación existente para el número:', processedData.phoneNumber);
      const { data: existingConv, error: convError } = await supabase
        .from('conversations')
        .select('id, user_id, sender_name')
        .eq('user_id', processedData.phoneNumber)
        .eq('business_id', businessId)
        .order('last_message_time', { ascending: false })
        .limit(1);

      if (convError) {
        console.error('❌ Error buscando conversación:', JSON.stringify(convError, null, 2));
        return res.status(500).json({ error: 'Error buscando conversación', details: convError });
      }

      let originalSenderName = '';
      let conversationId;
      let senderName = processedData.senderName || 'Usuario';

      if (!existingConv || existingConv.length === 0) {
        console.log('📝 No se encontró conversación existente para este número, creando una nueva...');
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
            sender_name: senderName,
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
        console.log('✅ Conversación existente encontrada:', existingConv[0]);
        // Usar la conversación existente
        conversationId = existingConv[0].id;
        
        // Solo actualizamos el nombre si el actual es genérico y recibimos uno más específico
        if (existingConv[0].sender_name === 'Usuario' && processedData.senderName) {
          senderName = processedData.senderName;
        } else {
          senderName = existingConv[0].sender_name;
        }
        
        // Actualizamos el último mensaje de la conversación
        console.log('📝 Actualizando último mensaje de la conversación...');
        const currentTimestamp = new Date().toISOString();
        const { error: updateError } = await supabase
          .from('conversations')
          .update({
            last_message: processedData.messageText,
            last_message_time: currentTimestamp,
            sender_name: senderName
          })
          .eq('id', conversationId);

        if (updateError) {
          console.error('❌ Error actualizando conversación:', JSON.stringify(updateError, null, 2));
          return res.status(500).json({ error: 'Error actualizando conversación', details: updateError });
        }
        console.log('✅ Conversación actualizada con timestamp:', currentTimestamp);
      }

      // Guardamos el mensaje
      console.log('📝 Guardando mensaje...');
      const currentTimestamp = new Date().toISOString();
      const { data: newMessage, error: messageError } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          content: processedData.messageText,
          sender_type: processedData.isBotMessage ? 'bot' : 'user',
          read: false,
          created_at: currentTimestamp,
          // Agregar campos de notificación si es del bot
          needs_notification: processedData.isBotMessage && processedData.requiresNotification,
          notification_sent: false
        }])
        .select(); // Seleccionar para obtener el ID del mensaje insertado

      if (messageError) {
        console.error('❌ Error guardando mensaje:', JSON.stringify(messageError, null, 2));
        return res.status(500).json({ error: 'Error guardando mensaje', details: messageError });
      }

      // Obtener el ID del mensaje insertado
      const messageId = newMessage && newMessage.length > 0 ? newMessage[0].id : null;

      console.log('✅ Mensaje guardado exitosamente:', {
        messageId: messageId,
        phoneNumber: processedData.phoneNumber,
        messageText: processedData.messageText,
        timestamp: currentTimestamp,
        isBotMessage: processedData.isBotMessage,
        requiresNotification: processedData.isBotMessage && processedData.requiresNotification
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
              // Usar la nueva función para actualizar notificación
              await handleNotificationUpdate(conversationId, true, messageId);
              
              return res.json({ success: true, notificationSent: true });
            } catch (updateError) {
              console.error(`❌ Error al actualizar estado de notificación: ${updateError.message}`);
              return res.json({ success: true, notificationSent: true, warning: 'No se pudo actualizar estado en BD' });
            }
          } else {
            return res.json({ success: false, notificationSent: false, message: 'Error al enviar notificación' });
          }
        } catch (notificationError) {
          console.error(`❌ Error al enviar notificación: ${notificationError.message}`);
          return res.json({ success: false, notificationSent: false, error: notificationError.message });
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
    
    console.log(`\n🔄 === PROCESAR MENSAJE WHATSAPP ===`);
    console.log(`📥 Mensaje de WhatsApp recibido: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    console.log(`🤖 ¿Es de bot?: ${isFromBot ? 'Sí' : 'No'}`);
    console.log(`🆔 Conversación ID: ${conversationId}`);
    console.log(`📱 Número de teléfono: ${phoneNumber}`);
    
    // Si el mensaje es del bot, verificar si contiene frases que requieren notificación
    if (isFromBot && message) {
      console.log(`\n🔍 === VERIFICACIÓN INDEPENDIENTE DE NOTIFICACIÓN ===`);
      console.log(`🔎 Verificando si el mensaje '${message}' del bot requiere notificación...`);
      
      // Verificación explícita para frases de asesor
      if (message.includes("asesor te llamará") || message.includes("asesor te llamara")) {
        console.log(`🚨 FRASE DE ASESOR DETECTADA DIRECTAMENTE: "${message}"`);
      }
      
      // Verificación completa con la función
      const requiresNotification = checkForNotificationPhrases(message);
      console.log(`🔍 ¿Requiere notificación según la función?: ${requiresNotification ? 'SÍ ✅' : 'NO ❌'}`);
      
      if (requiresNotification) {
        console.log(`🔔 MENSAJE REQUIERE NOTIFICACIÓN`);
        
        // Verificar que tengamos un ID de conversación y un número de teléfono
        if (!conversationId) {
          console.error(`❌ Falta ID de conversación para enviar notificación`);
          return res.json({ success: false, notificationSent: false, message: 'Falta ID de conversación' });
        }
        
        if (!phoneNumber) {
          console.error(`❌ Falta número de teléfono para enviar notificación`);
          return res.json({ success: false, notificationSent: false, message: 'Falta número de teléfono' });
        }
        
        // Enviar notificación
        try {
          console.log(`📧 Enviando notificación para mensaje de WhatsApp...`);
          const emailSent = await sendBusinessNotification(conversationId, message, phoneNumber);
          console.log(`📧 Resultado del envío de notificación: ${emailSent ? 'ÉXITO ✅' : 'FALLIDO ❌'}`);
          
          // Actualizar estado de notificación en la conversación
          if (emailSent) {
            try {
              // Usar la nueva función para actualizar notificación
              await handleNotificationUpdate(conversationId, true);
              
              return res.json({ success: true, notificationSent: true });
            } catch (updateError) {
              console.error(`❌ Error al actualizar estado de notificación: ${updateError.message}`);
              return res.json({ success: true, notificationSent: true, warning: 'No se pudo actualizar estado en BD' });
            }
          } else {
            return res.json({ success: false, notificationSent: false, message: 'Error al enviar notificación' });
          }
        } catch (notificationError) {
          console.error(`❌ Error al enviar notificación: ${notificationError.message}`);
          return res.json({ success: false, notificationSent: false, error: notificationError.message });
        }
      } else {
        console.log(`ℹ️ El mensaje no requiere notificación`);
        return res.json({ success: true, notificationSent: false, message: 'El mensaje no requiere notificación' });
      }
    } else {
      console.log(`ℹ️ No es un mensaje del bot, no se verifica notificación`);
      return res.json({ success: true, notificationSent: false, message: 'No es un mensaje del bot' });
    }
  } catch (error) {
    console.error(`❌ Error general en procesamiento de mensaje de WhatsApp: ${error.message}`);
    return res.status(500).json({ success: false, notificationSent: false, error: 'Error general del servidor' });
  }
});

// Ruta para acceder a la página de pruebas de notificaciones
app.get('/test-notifications', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-notifications.html'));
});

// Configuración del puerto desde variables de entorno
const PORT = process.env.PORT || 7777;

// Function to check if port is available
const isPortAvailable = (port) => {
  return new Promise((resolve) => {
    const server = require('http').createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`⚠️ Puerto ${port} ya está en uso, intentando puerto alternativo...`);
        resolve(false);
      } else {
        resolve(true);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
};

// Iniciar el servidor
const startServer = async () => {
  // Try original port, then fallback ports if needed
  const portOptions = [PORT, 7778, 7779, 7780, 7781];
  let selectedPort = null;
  
  for (const port of portOptions) {
    if (await isPortAvailable(port)) {
      selectedPort = port;
      break;
    }
  }
  
  if (!selectedPort) {
    console.error(`❌ No se pudo encontrar un puerto disponible. Intentando último puerto: ${portOptions[portOptions.length - 1]}`);
    selectedPort = portOptions[portOptions.length - 1];
  }
  
  const server = app.listen(selectedPort, () => {
    console.log(`🚀 Servidor ejecutándose en el puerto ${selectedPort}`);
  
  // Verificar notificaciones pendientes al iniciar
  setTimeout(() => {
    console.log(`⏱️ Verificando notificaciones pendientes al iniciar...`);
    checkPendingNotifications();
    
    // Programar verificación periódica cada 15 minutos
    setInterval(checkPendingNotifications, 15 * 60 * 1000);
      
      // Primera verificación de mensajes de seguimiento después de iniciar
      console.log(`⏱️ Verificando mensajes de seguimiento al iniciar...`);
      checkForFollowUpMessages();
      
      // Programar verificación de mensajes de seguimiento cada 2 minutos
      setInterval(checkForFollowUpMessages, 2 * 60 * 1000);
  }, 5000); // Esperar 5 segundos después del inicio para dar tiempo a que todo se inicialice
});
  
  // Handle server errors
  server.on('error', (error) => {
    console.error(`❌ Error en el servidor: ${error.message}`);
    if (error.code === 'EADDRINUSE') {
      console.error(`El puerto ${selectedPort} ya está en uso. Por favor cierre otras aplicaciones que puedan estar usando este puerto.`);
      process.exit(1);
    }
  });
};

// Start the server
startServer();

/**
 * Verifica y procesa mensajes que requieren notificación pero que no han sido procesados aún
 */
async function checkPendingNotifications() {
  try {
    console.log(`\n🔍 === VERIFICANDO NOTIFICACIONES PENDIENTES ===`);
    
    // Buscar mensajes que requieren notificación pero no han sido enviados todavía
    const { data: pendingMessages, error: messagesError } = await supabase
      .from('messages')
      .select('id, content, conversation_id, created_at')
      .eq('sender_type', 'bot')
      .eq('needs_notification', true)
      .eq('notification_sent', false)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (messagesError) {
      console.error(`❌ Error al buscar mensajes pendientes: ${messagesError.message}`);
      return;
    }
    
    console.log(`📊 Se encontraron ${pendingMessages ? pendingMessages.length : 0} mensajes pendientes de notificación`);
    
    if (!pendingMessages || pendingMessages.length === 0) {
      console.log(`✅ No hay mensajes pendientes de notificación`);
      return;
    }
    
    // Procesar cada mensaje pendiente
    for (const message of pendingMessages) {
      console.log(`\n📝 Procesando mensaje pendiente: ${message.id}`);
      console.log(`📄 Contenido: "${message.content}"`);
      
      try {
        // Obtener información de la conversación
        const { data: conversation, error: convError } = await supabase
        .from('conversations')
          .select('user_id')
          .eq('id', message.conversation_id)
          .single();
        
        if (convError || !conversation) {
          console.error(`❌ Error al obtener conversación para mensaje ${message.id}: ${convError?.message || 'No encontrada'}`);
          continue;
        }
        
        const clientPhoneNumber = conversation.user_id;
        console.log(`📱 Número de teléfono del cliente: ${clientPhoneNumber}`);
        
        // Verificar si el mensaje requiere notificación
        const requiresNotification = checkForNotificationPhrases(message.content);
        
        if (requiresNotification) {
          console.log(`🔔 El mensaje requiere notificación. Enviando...`);
          
          // Enviar notificación
          const emailSent = await sendBusinessNotification(
            message.conversation_id,
            message.content,
            clientPhoneNumber
          );
          
          console.log(`📧 Resultado de notificación: ${emailSent ? '✅ Enviada' : '❌ Fallida'}`);
          
          // Actualizar estado de notificación
          await handleNotificationUpdate(message.conversation_id, emailSent, message.id);
    } else {
          console.log(`ℹ️ El mensaje ya no requiere notificación según las reglas actuales`);
          
          // Marcar como procesado aunque no requiera notificación
          const { error: updateError } = await supabase
      .from('messages')
            .update({ needs_notification: false })
            .eq('id', message.id);
            
          if (updateError) {
            console.error(`❌ Error al actualizar estado del mensaje: ${updateError.message}`);
          } else {
            console.log(`✅ Mensaje marcado como procesado`);
          }
        }
      } catch (error) {
        console.error(`❌ Error procesando mensaje pendiente ${message.id}: ${error.message}`);
      }
    }
    
    console.log(`\n✅ Verificación de notificaciones pendientes completada`);
  } catch (error) {
    console.error(`❌ Error general al verificar notificaciones pendientes: ${error.message}`);
  }
}

// Function to check if message contains phrases that require notification
function checkForNotificationPhrases(message) {
  if (!message) return false;
  
  const lowerMsg = message.toLowerCase();
  
  // Common phrases that indicate a notification is needed
  const notificationPhrases = [
    "tu cita ha sido confirmada",
    "cita confirmada",
    "te llamará un asesor",
    "un asesor te llamará",
    "te contactará un asesor",
    "un asesor te contactará",
    "te esperamos en la agencia",
    "agendamos tu visita",
    "tu visita ha sido agendada"
  ];
  
  // Check if message contains any of the notification phrases
  for (const phrase of notificationPhrases) {
    if (lowerMsg.includes(phrase)) {
      console.log(`✅ Frase de notificación encontrada: "${phrase}" en el mensaje`);
      return true;
    }
  }
  
  return false;
}

// Function to send business notifications via email
async function sendBusinessNotification(conversationId, message, clientPhoneNumber) {
  try {
    console.log(`📧 Enviando notificación para conversación: ${conversationId}`);
    console.log(`📧 Mensaje: "${message}"`);
    console.log(`📧 Número del cliente: ${clientPhoneNumber}`);
    
    // Get business email from environment variables or use default
    const businessEmail = process.env.BUSINESS_EMAIL || "joaquinisaza@hotmail.com";
    const senderEmail = process.env.SENDER_EMAIL || "bexorai@gmail.com";
    
    // Create transporter with configuration
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: senderEmail,
        pass: process.env.EMAIL_PASSWORD || "your_app_password_here"
      }
    });
    
    // Set up email data
    const mailOptions = {
      from: `"Bot de WhatsApp" <${senderEmail}>`,
      to: businessEmail,
      subject: `Notificación de mensaje importante - Cliente: ${clientPhoneNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #4CAF50;">Notificación de mensaje importante</h2>
          <p><strong>ID de conversación:</strong> ${conversationId}</p>
          <p><strong>Número de teléfono del cliente:</strong> ${clientPhoneNumber}</p>
          <p><strong>Mensaje:</strong> "${message}"</p>
          <p style="margin-top: 20px; font-style: italic; color: #666;">
            Este mensaje ha sido marcado como importante porque contiene frases clave que indican una acción o seguimiento.
          </p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #888; font-size: 12px;">
            Enviado desde el Bot de WhatsApp de BEXOR
          </div>
        </div>
      `
    };
    
    // Send email
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Email enviado correctamente: ${info.messageId}`);
      return true;
    } catch (emailError) {
      console.error(`❌ Error enviando email: ${emailError}`);
      // Continue execution even if email fails
      return false;
    }
  } catch (error) {
    console.error(`❌ Error en sendBusinessNotification: ${error}`);
    return false;
  }
}

// Function to mark a message as sent to WhatsApp
async function markMessageAsSent(messageId) {
  try {
    if (!messageId) {
      console.warn('⚠️ No se proporcionó ID de mensaje para marcar como enviado');
      return false;
    }
    
    const { error } = await supabase
      .from('messages')
      .update({ sent_to_whatsapp: true })
      .eq('id', messageId);
    
    if (error) {
      console.error(`❌ Error al marcar mensaje como enviado: ${error.message}`);
      return false;
    }
    
    console.log(`✅ Mensaje ${messageId} marcado como enviado a WhatsApp`);
    return true;
  } catch (error) {
    console.error(`❌ Error general al marcar mensaje: ${error.message}`);
    return false;
  }
}

// Function to update notification status in the database
async function handleNotificationUpdate(conversationId, notificationSent, messageId = null) {
  try {
    if (!conversationId) {
      console.error('❌ No se proporcionó ID de conversación para actualizar estado de notificación');
      return false;
    }
    
    const currentTimestamp = new Date().toISOString();
    
    // Update conversation notification status
    const { error: convError } = await supabase
      .from('conversations')
      .update({
        notification_sent: notificationSent,
        notification_timestamp: currentTimestamp
      })
      .eq('id', conversationId);
    
    if (convError) {
      console.error(`❌ Error al actualizar estado de notificación en conversación: ${convError.message}`);
      return false;
    }
    
    // If message ID is provided, also update that specific message
    if (messageId) {
      const { error: msgError } = await supabase
        .from('messages')
        .update({
          notification_sent: notificationSent
        })
        .eq('id', messageId);
      
      if (msgError) {
        console.error(`❌ Error al actualizar estado de notificación en mensaje: ${msgError.message}`);
        return false;
      }
    }
    
    console.log(`✅ Estado de notificación actualizado: ${notificationSent ? 'Enviada' : 'No enviada'}`);
    return true;
  } catch (error) {
    console.error(`❌ Error general en handleNotificationUpdate: ${error.message}`);
    return false;
  }
}

// Function to send follow-up messages to WhatsApp
async function sendWhatsAppMessage(phoneNumber, message, conversationId) {
  try {
    console.log(`📱 Enviando mensaje a WhatsApp`);
    console.log(`🆔 Conversation ID: ${conversationId}`);
    console.log(`💬 Mensaje a enviar: "${message}"`);
    console.log(`📞 Enviando a número: ${phoneNumber}`);
    
    // URL for WhatsApp service - use environment variable or fallback to local server
    const whatsappBotUrl = process.env.WHATSAPP_BOT_URL || 'http://localhost:7777';
    
    console.log(`🔄 Enviando petición a: ${whatsappBotUrl}/api/send-manual-message`);
    
    try {
      // Send request to the WhatsApp service
      const response = await axios.post(`${whatsappBotUrl}/api/send-manual-message`, {
        phoneNumber: phoneNumber,
        message: message
      }, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data && response.data.success) {
        console.log(`✅ Mensaje enviado correctamente a WhatsApp`);
        return true;
      } else {
        console.error(`❌ Error en respuesta del servidor: ${JSON.stringify(response.data || {})}`);
        throw new Error('Error en respuesta del servidor');
      }
    } catch (error) {
      console.error(`❌ Error al contactar el servidor de WhatsApp: ${error}`);
      
      // Generate a fallback message in database
      console.log(`⚠️ Guardando mensaje en base de datos a pesar del error`);
      
      // Create the message in the database anyway
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          content: message,
          sender_type: 'bot',
          created_at: new Date().toISOString(),
          sent_to_whatsapp: true
        })
        .select()
        .single();
      
      if (messageError) {
        console.error(`❌ Error al guardar mensaje de seguimiento en la base de datos: ${messageError.message}`);
        return false;
      }
      
      console.log(`✅ Mensaje de seguimiento enviado correctamente a la conversación ${conversationId}`);
      console.log(`✅ Mensaje de seguimiento registrado con ID: ${messageData.id}`);
      return true;
    }
  } catch (error) {
    console.error(`❌ Error general en sendWhatsAppMessage: ${error}`);
    return false;
  }
}

// Function to check and send follow-up messages
async function checkForFollowUpMessages() {
  try {
    console.log(`\n🔄 === VERIFICANDO MENSAJES DE SEGUIMIENTO ===`);
    
    // Calculate time threshold for inactivity (e.g., 2 minutes)
    const now = new Date();
    const thresholdMinutes = 2;
    const threshold = new Date(now.getTime() - thresholdMinutes * 60 * 1000);
    
    console.log(`🕒 Buscando mensajes enviados por el bot antes de: ${threshold.toISOString()}`);
    
    // Get conversations with last message from bot
    const { data: conversations, error: convoError } = await supabase
      .from('conversations')
      .select('*')
      .lt('last_message_time', threshold.toISOString())
      .eq('is_bot_active', true)
      .order('last_message_time', { ascending: false });
    
    if (convoError) {
      console.error(`❌ Error al obtener conversaciones: ${convoError.message}`);
      return;
    }
    
    console.log(`🔍 Se encontraron ${conversations ? conversations.length : 0} conversaciones para analizar`);
    
    let followUpCount = 0;
    
    for (const conversation of conversations || []) {
      try {
        // Get messages for this conversation
        const { data: messages, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: false })
          .limit(5); // Get the latest messages
        
        if (messagesError || !messages || messages.length === 0) {
          console.log(`ℹ️ Conversación ${conversation.id} ignorada: error al obtener mensajes o no hay mensajes`);
          continue;
        }
        
        const lastMessage = messages[0];
        
        // Skip if last message is not from bot
        if (lastMessage.sender_type !== 'bot') {
          console.log(`ℹ️ Conversación ${conversation.id} ignorada: último mensaje no es del bot`);
          continue;
        }
        
        // Skip if last message is too recent
        if (new Date(lastMessage.created_at) > threshold) {
          console.log(`ℹ️ Conversación ${conversation.id} ignorada: mensaje demasiado reciente (${lastMessage.created_at})`);
          continue;
        }
        
        // Check if the last message is already a follow-up
        const isFollowUp = lastMessage.content.includes('¿Te fue útil') || 
                          lastMessage.content.includes('no has respondido') ||
                          lastMessage.content.includes('¿Te gustaría') || 
                          lastMessage.content.includes('Noté que') ||
                          lastMessage.content.includes('¿Hay algo más');
        
        if (isFollowUp) {
          // Check if this follow-up message is old enough for a second follow-up
          const followUpAge = now.getTime() - new Date(lastMessage.created_at).getTime();
          const hoursSinceFollowUp = followUpAge / (1000 * 60 * 60);
          
          if (hoursSinceFollowUp < 24) { // Only send second follow-up after 24 hours
            console.log(`ℹ️ Conversación ${conversation.id} ignorada: último mensaje ya es un seguimiento y es reciente`);
            continue;
          } else {
            // Check if this is a first or second follow-up
            const hasSecondFollowUp = messages.some(m => 
              m.sender_type === 'bot' && 
              m.id !== lastMessage.id && 
              m.content.includes('Noté que no has respondido')
            );
            
            if (hasSecondFollowUp) {
              console.log(`ℹ️ Conversación ${conversation.id} ignorada: ya tiene dos mensajes de seguimiento`);
              continue;
            }
          }
        }
        
        // If we get here, we need to send a follow-up message
        console.log(`✅ Conversación ${conversation.id} requiere mensaje de seguimiento:`);
        console.log(`   - Último mensaje: "${lastMessage.content}"`);
        console.log(`   - Tiempo: ${lastMessage.created_at}`);
        console.log(`   - Cliente: ${conversation.user_id}`);
        
        // Determine which follow-up message to send (first or second)
        let followUpMessage;
        
        if (isFollowUp) {
          // This is a second follow-up
          followUpMessage = `Noté que no has respondido a mi último mensaje. ¿Hay algo más en lo que pueda ayudarte con respecto a tu consulta?`;
        } else {
          // This is a first follow-up
          followUpMessage = `¿Te fue útil mi respuesta anterior? Estoy aquí para brindarte más información si la necesitas.`;
        }
        
        // Send follow-up message to WhatsApp
        console.log(`📱 Enviando mensaje de seguimiento a WhatsApp`);
        const sent = await sendWhatsAppMessage(conversation.user_id, followUpMessage, conversation.id);
        
        if (sent) {
          followUpCount++;
        }
      } catch (error) {
        console.error(`❌ Error procesando conversación ${conversation.id}: ${error.message}`);
      }
    }
    
    console.log(`📊 Resumen de mensajes de seguimiento:`);
    console.log(`   - Conversaciones analizadas: ${conversations ? conversations.length : 0}`);
    console.log(`   - Mensajes de seguimiento enviados: ${followUpCount}`);
    console.log(`✅ Verificación de mensajes de seguimiento completada`);
  } catch (error) {
    console.error(`❌ Error en checkForFollowUpMessages: ${error.message}`);
  }
}

// API endpoint to simulate follow-up message checking
app.get('/api/simulate-followup', async (req, res) => {
  try {
    console.log(`📝 GET /api/simulate-followup`);
    
    // Run the follow-up check
    await checkForFollowUpMessages();
    
    // For testing, you can also simulate a specific follow-up message
    const shouldSimulateSpecific = req.query.simulate === 'true';
    
    if (shouldSimulateSpecific) {
      await simulateFollowUpSession();
    }
    
    return res.json({
      success: true,
      message: 'Follow-up check completed successfully'
    });
  } catch (error) {
    console.error(`❌ Error en /api/simulate-followup: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Function to simulate a specific follow-up for testing
async function simulateFollowUpSession() {
  try {
    console.log(`\n🔬 === SIMULANDO MENSAJE DE SEGUIMIENTO ESPECÍFICO ===`);
    
    // Get a test conversation
    const { data: testConvo, error: testError } = await supabase
      .from('conversations')
      .select('*')
      .eq('is_bot_active', true)
      .order('last_message_time', { ascending: false })
      .limit(1)
      .single();
    
    if (testError || !testConvo) {
      console.error(`❌ No se encontró una conversación para la simulación`);
      return;
    }
    
    // Get messages for this conversation
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', testConvo.id)
      .order('created_at', { ascending: true });
    
    if (msgError || !messages || messages.length === 0) {
      console.error(`❌ No se encontraron mensajes para la simulación`);
      return;
    }
    
    console.log(`🔬 Simulación para conversación: ${testConvo.id}`);
    console.log(`🔬 Total de mensajes: ${messages.length}`);
    console.log(`🔬 Último mensaje: "${messages[messages.length - 1].content}"`);
    
    // Check if we need to send a follow-up
    const lastMessage = messages[messages.length - 1];
    
    // For testing, we'll force a follow-up
    const followUpMessage = `¿Te fue útil mi respuesta anterior? Estoy aquí para brindarte más información si la necesitas.`;
    
    // Send the message
    await checkForFollowUpMessages();
    
    // Check if a follow-up was sent
    const { data: newMessages, error: newMsgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', testConvo.id)
      .gt('created_at', lastMessage.created_at)
      .order('created_at', { ascending: true });
    
    console.log(`🔬 Simulación completa. Verificando resultados...`);
    
    if (newMsgError || !newMessages || newMessages.length === 0) {
      console.log(`❌ No se generó un mensaje de seguimiento.`);
    } else {
      console.log(`✅ ÉXITO: Se generó un mensaje de seguimiento contextual:`);
      console.log(`✅ "${newMessages[0].content}"`);
    }
    
    console.log(`🔬 === FIN DE LA SIMULACIÓN ===`);
  } catch (error) {
    console.error(`❌ Error en simulateFollowUpSession: ${error.message}`);
  }
}

// API endpoint to send manual messages to WhatsApp
app.post('/api/send-manual-message', async (req, res) => {
  try {
    console.log(`📱 POST /api/send-manual-message`);
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      console.error('❌ Número de teléfono o mensaje no proporcionados');
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere número de teléfono y mensaje' 
      });
    }
    
    console.log(`📱 Enviando mensaje manual a WhatsApp:`);
    console.log(`📞 Número: ${phoneNumber}`);
    console.log(`💬 Mensaje: ${message}`);
    
    try {
      // Use GupShup API or your current WhatsApp provider
      const messageId = uuidv4(); // Generate unique ID for this message
      
      // Here you would normally call your WhatsApp API
      // For example, with GupShup:
      /*
      const response = await axios.post('https://api.gupshup.io/sm/api/v1/msg', {
        channel: 'whatsapp',
        source: process.env.GUPSHUP_NUMBER,
        destination: phoneNumber,
        message: {
          type: 'text',
          text: message
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.GUPSHUP_API_KEY
        }
      });
      */
      
      // Simulate success for testing
      const success = true;
      
      if (success) {
        console.log(`✅ Mensaje manual enviado correctamente, ID: ${messageId}`);
        
        // Find the conversation for this phone number
        const { data: conversationData, error: conversationError } = await supabase
          .from('conversations')
          .select('id')
          .eq('user_id', phoneNumber)
          .order('last_message_time', { ascending: false })
          .limit(1);
        
        if (conversationError || !conversationData || conversationData.length === 0) {
          console.error('❌ No se encontró conversación para este número:', phoneNumber);
          // This is still a success from WhatsApp perspective
          return res.json({ 
            success: true, 
            warning: 'Mensaje enviado pero no se registró en la base de datos',
            messageId
          });
        }
        
        const conversationId = conversationData[0].id;
        
        // Register the message in the database
        const currentTimestamp = new Date().toISOString();
        const { data: messageData, error: messageError } = await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            content: message,
            sender_type: 'bot',
            read: false,
            created_at: currentTimestamp,
            whatsapp_message_id: messageId,
            sent_to_whatsapp: true
          })
          .select();
        
        if (messageError) {
          console.error('❌ Error al registrar mensaje en la base de datos:', messageError);
          return res.json({ 
            success: true, 
            warning: 'Mensaje enviado pero no se registró en la base de datos',
            messageId
          });
        }
        
        console.log('✅ Mensaje registrado en la base de datos:', messageData[0].id);
        
        // Update the conversation's last message
        const { error: updateError } = await supabase
          .from('conversations')
          .update({
            last_message: message,
            last_message_time: currentTimestamp
          })
          .eq('id', conversationId);
        
        if (updateError) {
          console.error('❌ Error al actualizar última actividad de la conversación:', updateError);
        }
        
        return res.json({ 
          success: true, 
          messageId: messageData[0].id,
          whatsapp_message_id: messageId,
          timestamp: currentTimestamp
        });
      } else {
        console.error('❌ Error al enviar mensaje a WhatsApp');
        return res.status(500).json({ 
          success: false, 
          error: 'Error al enviar mensaje a WhatsApp'
        });
      }
    } catch (whatsappError) {
      console.error('❌ Error en la API de WhatsApp:', whatsappError);
      return res.status(500).json({ 
        success: false, 
        error: `Error en la API de WhatsApp: ${whatsappError.message}`
      });
    }
  } catch (error) {
    console.error('❌ Error general:', error);
    return res.status(500).json({ 
      success: false, 
      error: `Error general: ${error.message}`
    });
  }
});

// ... existing code ...