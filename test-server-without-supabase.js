/**
 * Servidor de prueba para el sistema de notificaciones de WhatsApp
 * Este servidor funciona sin depender de Supabase, utilizando una base de datos en memoria
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Configuración del servidor
const app = express();
app.use(cors());
app.use(express.json());
const PORT = 3095;

// Base de datos en memoria
const memoryDB = {
  conversations: new Map(),
  notifications: [],
  addConversation(phoneNumber, messages) {
    if (!this.conversations.has(phoneNumber)) {
      this.conversations.set(phoneNumber, []);
    }
    this.conversations.get(phoneNumber).push(...messages);
    
    // Mantener solo los últimos 20 mensajes
    const conversationMessages = this.conversations.get(phoneNumber);
    if (conversationMessages.length > 20) {
      this.conversations.set(phoneNumber, conversationMessages.slice(-20));
    }
  },
  getConversation(phoneNumber) {
    return this.conversations.get(phoneNumber) || [];
  },
  addNotification(notification) {
    this.notifications.push({
      ...notification,
      id: this.notifications.length + 1,
      timestamp: new Date().toISOString()
    });
    return this.notifications[this.notifications.length - 1];
  },
  getNotifications() {
    return this.notifications;
  }
};

// Frases que indican necesidad de atención humana
const ATTENTION_PHRASES = [
  "Para resolver tu problema necesito que un humano te ayude", 
  "Lamentablemente no puedo ayudarte con eso",
  "Necesito que un agente humano te ayude",
  "Un agente te contactará",
  "Un agente humano revisará",
  "Necesito transferirte",
  "Te transferiré",
  "Un agente humano continuará",
  "Es mejor que hables con un humano",
  "Un representante continuará",
  "Necesitas hablar con un representante",
  "Un humano te contactará",
  "No tengo esa información",
  "No puedo resolver",
  "Te pasaré con un humano"
];

// Configuración de nodemailer para pruebas
const testTransporter = nodemailer.createTransport({
  host: 'smtp.ethereal.email',
  port: 587,
  auth: {
    user: process.env.EMAIL_USER || 'ethereal.user@ethereal.email',
    pass: process.env.EMAIL_PASS || 'etherealpassword'
  }
});

// Simular configuración GupShup
const GUPSHUP_CONFIG = {
  apiKey: process.env.GUPSHUP_API_KEY || 'test-api-key',
  appName: process.env.GUPSHUP_APP_NAME || 'TestApp',
  sourceNumber: process.env.GUPSHUP_SOURCE || '917834811114'
};

// Función para verificar si un mensaje necesita notificación
function checkForNotificationPhrases(message) {
  const lowerMessage = message.toLowerCase();
  
  for (const phrase of ATTENTION_PHRASES) {
    if (lowerMessage.includes(phrase.toLowerCase())) {
      return {
        requiresNotification: true,
        matchedPhrase: phrase
      };
    }
  }
  
  return {
    requiresNotification: false,
    matchedPhrase: null
  };
}

// Función para enviar notificación por email
async function sendBusinessNotification(phoneNumber, message, reason) {
  console.log(`[NOTIFICATION] Intentando enviar notificación para ${phoneNumber}`);
  
  try {
    // Obtener historial de conversación
    const conversationHistory = memoryDB.getConversation(phoneNumber);
    
    // Formatear historial para email
    const formattedHistory = conversationHistory.map(msg => {
      return `<p><strong>${msg.role === 'user' ? 'Cliente' : 'Bot'}:</strong> ${msg.content}</p>`;
    }).join('\n');
    
    // Configurar correo
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'bot@whatsapp.test',
      to: process.env.EMAIL_TO || 'business@example.com',
      subject: `Atención requerida - Cliente: ${phoneNumber}`,
      html: `
        <h2>Atención requerida para el cliente ${phoneNumber}</h2>
        <p><strong>Razón:</strong> ${reason}</p>
        <p><strong>Último mensaje:</strong> ${message}</p>
        <h3>Historial de conversación:</h3>
        <div style="border: 1px solid #ddd; padding: 15px; max-height: 400px; overflow-y: auto;">
          ${formattedHistory}
        </div>
      `
    };
    
    // Enviar correo
    const info = await testTransporter.sendMail(mailOptions);
    
    // Registrar notificación exitosa
    const notification = memoryDB.addNotification({
      phoneNumber,
      message,
      reason,
      status: 'success',
      emailInfo: info.messageId
    });
    
    console.log(`[NOTIFICATION] Notificación enviada exitosamente para ${phoneNumber}. ID: ${notification.id}`);
    return { success: true, notification };
    
  } catch (error) {
    console.error(`[NOTIFICATION ERROR] Error al enviar notificación para ${phoneNumber}:`, error.message);
    
    // Registrar notificación fallida
    const notification = memoryDB.addNotification({
      phoneNumber,
      message,
      reason,
      status: 'failed',
      error: error.message
    });
    
    return { success: false, error: error.message, notification };
  }
}

// Procesar mensaje para notificación
async function processMessageForNotification(role, content, phoneNumber) {
  // Solo procesar mensajes del bot
  if (role !== 'assistant') {
    return { requiresNotification: false };
  }
  
  console.log(`[PROCESS] Verificando si el mensaje requiere notificación: "${content.substring(0, 50)}..."`);
  
  // Verificar si contiene frases de atención
  const { requiresNotification, matchedPhrase } = checkForNotificationPhrases(content);
  
  if (requiresNotification) {
    console.log(`[PROCESS] El mensaje requiere notificación. Frase detectada: "${matchedPhrase}"`);
    
    try {
      // Enviar notificación
      const notificationResult = await sendBusinessNotification(
        phoneNumber,
        content,
        `Frase detectada: "${matchedPhrase}"`
      );
      
      return {
        requiresNotification,
        notificationSent: notificationResult.success,
        reason: matchedPhrase,
        notificationId: notificationResult.notification.id
      };
      
    } catch (error) {
      console.error(`[PROCESS ERROR] Error en el proceso de notificación:`, error.message);
      return {
        requiresNotification,
        notificationSent: false,
        error: error.message
      };
    }
  }
  
  return { requiresNotification: false };
}

// Endpoints

// Estado del servidor
app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    memoryStats: {
      conversations: memoryDB.conversations.size,
      notifications: memoryDB.notifications.length
    }
  });
});

// Enviar mensaje
app.post('/api/send-message', async (req, res) => {
  const { phoneNumber, message, role = 'user' } = req.body;
  
  if (!phoneNumber || !message) {
    return res.status(400).json({ error: 'Se requiere número de teléfono y mensaje' });
  }
  
  try {
    // Agregar mensaje a la conversación
    const messageObj = { role, content: message, timestamp: new Date().toISOString() };
    memoryDB.addConversation(phoneNumber, [messageObj]);
    
    // Si es mensaje del bot, procesar para notificación
    let notificationResult = null;
    if (role === 'assistant') {
      notificationResult = await processMessageForNotification(role, message, phoneNumber);
    }
    
    res.json({
      success: true,
      message: messageObj,
      notification: notificationResult
    });
  } catch (error) {
    console.error('Error al procesar mensaje:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener conversación
app.get('/api/conversation/:phoneNumber', (req, res) => {
  const { phoneNumber } = req.params;
  const conversation = memoryDB.getConversation(phoneNumber);
  
  res.json({
    phoneNumber,
    messages: conversation
  });
});

// Obtener notificaciones
app.get('/api/notifications', (req, res) => {
  res.json(memoryDB.getNotifications());
});

// Forzar notificación
app.post('/api/force-notification', async (req, res) => {
  const { phoneNumber, message, reason } = req.body;
  
  if (!phoneNumber) {
    return res.status(400).json({ error: 'Se requiere número de teléfono' });
  }
  
  try {
    const result = await sendBusinessNotification(
      phoneNumber,
      message || 'Notificación forzada',
      reason || 'Solicitud manual'
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error al forzar notificación:', error);
    res.status(500).json({ error: error.message });
  }
});

// Simular envío de mensaje por WhatsApp
app.post('/api/simulate-whatsapp', async (req, res) => {
  const { phoneNumber, message } = req.body;
  
  if (!phoneNumber || !message) {
    return res.status(400).json({ error: 'Se requiere número de teléfono y mensaje' });
  }
  
  try {
    // Simular latencia de red
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Registrar mensaje entrante del usuario
    const userMessage = { role: 'user', content: message, timestamp: new Date().toISOString() };
    memoryDB.addConversation(phoneNumber, [userMessage]);
    
    // Generar respuesta simulada del bot
    let botResponse;
    
    // Simular respuesta con frase que requiere atención en base a palabras clave
    if (message.toLowerCase().includes('problema') || 
        message.toLowerCase().includes('ayuda') || 
        message.toLowerCase().includes('humano')) {
      botResponse = "Para resolver tu problema necesito que un humano te ayude. Un agente revisará tu caso pronto.";
    } else {
      botResponse = "Gracias por tu mensaje. ¿En qué más puedo ayudarte?";
    }
    
    // Registrar respuesta del bot
    const botMessage = { role: 'assistant', content: botResponse, timestamp: new Date().toISOString() };
    memoryDB.addConversation(phoneNumber, [botMessage]);
    
    // Procesar para notificación
    const notificationResult = await processMessageForNotification('assistant', botResponse, phoneNumber);
    
    res.json({
      success: true,
      userMessage,
      botResponse: botMessage,
      notification: notificationResult
    });
  } catch (error) {
    console.error('Error al simular WhatsApp:', error);
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor de prueba sin Supabase iniciado en http://localhost:${PORT}`);
  console.log(`
Endpoints disponibles:
- GET /status
- POST /api/send-message
- GET /api/conversation/:phoneNumber
- GET /api/notifications
- POST /api/force-notification
- POST /api/simulate-whatsapp
  `);
}); 