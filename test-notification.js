#!/usr/bin/env node
/**
 * Script para probar el sistema de notificaciones de forma independiente
 * 
 * Este script envía un mensaje que activará una notificación y prueba
 * que el sistema de notificaciones funcione correctamente.
 * 
 * Uso:
 *   node test-notification.js [phoneNumber] [mensaje]
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

// Constantes y configuración
const PHONE_NUMBER = process.argv[2] || '5212221192568';
const MESSAGE = process.argv[3] || '¡Perfecto! Tu cita ha sido confirmada para hoy a las 10:00 AM';
const FORCED = process.argv[4] === 'true';
const CONVERSATION_ID = '4a42aa05-2ffd-418b-aa52-29e7c571eee8'; // ID de prueba

// Configurar transporter de email
const EMAIL_CONFIG = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  defaultFrom: `"Bot de WhatsApp 🤖" <${process.env.EMAIL_USER || 'bot@example.com'}>`,
  recipients: process.env.NOTIFICATION_EMAIL ? 
    [process.env.NOTIFICATION_EMAIL] : 
    ['joaquinisaza@hotmail.com'],
  bcc: process.env.NOTIFICATION_BCC ? 
    [process.env.NOTIFICATION_BCC] : 
    ['copia@brexor.com']
};

// Configurar Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Función para verificar si un mensaje requiere notificación
 */
function checkForNotificationPhrases(message) {
  console.log(`🔍 Verificando si el mensaje requiere notificación: "${message}"`);
  
  // Patrones que indican necesidad de notificación
  const patterns = [
    /perfecto.*cita ha sido confirmada/i,
    /perfecto.*asesor te llamar/i,
    /perfecto.*asesor te contactar/i,
    /perfecto.*persona te contactar/i,
    /tu cita ha sido confirmada para/i,
    /cita.*confirmada para/i,
    /asesor te llamar/i,
    /asesor te contactar/i,
    /persona te contactar/i
  ];
  
  // Verificar cada patrón
  for (const pattern of patterns) {
    if (pattern.test(message)) {
      console.log(`✅ Coincidencia con patrón: ${pattern}`);
      return true;
    }
  }
  
  // Palabras clave que deben aparecer juntas
  const keywordGroups = [
    ['perfecto', 'cita', 'confirmada'],
    ['perfecto', 'asesor', 'llamar'],
    ['perfecto', 'asesor', 'contactar'],
    ['perfecto', 'persona', 'contactar']
  ];
  
  const normalizedMessage = message.toLowerCase();
  
  // Verificar grupos de palabras clave
  for (const group of keywordGroups) {
    const allKeywordsPresent = group.every(keyword => normalizedMessage.includes(keyword));
    if (allKeywordsPresent) {
      console.log(`✅ Coincidencia por palabras clave: ${group.join(' + ')}`);
      return true;
    }
  }
  
  console.log('❌ No se detectaron frases de notificación');
  return false;
}

/**
 * Función para enviar notificación por correo
 */
async function sendBusinessNotification(conversationId, message, phoneNumber) {
  console.log(`\n📧 ============= INICIANDO PROCESO DE NOTIFICACIÓN =============`);
  console.log(`📧 Conversación: ${conversationId}`);
  console.log(`📧 Teléfono cliente: ${phoneNumber}`);
  console.log(`📧 Mensaje: "${message}"`);
  
  try {
    // Obtener historial reciente de la conversación
    let conversationHistory = [];
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (!error && data) {
        conversationHistory = data.reverse();
        console.log(`📧 Historial obtenido: ${data.length} mensajes`);
      } else if (error) {
        console.error(`❌ Error al obtener historial: ${error.message}`);
      }
    } catch (dbError) {
      console.error(`❌ Error en consulta de historial: ${dbError.message}`);
    }
    
    // Formatear el historial de conversación para el correo
    const formattedHistory = conversationHistory.length > 0 ? 
      conversationHistory.map(msg => {
        const sender = msg.sender_type === 'user' ? 'Cliente' : 'Bot';
        const time = new Date(msg.created_at || Date.now()).toLocaleString();
        const content = msg.content || '(sin contenido)';
        
        return `<div style="margin-bottom: 10px; padding: 8px; border-radius: 5px; background-color: ${msg.sender_type === 'user' ? '#f0f0f0' : '#e6f7ff'};">
          <strong>${sender} (${time}):</strong><br/>
          ${content}
        </div>`;
      }).join('') : '<p>No hay mensajes recientes</p>';
    
    // Contenido del correo
    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Notificación: Conversación Requiere Atención</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background-color: #1976d2; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
        .content { padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
        .alert { background-color: #ffebee; border-left: 4px solid #f44336; padding: 10px 15px; margin: 10px 0; }
        .button { display: inline-block; background-color: #1976d2; color: white; text-decoration: none; padding: 10px 15px; border-radius: 4px; font-weight: bold; }
        .footer { margin-top: 30px; font-size: 12px; color: #777; }
        pre { background-color: #f5f5f5; padding: 10px; border-radius: 5px; white-space: pre-wrap; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0;">🔔 Prueba de Notificación</h2>
        </div>
        <div class="content">
          <p>Esta es una <strong>prueba del sistema de notificaciones</strong> para mensajes que requieren atención humana.</p>
          
          <div style="margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Detalles:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Número del cliente:</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${phoneNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">ID de conversación:</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${conversationId}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Fecha y hora:</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${new Date().toLocaleString()}</td>
              </tr>
            </table>
          </div>
          
          <div class="alert">
            <strong>Mensaje que activó la notificación:</strong>
            <pre>${message}</pre>
          </div>
          
          ${formattedHistory}
          
          <div class="footer">
            <p>Este es un mensaje automático de prueba del sistema de notificaciones.</p>
            <p>© ${new Date().getFullYear()} Sistema de Notificaciones de IA</p>
          </div>
        </div>
      </div>
    </body>
    </html>
    `;
    
    // Configurar transporte de correo
    const transporter = nodemailer.createTransport({
      host: EMAIL_CONFIG.host,
      port: EMAIL_CONFIG.port,
      secure: EMAIL_CONFIG.secure,
      auth: EMAIL_CONFIG.auth,
      tls: {
        rejectUnauthorized: false // Para desarrollo y pruebas
      }
    });
    
    // Verificar conexión con el servidor de correo
    await transporter.verify();
    console.log('📧 Conexión con servidor de correo verificada');
    
    // Opciones del correo
    const mailOptions = {
      from: EMAIL_CONFIG.defaultFrom,
      to: EMAIL_CONFIG.recipients.join(', '),
      subject: `🔔 PRUEBA - Atención requerida - Cliente ${phoneNumber}`,
      html: emailHtml,
      text: `Prueba de notificación: Conversación ${conversationId} con el cliente ${phoneNumber} requiere atención. Mensaje: ${message}`,
    };
    
    // Agregar BCC si está configurado
    if (EMAIL_CONFIG.bcc && EMAIL_CONFIG.bcc.length > 0) {
      mailOptions.bcc = EMAIL_CONFIG.bcc.join(', ');
    }
    
    // Enviar correo
    console.log('📧 Enviando notificación por correo a:', EMAIL_CONFIG.recipients.join(', '));
    const emailResult = await transporter.sendMail(mailOptions);
    console.log('✅ Notificación enviada correctamente:', emailResult.messageId);
    
    console.log(`\n📧 ============= PROCESO DE NOTIFICACIÓN COMPLETADO =============`);
    return true;
  } catch (error) {
    console.error(`❌ Error general en sendBusinessNotification:`, error);
    console.error(error.stack);
    return false;
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('🚨 === PRUEBA DE SISTEMA DE NOTIFICACIONES ===');
  console.log(`📱 Número: ${PHONE_NUMBER}`);
  console.log(`💬 Mensaje: "${MESSAGE}"`);
  console.log(`⚡ Forzar notificación: ${FORCED ? 'SÍ' : 'NO'}`);
  
  try {
    // Verificar si el mensaje requiere notificación
    const requiresNotification = FORCED || checkForNotificationPhrases(MESSAGE);
    console.log(`🔍 Resultado: ${requiresNotification ? '✅ REQUIERE NOTIFICACIÓN' : '❌ NO REQUIERE NOTIFICACIÓN'}`);
    
    // Si requiere notificación, enviar
    if (requiresNotification) {
      const notificationResult = await sendBusinessNotification(CONVERSATION_ID, MESSAGE, PHONE_NUMBER);
      console.log(`\n📝 Resumen de prueba:`);
      console.log(`  - Mensaje: "${MESSAGE}"`);
      console.log(`  - Requiere notificación: ${requiresNotification ? 'SÍ' : 'NO'}`);
      console.log(`  - Notificación enviada: ${notificationResult ? 'ÉXITO ✅' : 'FALLÓ ❌'}`);
      
      if (notificationResult) {
        console.log('\n✅ PRUEBA COMPLETADA EXITOSAMENTE: Sistema de notificaciones funciona correctamente!');
      } else {
        console.log('\n❌ PRUEBA FALLÓ: La notificación no pudo ser enviada');
      }
    } else {
      console.log('\n⚠️ El mensaje proporcionado no requiere notificación');
      console.log('  - Para forzar el envío de una notificación, pase "true" como tercer argumento');
      console.log('  - Ejemplo: node test-notification.js 5212221192568 "¡Perfecto! Tu cita ha sido confirmada" true');
    }
  } catch (error) {
    console.error('\n❌ ERROR EN LA PRUEBA:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar función principal
main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
}); 