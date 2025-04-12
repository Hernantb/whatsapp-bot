// Función para registrar respuestas del bot en Supabase
global.registerBotResponse = async (phoneNumber, messageText, businessId, senderType = 'bot', mediaUrl = null) => {
    try {
        console.log(`📝 Registrando mensaje ${senderType} en Supabase para ${phoneNumber}`);
        const supabase = global.supabase;
        
        if (!phoneNumber || !messageText) {
            console.error('❌ Falta número de teléfono o mensaje');
            return { success: false, error: 'Datos incompletos' };
        }
        
        if (!supabase) {
            console.error('❌ Cliente Supabase no inicializado');
            return { success: false, error: 'Cliente Supabase no disponible' };
        }
        
        // 1. Obtener o crear conversación
        let conversationId = null;
        
        // Buscar si ya existe una conversación para este número
        const { data: existingConv, error: convError } = await supabase
            .from('conversations')
            .select('id, is_bot_active')
            .eq('user_id', phoneNumber)
            .eq('business_id', businessId)
            .single();
        
        if (convError && convError.code !== 'PGRST116') {
            console.error(`❌ Error buscando conversación: ${convError.message}`);
            return { success: false, error: convError.message };
        }
        
        if (existingConv) {
            conversationId = existingConv.id;
            console.log(`✅ Conversación existente encontrada: ${conversationId}`);
        } else {
            // Crear nueva conversación si no existe
            console.log(`⚠️ No se encontró conversación para ${phoneNumber}, creando nueva...`);
            
            const { data: newConv, error: createError } = await supabase
                .from('conversations')
                .insert({
                    user_id: phoneNumber,
                    business_id: businessId,
                    is_bot_active: true,
                    created_at: new Date().toISOString()
                })
                .select('id')
                .single();
            
            if (createError) {
                console.error(`❌ Error creando conversación: ${createError.message}`);
                return { success: false, error: createError.message };
            }
            
            if (newConv) {
                conversationId = newConv.id;
                console.log(`✅ Nueva conversación creada: ${conversationId}`);
            } else {
                console.error('❌ No se pudo crear conversación');
                return { success: false, error: 'No se pudo crear conversación' };
            }
        }
        
        // 2. Insertar mensaje en la tabla de mensajes
        const messageData = {
            conversation_id: conversationId,
            content: messageText,
            sender_type: senderType,
            created_at: new Date().toISOString()
        };
        
        // Añadir mediaUrl si está presente
        if (mediaUrl) {
            messageData.media_url = mediaUrl;
            console.log(`🖼️ Incluyendo URL de media: ${mediaUrl}`);
        }
        
        const { data: message, error: messageError } = await supabase
            .from('messages')
            .insert(messageData)
            .select('id')
            .single();
        
        if (messageError) {
            console.error(`❌ Error guardando mensaje: ${messageError.message}`);
            return { success: false, error: messageError.message };
        }
        
        console.log(`✅ Mensaje guardado con ID: ${message?.id || 'desconocido'}`);
        
        // AÑADIDO: Verificar si el mensaje del bot requiere notificación
        if (senderType === 'bot') {
            try {
                console.log(`🔍 Verificando si el mensaje del bot requiere notificación: "${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}"`);
                const axios = require('axios');
                
                // URL del dashboard principal
                const dashboardUrl = process.env.DASHBOARD_URL || global.DASHBOARD_URL || 'http://localhost:7777';
                console.log(`🔗 Usando URL del dashboard para notificaciones: ${dashboardUrl}`);
                
                // Llamar al endpoint de verificación de notificaciones
                const notificationResponse = await axios.post(`${dashboardUrl}/api/process-whatsapp-message`, {
                    message: messageText,
                    isFromBot: true,
                    conversationId: conversationId,
                    phoneNumber: phoneNumber
                }, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 5000 // 5 segundos de timeout
                });
                
                if (notificationResponse.data.notificationSent) {
                    console.log(`📧 ¡NOTIFICACIÓN ENVIADA EXITOSAMENTE para mensaje: "${messageText.substring(0, 50)}..."`);
                } else {
                    console.log(`ℹ️ El mensaje no requiere notificación`);
                }
            } catch (notificationError) {
                console.error(`❌ Error al verificar notificación: ${notificationError.message}`);
                // No fallamos el proceso por un error de notificación
            }
        }
        
        return { 
            success: true, 
            messageId: message?.id,
            conversationId: conversationId
        };
        
    } catch (error) {
        console.error(`❌ Error general en registerBotResponse: ${error.message}`);
        console.error(error.stack);
        return { success: false, error: error.message };
    }
};

// Función para registrar mensajes recibidos en Supabase (para uso directo, similar a registerBotResponse)
global.registerMessage = async (phoneNumber, messageText, businessId, senderType = 'customer', mediaUrl = null) => {
    try {
        console.log(`📝 Registrando mensaje de ${senderType} en Supabase para ${phoneNumber}`);
        
        // Usar la misma función que para respuestas del bot
        return await global.registerBotResponse(phoneNumber, messageText, businessId, senderType, mediaUrl);
        
    } catch (error) {
        console.error(`❌ Error en registerMessage: ${error.message}`);
        console.error(error.stack);
        return { success: false, error: error.message };
    }
}; 