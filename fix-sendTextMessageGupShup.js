// Función para enviar mensajes de texto usando GupShup
async function sendTextMessageGupShup(phoneNumber, text) {
  if (!GUPSHUP_API_KEY || !GUPSHUP_USERID) {
    console.error('❌ Error: Credenciales de GupShup no configuradas');
    throw new Error('Credenciales de GupShup no configuradas');
  }
  
  // Asegurar que el número de teléfono tenga el formato correcto (solo dígitos)
  const formattedPhone = phoneNumber.replace(/\D/g, '');
  
  // Asegurar que el texto no sea nulo o indefinido
  const safeText = text || 'Mensaje sin contenido';
  
  console.log(`🔑 Credenciales a usar:`);
  console.log(`   API_KEY: ${GUPSHUP_API_KEY.substring(0, 5)}...${GUPSHUP_API_KEY.substring(GUPSHUP_API_KEY.length - 5)}`);
  console.log(`   USERID: ${GUPSHUP_USERID}`);
  console.log(`   NUMERO: ${GUPSHUP_NUMBER || 'No configurado (usando valor por defecto)'}`);
  
  try {
    // URL correcta del endpoint según la documentación
    const url = 'https://api.gupshup.io/wa/api/v1/msg';
    console.log(`🔗 URL del endpoint: ${url}`);
    
    // Crear el cuerpo del mensaje en el formato correcto
    const messageBody = JSON.stringify({
      type: 'text',
      text: safeText
    });
    
    console.log(`📝 Contenido del mensaje: ${messageBody}`);
    
    // Crear FormData para la solicitud
    const formData = new URLSearchParams();
    formData.append('channel', 'whatsapp');
    formData.append('source', GUPSHUP_NUMBER || '917834811114');
    formData.append('destination', formattedPhone);
    formData.append('message', messageBody);
    formData.append('src.name', 'SeatManager');
    
    console.log(`📤 FormData preparado: ${formData.toString()}`);
    
    // Configuración completa de la solicitud
    const config = {
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded',
        'apikey': GUPSHUP_API_KEY,
        'userid': GUPSHUP_USERID
      }
    };
    
    console.log(`🌐 Enviando solicitud HTTP POST a GupShup...`);
    
    // Enviar solicitud a GupShup
    const makeRequest = async () => {
      return await axios.post(url, formData, config);
    };
    const response = await makeRequest();
    
    console.log(`✅ Respuesta recibida de GupShup: ${response.status}`);
    console.log(`📄 Datos de respuesta:`, response.data);
    
    return response.data;
  } catch (error) {
    console.error(`❌ Error al enviar mensaje a GupShup:`, error);
    throw error;
  }
}

// Exportar la función para ser usada
module.exports = { sendTextMessageGupShup }; 