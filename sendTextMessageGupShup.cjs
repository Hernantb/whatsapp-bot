// Módulo para enviar mensajes de texto a través de GupShup
const axios = require('axios');

/**
 * Envía un mensaje de texto a un número de WhatsApp a través de la API de GupShup
 * @param {string} phoneNumber - Número de teléfono del destinatario (sin el signo +)
 * @param {string} message - Mensaje a enviar
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} - Resultado de la operación
 */
async function sendTextMessageGupShup(phoneNumber, message, options = {}) {
    try {
        console.log(`📲 Enviando mensaje a WhatsApp (${phoneNumber}) usando GupShup...`);
        
        // Cargar variables de entorno si no se proporcionan en las opciones
        const apiKey = options.apiKey || process.env.GUPSHUP_API_KEY;
        const sourcePhone = options.sourcePhone || process.env.GUPSHUP_NUMBER;
        const userId = options.userId || process.env.GUPSHUP_USERID;
        const sourceName = options.sourceName || 'BEXOR_WhatsApp';
        
        if (!apiKey || !sourcePhone) {
            console.error('❌ Error: API Key o número de origen no configurados');
            return { success: false, error: 'API Key o número de origen no configurados' };
        }
        
        // Formatear el número de teléfono (quitar prefijo + si existe)
        const formattedPhoneNumber = phoneNumber.startsWith('+') 
            ? phoneNumber.substring(1) 
            : phoneNumber;
        
        console.log(`📝 Datos enviados a GupShup:`);
        console.log(`- channel: whatsapp`);
        console.log(`- source: ${sourcePhone}`);
        console.log(`- destination: ${formattedPhoneNumber}`);
        console.log(`- message: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
        console.log(`- src.name: ${sourceName}`);
        
        // Crear el mensaje en formato JSON según documentación de GupShup
        const messageData = JSON.stringify({
            type: 'text',
            text: message
        });
        
        // URL correcta para la API de WhatsApp Business de GupShup
        const apiUrl = 'https://api.gupshup.io/wa/api/v1/msg';
        
        // Crear el formulario con los parámetros requeridos
        const formData = new URLSearchParams();
        formData.append('channel', 'whatsapp');
        formData.append('source', sourcePhone);
        formData.append('destination', formattedPhoneNumber);
        formData.append('message', messageData);
        formData.append('src.name', sourceName);
        
        // Configurar los encabezados HTTP correctos
        const headers = {
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/x-www-form-urlencoded',
            'apikey': apiKey
        };
        
        // Añadir el ID de usuario si está disponible
        if (userId) {
            headers['userid'] = userId;
        }
        
        console.log(`🔄 Enviando solicitud a API de GupShup...`);
        
        // Enviar la solicitud a la API de GupShup
        const response = await axios.post(apiUrl, formData, { headers });
        
        console.log(`✅ Mensaje enviado exitosamente a ${formattedPhoneNumber}`);
        console.log(`📊 Respuesta de GupShup: ${JSON.stringify(response.data)}`);
        
        // Devolver resultado exitoso
        return {
            success: true,
            messageId: response.data.messageId,
            status: response.data.status,
            responseData: response.data
        };
    } catch (error) {
        console.error(`❌ Error en sendTextMessageGupShup: ${error.message}`);
        
        // Mostrar detalles del error si están disponibles
        if (error.response) {
            console.error(`❌ Respuesta de error: ${error.response.status}`);
            console.error(`❌ Datos: ${JSON.stringify(error.response.data)}`);
        }
        
        // Intentar con formato alternativo si falla el primer intento
        try {
            console.log(`🔄 Reintentando con formato alternativo...`);
            
            const apiKey = options.apiKey || process.env.GUPSHUP_API_KEY;
            const sourcePhone = options.sourcePhone || process.env.GUPSHUP_NUMBER;
            const userId = options.userId || process.env.GUPSHUP_USERID;
            const sourceName = options.sourceName || 'BEXOR_WhatsApp';
            
            // Formatear el número de teléfono
            const formattedPhoneNumber = phoneNumber.startsWith('+') 
                ? phoneNumber.substring(1) 
                : phoneNumber;
            
            // Intentar con URL y formato alternativos
            const altApiUrl = 'https://api.gupshup.io/sm/api/v1/msg';
            
            // Crear el formulario con mensaje directo (sin JSON)
            const altFormData = new URLSearchParams();
            altFormData.append('channel', 'whatsapp');
            altFormData.append('source', sourcePhone);
            altFormData.append('destination', formattedPhoneNumber);
            altFormData.append('message', message);
            altFormData.append('src.name', sourceName);
            
            // Probar con distintos encabezados
            const altHeaders = {
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Bearer ${apiKey}`
            };
            
            if (userId) {
                altHeaders['userid'] = userId;
            }
            
            console.log(`🔄 Reintento con URL: ${altApiUrl}`);
            
            const altResponse = await axios.post(altApiUrl, altFormData, { headers: altHeaders });
            
            console.log(`✅ Mensaje enviado exitosamente en segundo intento`);
            console.log(`📊 Respuesta alternativa: ${JSON.stringify(altResponse.data)}`);
            
            return {
                success: true,
                messageId: altResponse.data.messageId,
                status: altResponse.data.status,
                responseData: altResponse.data,
                wasRetry: true
            };
        } catch (retryError) {
            console.error(`❌ Error en reintento: ${retryError.message}`);
            
            // Devolver resultado fallido con detalles del error
            return {
                success: false,
                error: error.message,
                details: error.response ? error.response.data : null,
                retryError: retryError.message
            };
        }
    }
}

module.exports = { sendTextMessageGupShup };