/**
 * Módulo simplificado para enviar mensajes de texto a través de GupShup
 * Compatible con la versión de node-fetch 2.x
 */
require('dotenv').config();
const fetch = require('node-fetch');

// Caché para deduplicación de mensajes en GupShup
const recentSentMessages = new Map();
const GUPSHUP_DEDUPE_TIMEOUT = 10000; // 10 segundos

/**
 * Envía un mensaje de texto a WhatsApp utilizando la API de GupShup
 * @param {string} phoneNumber - Número de teléfono del destinatario
 * @param {string} message - Mensaje a enviar
 * @returns {Promise<object>} - Resultado de la operación
 */
async function sendTextMessageGupShup(phoneNumber, message) {
  try {
    console.log(`🔄 Preparando envío de mensaje a ${phoneNumber}: "${message}"`);

    // Verificar duplicados recientes
    const messageKey = `${phoneNumber}-${message}`;
    if (recentSentMessages.has(messageKey)) {
      console.warn(`⚠️ DEDUPLICACIÓN: Mensaje idéntico enviado hace menos de 10 segundos`);
      const cachedResult = recentSentMessages.get(messageKey);
      console.log(`⚠️ Usando resultado en caché y evitando duplicado a GupShup`);
      
      return {
        ...cachedResult,
        deduplicado: true
      };
    }

    // Verificar si se debe deshabilitar la simulación
    const disableSimulation = process.env.DISABLE_WHATSAPP_SIMULATION === 'true';
    console.log(`⚙️ Modo de simulación: ${disableSimulation ? 'DESACTIVADO (se intentará envío real)' : 'ACTIVADO (podría simular el envío)'}`);

    // Credenciales de la API de GupShup
    const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
    const GUPSHUP_NUMBER = process.env.GUPSHUP_SOURCE_PHONE || process.env.GUPSHUP_NUMBER;
    const GUPSHUP_USERID = process.env.GUPSHUP_USERID;

    // Validar credenciales
    if (!GUPSHUP_API_KEY || !GUPSHUP_NUMBER || !GUPSHUP_USERID) {
      console.warn('⚠️ Credenciales de GupShup incompletas:');
      console.warn(`🔑 API Key: ${GUPSHUP_API_KEY ? '✅' : '❌'}`);
      console.warn(`📱 Número: ${GUPSHUP_NUMBER ? '✅' : '❌'}`);
      console.warn(`👤 User ID: ${GUPSHUP_USERID ? '✅' : '❌'}`);
      
      // Si la simulación está desactivada, devolvemos error
      if (disableSimulation) {
        console.error('❌ No se puede enviar mensaje real debido a credenciales incompletas y la simulación está desactivada');
        return {
          success: false,
          error: 'Credenciales de GupShup incompletas y la simulación está desactivada',
          simulated: false
        };
      }
      
      // Simular el envío con advertencia clara
      console.warn('⚠️ SIMULANDO ENVÍO debido a credenciales incompletas');
      return {
        success: true,
        error: 'Credenciales de GupShup incompletas - usando simulación',
        simulated: true,
        messageId: `simulated-${Date.now()}`
      };
    }

    // Normalizar el número de teléfono
    let destinationNumber = phoneNumber;
    if (!destinationNumber.startsWith('+')) {
      destinationNumber = '+' + destinationNumber;
    }

    // Preparar payload para GupShup
    const gupshupPayload = {
      channel: "whatsapp",
      source: GUPSHUP_NUMBER,
      destination: destinationNumber,
      'src.name': GUPSHUP_USERID,
      message: JSON.stringify({
        isHSM: "false",
        type: "text",
        text: message
      })
    };

    console.log('📦 Payload para GupShup:', JSON.stringify(gupshupPayload, null, 2));

    // Convertir a formato form-urlencoded
    const formData = new URLSearchParams();
    Object.keys(gupshupPayload).forEach(key => {
      formData.append(key, gupshupPayload[key]);
    });

    // Enviar solicitud a GupShup con URL y headers corregidos
    console.log('🔄 Enviando solicitud a GupShup API usando endpoint correcto (wa/api/v1/msg)...');
    const response = await fetch('https://api.gupshup.io/wa/api/v1/msg', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'apikey': GUPSHUP_API_KEY,
        'userid': GUPSHUP_USERID,
        'Cache-Control': 'no-cache'
      },
      body: formData.toString()
    });

    // Obtener respuesta como texto
    const responseText = await response.text();
    console.log('🔄 Respuesta de GupShup (texto):', responseText);

    // Analizar respuesta
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.warn('⚠️ Error al parsear respuesta como JSON:', parseError.message);
      result = { status: 'unknown', response: responseText };
    }

    // Verificar si fue exitoso
    if (response.ok && 
        (result.status === 'submitted' || 
         result.status === 'success')) {
      console.log('✅ Mensaje enviado exitosamente a WhatsApp a través de GupShup (ENVÍO REAL)');
      const successResult = {
        success: true,
        messageId: result.messageId || `gs-${Date.now()}`,
        response: result,
        timestamp: new Date().toISOString(),
        simulated: false
      };
      
      // Guardar en caché para evitar duplicados
      recentSentMessages.set(messageKey, successResult);
      
      // Limpiar de la caché después del tiempo establecido
      setTimeout(() => {
        recentSentMessages.delete(messageKey);
      }, GUPSHUP_DEDUPE_TIMEOUT);
      
      return successResult;
    } else {
      const errorMsg = `Error en GupShup: ${JSON.stringify(result)}`;
      console.error('❌ Error enviando mensaje a GupShup:', errorMsg);
      
      // Si estamos en modo desarrollo o simulación permitida, simular éxito
      if ((process.env.NODE_ENV === 'development' || process.env.USE_SIMULATION === 'true') && !disableSimulation) {
        console.log('⚠️ SIMULANDO ÉXITO debido a error y simulación permitida');
        return {
          success: true,
          simulated: true,
          messageId: `simulated-${Date.now()}`,
          response: { status: 'simulated' },
          timestamp: new Date().toISOString(),
          error: errorMsg
        };
      }
      
      return {
        success: false,
        error: errorMsg,
        response: result,
        timestamp: new Date().toISOString(),
        simulated: false
      };
    }
  } catch (error) {
    console.error('❌ Error al enviar mensaje:', error.message);
    
    // Verificar si se debe deshabilitar la simulación
    const disableSimulation = process.env.DISABLE_WHATSAPP_SIMULATION === 'true';
    
    // Si estamos en modo desarrollo o simulación permitida, simular éxito
    if ((process.env.NODE_ENV === 'development' || process.env.USE_SIMULATION === 'true') && !disableSimulation) {
      console.log('⚠️ SIMULANDO ÉXITO debido a error y simulación permitida');
      return {
        success: true,
        simulated: true,
        messageId: `simulated-${Date.now()}`,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
    
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      simulated: false
    };
  }
}

module.exports = { sendTextMessageGupShup }; 