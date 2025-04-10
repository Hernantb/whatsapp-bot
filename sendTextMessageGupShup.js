// Función para enviar mensajes de texto usando GupShup
const axios = require('axios');
require('dotenv').config();

async function sendTextMessageGupShup(phoneNumber, message) {
  try {
    // Obtener credenciales de variables de entorno
    const apiKey = process.env.GUPSHUP_API_KEY;
    const source = process.env.GUPSHUP_NUMBER || process.env.GUPSHUP_SOURCE_PHONE;
    const userid = process.env.GUPSHUP_USERID;
    
    // Verificar que todas las credenciales estén disponibles
    const missingCredentials = [];
    if (!apiKey) missingCredentials.push('GUPSHUP_API_KEY');
    if (!source) missingCredentials.push('GUPSHUP_NUMBER/GUPSHUP_SOURCE_PHONE');
    if (!userid) missingCredentials.push('GUPSHUP_USERID');
    
    if (missingCredentials.length > 0) {
      throw new Error(`Faltan credenciales de GupShup [${missingCredentials.join(', ')}]. No se puede enviar el mensaje.`);
    }
    
    // Normalizar número de teléfono (asegurarse que tiene formato correcto)
    let normalizedPhone = phoneNumber;
    if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = `+${normalizedPhone}`;
    }
    
    console.log(`📲 Enviando mensaje a WhatsApp (${normalizedPhone}) usando GupShup...`);
    
    // URL correcta para la API de WhatsApp de GupShup
    const url = 'https://api.gupshup.io/wa/api/v1/msg';
    
    const data = new URLSearchParams();
    data.append('channel', 'whatsapp');
    data.append('source', source);
    data.append('destination', normalizedPhone);
    data.append('message', JSON.stringify({
      type: 'text',
      text: message
    }));
    data.append('src.name', process.env.GUPSHUP_APP_NAME || 'BEXOR_WhatsApp');
    
    // Configuración con headers correctos incluyendo userid
    const config = {
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded',
        'apikey': apiKey,
        'userid': userid
      }
    };
    
    console.log('🔄 Enviando solicitud a API de GupShup...');
    console.log(`📝 URL: ${url}`);
    console.log(`📝 Headers: apikey: ${apiKey.substring(0, 5)}..., userid: ${userid}`);
    console.log(`📝 Destino: ${normalizedPhone}`);
    
    try {
      const response = await axios.post(url, data, config);
      
      if (response.data) {
        console.log(`✅ Mensaje enviado exitosamente a ${normalizedPhone}`);
        console.log(`📊 Respuesta de GupShup: ${JSON.stringify(response.data)}`);
        return {
          success: true, 
          simulated: false,
          messageId: response.data.messageId || `gupshup-${Date.now()}`,
          status: response.data.status || 'sent',
          responseData: response.data
        };
      } else {
        console.error('❌ La API de GupShup no retornó datos');
        throw new Error('No se recibió respuesta de GupShup');
      }
    } catch (apiError) {
      console.error(`❌ Error al enviar mensaje a GupShup:`);
      
      if (apiError.response) {
        console.error(`- Status: ${apiError.response.status}`);
        console.error(`- Datos: ${JSON.stringify(apiError.response.data)}`);
      } else {
        console.error(`- Error: ${apiError.message}`);
      }
      
      // Propagar el error para que se maneje adecuadamente
      throw new Error(`Error al enviar mensaje a GupShup: ${apiError.message}`);
    }
  } catch (error) {
    console.error(`❌ Error general en sendTextMessageGupShup:`, error.message);
    // Propagar el error
    throw error;
  }
}

module.exports = { sendTextMessageGupShup };