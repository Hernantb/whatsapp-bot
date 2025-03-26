// Script para enviar un mensaje a WhatsApp sin iniciar el servidor
require('dotenv').config();
const axios = require('axios');

// Configuración de GupShup
const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
const GUPSHUP_NUMBER = process.env.GUPSHUP_NUMBER;

// Función para enviar respuesta a WhatsApp
async function sendWhatsAppMessage(recipient, message) {
  try {
    console.log(`📤 Enviando mensaje a ${recipient}: "${message}"`);
    
    // API v1 de GupShup - Método que funciona
    const apiUrl = 'https://api.gupshup.io/wa/api/v1/msg';
    const apiKey = GUPSHUP_API_KEY;
    const source = GUPSHUP_NUMBER;
    
    console.log(`🔑 Usando API Key: ${apiKey}`);
    console.log(`📱 Desde número: ${source}`);
    console.log(`📱 Hacia número: ${recipient}`);
    
    const formData = new URLSearchParams();
    formData.append('channel', 'whatsapp');
    formData.append('source', source);
    formData.append('destination', recipient);
    formData.append('src.name', source);
    formData.append('message', JSON.stringify({
      type: 'text',
      text: message
    }));
    
    const headers = {
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/x-www-form-urlencoded',
      'apikey': apiKey
    };
    
    console.log('🔄 Enviando mensaje a WhatsApp...');
    
    const response = await axios.post(apiUrl, formData, { headers });
    
    console.log('📡 Respuesta:', JSON.stringify(response.data));
    
    if (response.status >= 200 && response.status < 300) {
      console.log('✅ Mensaje enviado correctamente');
      return true;
    } else {
      console.error(`❌ Error: Código de respuesta ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Error enviando mensaje:', error.message);
    
    if (error.response) {
      console.error('🔍 Detalles del error:', 
                  error.response.status, 
                  JSON.stringify(error.response.data));
    } else if (error.request) {
      console.error('🔍 No se recibió respuesta del servidor');
    } else {
      console.error('🔍 Error en la configuración de la solicitud:', error.message);
    }
    
    return false;
  }
}

// Obtener argumentos de la línea de comandos
const recipient = process.argv[2];
const message = process.argv[3];

if (!recipient || !message) {
  console.error('❌ Error: Debes proporcionar un número de teléfono y un mensaje');
  console.log('Uso: node send-message.js <número> "<mensaje>"');
  process.exit(1);
}

// Enviar el mensaje
sendWhatsAppMessage(recipient, message)
  .then(result => {
    process.exit(result ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Error inesperado:', error.message);
    process.exit(1);
  }); 