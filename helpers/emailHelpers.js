// Funciones de ayuda para el envío de emails
const nodemailer = require('nodemailer');

// Credenciales para enviar correos
const EMAIL_USER = process.env.EMAIL_USER || 'bexorai@gmail.com';
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD || 'gqwiakerjgrnkylf';
const TARGET_EMAIL = 'joaquinisaza@hotmail.com';
const BCC_EMAIL = 'copia@brexor.com';

// Crear transporter para nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASSWORD
  }
});

/**
 * Envía una notificación por correo electrónico
 * @param {Object} data - Información sobre la notificación
 * @param {string} data.phone - Número de teléfono
 * @param {string} data.message - Mensaje que generó la notificación
 * @param {string} data.conversationId - ID de la conversación
 * @param {string} data.businessName - Nombre del negocio
 * @param {string} data.businessId - ID del negocio
 * @returns {Promise<boolean>} - True si el correo se envió correctamente
 */
async function sendEmailNotification(data) {
  try {
    console.log(`📧 INICIANDO ENVÍO DE NOTIFICACIÓN PARA: ${data.phone}`);
    console.log(`📧 Mensaje: "${data.message}"`);
    
    // ID de conversación (usar el proporcionado o uno ficticio)
    const conversationId = data.conversationId || '4a42aa05-2ffd-418b-aa52-29e7c571eee8';
    const businessName = data.businessName || 'Cliente';
    
    // Formato del correo electrónico
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0;">🔔 Notificación de Cliente - IMPORTANTE</h2>
        </div>
        
        <div style="padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #3498db;">
            <h3 style="margin-top: 0; color: #34495e; margin-bottom: 10px;">Datos del Cliente</h3>
            <p style="margin: 0;"><strong>Teléfono:</strong> ${data.phone}</p>
            <p style="margin: 0;"><strong>Negocio:</strong> ${businessName}</p>
            <p style="margin: 0;"><strong>ID Conversación:</strong> ${conversationId}</p>
            <p style="margin: 0;"><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #34495e; margin-bottom: 10px;">Mensaje que Generó la Notificación</h3>
            <div style="background-color: #e6f7ff; padding: 15px; border-radius: 5px; border-left: 4px solid #2196f3;">
              ${data.message}
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Opciones del correo
    const mailOptions = {
      from: `"Bot de WhatsApp 🤖" <${EMAIL_USER}>`,
      to: TARGET_EMAIL,
      subject: `🔔 Notificación de Cliente - ${data.phone} - ${businessName}`,
      html: emailContent
    };
    
    // Agregar BCC si está disponible
    if (BCC_EMAIL) {
      mailOptions.bcc = BCC_EMAIL;
    }
    
    console.log(`📧 Enviando correo a: ${TARGET_EMAIL}`);
    
    // Enviar correo
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ CORREO ENVIADO EXITOSAMENTE: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Error al enviar notificación:', error);
    return false;
  }
}

module.exports = {
  sendEmailNotification
}; 