// Script independiente para probar envío de notificaciones por correo
require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('🚀 Iniciando prueba de envío de notificación por correo electrónico');

// Mensaje de prueba
const message = '¡Perfecto! Tu cita ha sido confirmada para hoy a las 10. Estoy aquí si requieres algo más.';
const phoneNumber = '5212221192568';
const conversationId = 'test-conversation-id';

// Crear transporter con Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'bexorai@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'gqwi aker jgrn kylf'
  },
  debug: true
});

console.log('📧 Configuración de transporter completada');

// Verificar configuración
transporter.verify(function(error, success) {
  if (error) {
    console.error('❌ Error en configuración de nodemailer:', error);
  } else {
    console.log('✅ Servidor SMTP listo para enviar correos');
    sendTestEmail();
  }
});

// Función para enviar correo de prueba
async function sendTestEmail() {
  try {
    console.log('📧 Preparando envío de correo de prueba...');
    
    // Contenido del correo
    const emailHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0;">🧪 PRUEBA DE NOTIFICACIÓN</h2>
        </div>
        
        <div style="padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #3498db;">
            <h3 style="margin-top: 0; color: #34495e; margin-bottom: 10px;">Datos de Prueba</h3>
            <p style="margin: 0;"><strong>Teléfono:</strong> ${phoneNumber}</p>
            <p style="margin: 0;"><strong>ID Conversación:</strong> ${conversationId}</p>
            <p style="margin: 0;"><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
          </div>
        
          <div style="margin-bottom: 20px;">
            <h3 style="color: #34495e; margin-bottom: 10px;">Mensaje de Prueba</h3>
            <div style="background-color: #e6f7ff; padding: 15px; border-radius: 5px; border-left: 4px solid #2196f3;">
              ${message}
            </div>
          </div>
        
          <div style="text-align: center; margin-top: 30px;">
            <p>Este es un correo de prueba enviado desde el script test-notif.js</p>
            <p>Script ejecutado a las ${new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </div>
    `;
    
    // Configurar opciones del correo
    const mailOptions = {
      from: `"Bot WhatsApp (PRUEBA DIRECTA) 🤖" <${process.env.EMAIL_USER || 'bexorai@gmail.com'}>`,
      to: process.env.NOTIFICATION_EMAIL || 'joaquinisaza@hotmail.com',
      subject: `🧪 PRUEBA DIRECTA: Notificación de Cliente - ${phoneNumber}`,
      html: emailHTML
    };
    
    console.log(`📧 Enviando a: ${mailOptions.to}`);
    
    // Enviar correo
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ CORREO ENVIADO EXITOSAMENTE`);
    console.log(`✅ ID del mensaje: ${info.messageId}`);
    console.log(`✅ URL de previsualización: ${nodemailer.getTestMessageUrl(info)}`);
    
    console.log('✅ PRUEBA COMPLETADA CON ÉXITO');
  } catch (error) {
    console.error('❌ ERROR AL ENVIAR CORREO:', error);
    console.error(error.stack);
  }
} 