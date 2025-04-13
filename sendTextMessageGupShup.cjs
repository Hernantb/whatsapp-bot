// Función para enviar mensajes de texto usando GupShup
const axios = require('axios');
require('dotenv').config();

async function sendTextMessageGupShup(phoneNumber, message) {
  try {
    // Obtener credenciales de variables de entorno con fallbacks
    const apiKey = process.env.GUPSHUP_API_KEY;
    
    // Soportar diferentes nombres de variables para el número de origen
    const source = process.env.GUPSHUP_SOURCE_PHONE || 
                  process.env.GUPSHUP_NUMBER || 
                  process.env.GUPSHUP_SOURCE || 
                  process.env.GUPSHUP_PHONE_NUMBER;
    
    // Soportar diferentes nombres para userid
    const userid = process.env.GUPSHUP_USERID || 
                  process.env.GUPSHUP_USER_ID;
    
    // Validar que tenemos las credenciales mínimas
    if (!apiKey) {
      console.error('❌ ERROR CRÍTICO: Falta GUPSHUP_API_KEY en variables de entorno');
      throw new Error('Falta la API KEY de GupShup');
    }
    
    if (!source) {
      console.error('❌ ERROR CRÍTICO: Falta número de origen (GUPSHUP_NUMBER/GUPSHUP_SOURCE_PHONE) en variables de entorno');
      throw new Error('Falta el número de origen de GupShup');
    }
    
    if (!userid) {
      console.error('❌ ERROR CRÍTICO: Falta GUPSHUP_USERID en variables de entorno');
      throw new Error('Falta el USER ID de GupShup');
    }
    
    // Mostrar datos disponibles para depuración
    console.log('🔍 Datos de GupShup disponibles:');
    console.log(`- API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 5)}`);
    console.log(`- Source Phone: ${source}`);
    console.log(`- User ID: ${userid.substring(0, 8)}...`);
    
    // Normalizar número de teléfono (asegurarse que tiene formato correcto)
    let normalizedPhone = phoneNumber;
    
    // Si empieza con +, dejarlo así; si no, añadirlo
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
    
    // Log de datos a enviar para depuración
    console.log('📝 Datos enviados a GupShup:');
    console.log('- channel: whatsapp');
    console.log(`- source: ${source}`);
    console.log(`- destination: ${normalizedPhone}`);
    console.log(`- message: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
    console.log(`- src.name: ${process.env.GUPSHUP_APP_NAME || 'BEXOR_WhatsApp'}`);
    
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
    
    const response = await axios.post(url, data, config);
    
    if (response.data) {
      console.log(`✅ Mensaje enviado exitosamente a ${normalizedPhone}`);
      console.log(`📊 Respuesta de GupShup: ${JSON.stringify(response.data)}`);
      return {
        success: true, 
        messageId: response.data.messageId || `gupshup-${Date.now()}`,
        status: response.data.status || 'sent',
        responseData: response.data
      };
    } else {
      console.error('❌ La API de GupShup no retornó datos');
      throw new Error('No se recibió respuesta de GupShup');
    }
  } catch (error) {
    if (error.response) {
      // Error de respuesta de la API
      console.error(`❌ Error de API GupShup (${error.response.status}):`, error.response.data);
      throw new Error(`Error ${error.response.status} de GupShup: ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      // Error de red (no se recibió respuesta)
      console.error('❌ Error de red al contactar API de GupShup:', error.message);
      throw new Error(`Error de red al contactar API de GupShup: ${error.message}`);
    } else {
      // Otro tipo de error
      console.error(`❌ Error enviando mensaje a ${phoneNumber}:`, error.message);
      throw error;
    }
  }
}

module.exports = { sendTextMessageGupShup };