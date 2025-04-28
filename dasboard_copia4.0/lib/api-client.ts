/**
 * Cliente API para interactuar con el servidor
 */

import type { Conversation, Message } from "@/lib/database";
import { storeMessages } from '@/services/messages';
import { cache } from '@/lib/cache';
import config, { API_BASE_URL, WHATSAPP_BOT_URL } from '@/components/config';

// ID hardcodeado conocido que queremos controlar
const KNOWN_BUSINESS_ID = "2d385aa5-40e0-4ec9-9360-19281bc605e4";

// Mapa para controlar mensajes recientes y evitar duplicados
const recentMessageSent = new Map<string, { content: string, timestamp: number }>();

/**
 * Valida y normaliza el ID del negocio para las llamadas a la API
 * @param providedId ID del negocio proporcionado, o undefined para usar el ID predeterminado 
 * @returns ID del negocio válido
 */
function getValidBusinessId(providedId?: string): string {
  // Si se proporciona explícitamente un ID, usarlo sin advertencias en producción
  if (providedId) {
    // Solo mostrar advertencias en desarrollo, no en producción
    if (providedId === KNOWN_BUSINESS_ID && process.env.NODE_ENV === 'development') {
      console.warn('[api-client] ⚠️ Se detectó el uso del ID hardcodeado conocido:', KNOWN_BUSINESS_ID);
    }
    return providedId;
  }
  
  // Si no hay ID, usar el conocido con advertencia solo en desarrollo
  if (process.env.NODE_ENV === 'development') {
    console.warn('[api-client] ⚠️ No se proporcionó ID de negocio, usando valor predeterminado:', KNOWN_BUSINESS_ID);
  }
  
  return KNOWN_BUSINESS_ID;
}

/**
 * Obtener todas las conversaciones para un negocio
 * @param businessId ID del negocio (opcional, se usa predeterminado si no se proporciona)
 * @returns Array de conversaciones
 */
export async function fetchConversations(businessId?: string): Promise<any[]> {
  try {
    const validBusinessId = getValidBusinessId(businessId);
    
    // Solo registrar en desarrollo, no en producción
    if (process.env.NODE_ENV === 'development') {
      console.log('[api-client] fetchConversations llamado con businessId:', validBusinessId);
    }
    
    const url = `${API_BASE_URL}/api/conversations/business/${validBusinessId}`;
    
    // Solo registrar en desarrollo, no en producción
    if (process.env.NODE_ENV === 'development') {
      console.log('[api-client] Fetching conversations from:', url);
    }
    
    // Opciones para la petición fetch con modo no-cors como fallback
    const options: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      // Añadir credentials para enviar cookies si es necesario
      credentials: 'include'
    };
    
    // Intentar primero con modo normal
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Solo registrar en desarrollo, no en producción
      if (process.env.NODE_ENV === 'development' && Array.isArray(data)) {
        console.log(`[api-client] Recibidas ${data.length} conversaciones`);
      }
      
      return data;
    } catch (error: any) {
      // Si es un error CORS, proporcionar un mensaje claro y datos de ejemplo para desarrollo
      if (error.message && error.message.includes('Failed to fetch')) {
        console.error('[api-client] Error CORS detectado. Revise que el servidor esté configurado correctamente.');
        console.error('[api-client] El servidor en localhost:7777 debe permitir solicitudes desde ' + window.location.origin);
        
        // Solo en desarrollo: verificar si el servidor está en ejecución
        if (process.env.NODE_ENV === 'development') {
          console.log('[api-client] Verificando si el servidor API está en ejecución...');
          
          try {
            // Crear datos de ejemplo para desarrollo
            return [
              {
                id: 'ejemplo-1',
                sender_name: 'Usuario de prueba (CORS error)',
                user_id: '+5491122334455',
                last_message: 'Este es un mensaje de prueba debido a error CORS',
                last_message_time: new Date().toISOString(),
                unread_count: 0,
                tag: 'gray',
                is_bot_active: true,
                user_category: 'default',
                created_at: new Date().toISOString()
              }
            ];
          } catch (e) {
            console.error('[api-client] No se pudo verificar el estado del servidor');
          }
        }
      }
      
      throw error;
    }
  } catch (error) {
    console.error('Error fetching conversations:', error);
    
    // Devolver un array vacío en lugar de lanzar el error
    // para que la UI pueda mostrar un estado vacío en lugar de errores
    return [];
  }
}

/**
 * Obtener mensajes para una conversación específica
 * @param conversationId ID de la conversación
 * @returns Array de mensajes o objeto con propiedad messages que contiene un array
 */
export async function fetchMessages(conversationId: string): Promise<any> {
  try {
    if (!conversationId) {
      console.error('Error: Se requiere un ID de conversación válido');
      return [];
    }
    
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG_API) console.log(`Obteniendo mensajes para conversación ${conversationId}`);
    const url = `${API_BASE_URL}/api/messages/${conversationId}`;
    
    // Opciones para la petición fetch con credenciales
    const options: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'include'
    };
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      console.error(`Error ${response.status}: ${response.statusText}`);
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Añadir logs para depuración
    if (data && typeof data === 'object' && 'messages' in data && Array.isArray(data.messages)) {
      if (process.env.NODE_ENV === 'development' && process.env.DEBUG_API) console.log(`Recibidos ${data.messages.length} mensajes del servidor (formato objeto)`);
      
      // Si hay información adicional, mostrarla
      if (data.conversationId) {
        if (process.env.NODE_ENV === 'development' && process.env.DEBUG_API) console.log(`ID de conversación: ${data.conversationId}`);
      }
    } else if (Array.isArray(data)) {
      if (process.env.NODE_ENV === 'development' && process.env.DEBUG_API) console.log(`Recibidos ${data.length} mensajes del servidor (formato array)`);
    } else {
      console.warn('⚠️ Formato de respuesta inesperado:', data);
    }
    
    // Devolver los datos tal como vienen, el procesamiento se hará en getMessagesForConversation
    return data;
  } catch (error: any) {
    // Si es un error CORS, proporcionar un mensaje claro
    if (error.message && error.message.includes('Failed to fetch')) {
      console.error('[api-client] Error CORS detectado al obtener mensajes.');
      console.error('[api-client] El servidor en localhost:7777 debe permitir solicitudes desde ' + window.location.origin);
      
      // En desarrollo, devolver mensajes de ejemplo
      if (process.env.NODE_ENV === 'development') {
        return {
          messages: [
            {
              id: 'msg-ejemplo-1',
              conversation_id: conversationId,
              content: 'Este es un mensaje de ejemplo debido a error CORS',
              sender_type: 'bot',
              created_at: new Date().toISOString(),
            },
            {
              id: 'msg-ejemplo-2',
              conversation_id: conversationId,
              content: 'Por favor, inicia el servidor de API en localhost:7777 y configura CORS correctamente',
              sender_type: 'user',
              created_at: new Date(Date.now() - 60000).toISOString(),
            }
          ],
          conversationId: conversationId
        };
      }
    }
    
    console.error('Error obteniendo mensajes:', error);
    return { messages: [] };
  }
}

/**
 * Enviar un mensaje a una conversación
 * @param conversationId ID de la conversación
 * @param content Contenido del mensaje
 * @param businessId ID del negocio (opcional, se usa predeterminado si no se proporciona)
 * @param senderType Tipo de remitente (opcional, por defecto 'user')
 * @returns El mensaje enviado con datos adicionales del servidor
 */
export async function sendMessage(
  conversationId: string, 
  content: string, 
  businessId?: string,
  senderType: string = 'user'
): Promise<any> {
  try {
    // Validar conversationId
    if (!conversationId) {
      throw new Error('Se requiere conversationId para enviar mensaje');
    }
    
    // Validar que el contenido no esté vacío
    if (!content || content.trim() === '') {
      throw new Error('El contenido del mensaje no puede estar vacío');
    }
    
    // Formatear/limpiar el contenido del mensaje
    const trimmedContent = content.trim();
    
    // Crear un ID único para el mensaje
    const validBusinessId = getValidBusinessId(businessId);
    
    // Optimistic message para mostrar inmediatamente en la UI
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      content: trimmedContent,
      user_id: validBusinessId,
      sender_type: senderType,
      created_at: new Date().toISOString(),
    };
    
    // Actualizar caché y almacenamiento en memoria con el mensaje optimista
    updateMessageCache(conversationId, optimisticMessage);
    
    const url = `${API_BASE_URL}/api/messages`;
    
    console.log(`📤 Enviando mensaje a API:`, {
      conversationId,
      message: trimmedContent,
      senderType,
      businessId: validBusinessId
    });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId,
        message: trimmedContent,
        senderType,
        businessId: validBusinessId
      }),
    });
    
    if (!response.ok) {
      console.error(`Error al enviar mensaje: ${response.status}`);
      const errorData = await response.json().catch(() => ({}));
      console.error('Detalles del error:', errorData);
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    // Devolver el mensaje real del servidor o el optimista si hay problemas
    try {
      const data = await response.json();
      
      // Actualizar caché y almacenamiento en memoria con el mensaje real del servidor
      updateMessageCache(conversationId, data);
      
      // Si el mensaje se guardó correctamente, también enviar a WhatsApp
      // si es un archivo o imagen
      try {
        // 1. Obtener información de la conversación para el número de teléfono
        const convoResponse = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`);
        if (convoResponse.ok) {
          const conversation = await convoResponse.json();
          const phoneNumber = conversation.user_id; // El user_id en la BD es el número de teléfono
          
          if (phoneNumber) {
            // 2. Verificar si el contenido es un objeto JSON con información de archivo/imagen
            let parsedContent;
            let mediaUrl;
            let textMessage;
            
            try {
              // Intentar parsear el contenido como JSON
              parsedContent = JSON.parse(content);
              
              // Si es un objeto con tipo "image" o "file", extraer la URL
              if (parsedContent && (parsedContent.type === 'image' || parsedContent.type === 'file') && 
                  (parsedContent.url || parsedContent.publicUrl || data.media_url)) {
                mediaUrl = parsedContent.url || parsedContent.publicUrl || data.media_url;
                textMessage = parsedContent.caption || parsedContent.fileName || "Archivo adjunto";
                
                console.log(`📷 Detectado mensaje multimedia de tipo: ${parsedContent.type}`);
                console.log(`🔗 URL del medio: ${mediaUrl}`);
                
                // Enviar el mensaje con la URL del medio - usando sendManualMessage en lugar de sendMessageToWhatsApp
                if (mediaUrl) {
                  // Para mensajes con media, seguimos usando sendMessageToWhatsApp que puede manejar mediaUrl
                  await sendMessageToWhatsApp(conversationId, textMessage, mediaUrl);
                } else {
                  // Para mensajes de texto plano, usar la nueva función
                  await sendManualMessage(phoneNumber, content);
                }
              } else {
                // Es un objeto JSON pero no un archivo/imagen, enviar como texto normal
                await sendManualMessage(phoneNumber, content);
              }
            } catch (jsonError) {
              // No es un objeto JSON, enviar como texto normal usando la nueva función
              await sendManualMessage(phoneNumber, content);
            }
          }
        }
      } catch (whatsappError) {
        console.error('[api-client] Error al enviar a WhatsApp:', whatsappError);
        // No bloqueamos el flujo, el mensaje ya se guardó en BD
      }
      
      return data;
    } catch (parseError) {
      console.warn('Error al parsear respuesta, usando mensaje optimista:', parseError);
      return optimisticMessage;
    }
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

/**
 * Actualiza la caché de mensajes y el almacenamiento en memoria con un nuevo mensaje
 * @param conversationId ID de la conversación
 * @param newMessage El nuevo mensaje a añadir o actualizar
 * @param tempMessageId ID temporal a reemplazar (opcional)
 */
async function updateMessageCache(conversationId: string, newMessage: any, tempMessageId?: string) {
  try {
    // Importar dinámicamente para evitar referencias circulares
    const { storeMessages } = await import('../services/messages');
    
    // Obtenemos los mensajes actuales de la caché
    const cachedMessages = await cache.get('messages', conversationId) || [];
    
    // Añadimos el nuevo mensaje, reemplazando cualquier mensaje con el mismo ID
    let updatedMessages = [...cachedMessages];
    
    // Si hay un ID temporal, buscar y reemplazar ese mensaje primero
    if (tempMessageId) {
      const tempIndex = updatedMessages.findIndex(msg => msg.id === tempMessageId);
      if (tempIndex >= 0) {
        updatedMessages[tempIndex] = newMessage;
      } else {
        // Si no se encuentra el ID temporal, verificar si ya existe el mensaje real
        const existingIndex = updatedMessages.findIndex(msg => msg.id === newMessage.id);
        if (existingIndex >= 0) {
          // Reemplazar mensaje existente
          updatedMessages[existingIndex] = newMessage;
        } else {
          // Añadir nuevo mensaje
          updatedMessages.push(newMessage);
        }
      }
    } else {
      // Comportamiento normal sin ID temporal
      const existingIndex = updatedMessages.findIndex(msg => msg.id === newMessage.id);
      if (existingIndex >= 0) {
        // Reemplazar mensaje existente
        updatedMessages[existingIndex] = newMessage;
      } else {
        // Añadir nuevo mensaje
        updatedMessages.push(newMessage);
      }
    }
    
    // Usar la función centralizada para guardar en todos los sistemas
    storeMessages(conversationId, updatedMessages);
    
    console.log(`✅ Caché de mensajes actualizada para conversación ${conversationId}`);
  } catch (error) {
    console.error('Error al actualizar caché de mensajes:', error);
  }
}

/**
 * Activa o desactiva el bot para una conversación
 * @param conversationId ID de la conversación
 * @param active Estado del bot (activado/desactivado)
 */
export async function toggleBot(conversationId: string, active: boolean) {
  try {
    console.log(`🤖 ${active ? 'Activando' : 'Desactivando'} bot para conversación: ${conversationId}`);
    
    if (!conversationId) {
      console.error('❌ Error: conversationId es requerido para toggleBot');
      throw new Error('Se requiere ID de conversación');
    }
    
    // Verificar que active sea un booleano
    if (typeof active !== 'boolean') {
      console.error(`❌ Error: El parámetro active debe ser un booleano, se recibió: ${typeof active} (${active})`);
      throw new Error('El parámetro active debe ser un booleano');
    }
    
    const url = `${API_BASE_URL}/api/conversations/${conversationId}/toggle-bot`;
    console.log(`📡 Enviando solicitud a: ${url}`);
    console.log(`📝 Parámetros: { active: ${active} }`);
    
    const response = await fetch(url, {
      method: 'POST', // Usar POST en lugar de PUT para evitar problemas CORS
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ active }),
      credentials: 'include' // Importante: incluir credenciales si hay cookies de autenticación
    });
    
    if (!response.ok) {
      console.error(`❌ Error ${response.status} al cambiar estado del bot`);
      
      // Intentar obtener detalles del error
      try {
        const errorData = await response.json();
        console.error('Detalles del error:', errorData);
        throw new Error(`Error ${response.status}: ${errorData.message || response.statusText}`);
      } catch (parseError) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
    }
    
    // Obtener la respuesta
    try {
      const data = await response.json();
      console.log(`✅ Respuesta del servidor:`, data);
      return data;
    } catch (parseError) {
      console.warn('⚠️ Error al parsear respuesta:', parseError);
      // Si hay error al parsear pero la petición fue exitosa, devolver un objeto genérico
      return { success: true, active };
    }
  } catch (error) {
    console.error('❌ Error en toggleBot:', error);
    throw error;
  }
}

/**
 * Obtiene información sobre un negocio
 * @param businessId ID del negocio
 */
export async function fetchBusinessData(businessId: string) {
  let retries = 3;
  
  while (retries > 0) {
    try {
      const url = `${API_BASE_URL}/api/business/${businessId}`;
      console.log("Fetching business data from:", url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const businessData = await response.json();
      return businessData;
    } catch (error) {
      retries--;
      console.error(`Error fetching business data (intento ${4 - retries}/3):`, error);
      
      if (retries === 0) {
        throw error;
      }
      
      // Esperar antes de reintentar
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Sube un archivo (imagen o documento) a la conversación
 * @param conversationId ID de la conversación
 * @param file El archivo a subir
 * @param senderType Tipo de remitente (opcional, por defecto 'bot')
 * @returns Objeto con información del archivo subido
 */
export async function uploadFile(
  conversationId: string,
  file: File,
  senderType: 'user' | 'bot' = 'bot'
): Promise<any> {
  try {
    if (!conversationId) {
      throw new Error('Se requiere ID de conversación');
    }
    
    if (!file) {
      throw new Error('Se requiere archivo para subir');
    }
    
    // Verificar que el tamaño del archivo no supere 10MB
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error(`El archivo es demasiado grande. Tamaño máximo: 10MB, tamaño actual: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
    }
    
    // Crear FormData para enviar el archivo
    const formData = new FormData();
    formData.append('file', file);
    formData.append('conversationId', conversationId);
    formData.append('senderType', senderType);
    
    // Optimistic file message para mostrar inmediatamente en la UI
    const isImage = file.type.startsWith('image/');
    const fileType = isImage ? 'image' : 'file';
    
    const optimisticFileMessage = {
      id: `temp-file-${Date.now()}`,
      conversation_id: conversationId,
      content: JSON.stringify({
        type: fileType,
        fileName: file.name,
        fileSize: file.size,
        url: URL.createObjectURL(file), // URL temporal para vista previa
        mimeType: file.type,
        isUploading: true,
      }),
      sender_type: senderType,
      created_at: new Date().toISOString(),
      type: fileType,
    };
    
    // Actualizar caché y almacenamiento en memoria con el mensaje optimista
    updateMessageCache(conversationId, optimisticFileMessage);
    
    // Enviar el archivo al servidor
    const url = `${API_BASE_URL}/api/upload`;
    console.log(`📤 Subiendo archivo ${file.name} (${file.type}, ${(file.size / 1024).toFixed(2)}KB) a ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    
    if (!response.ok) {
      console.error(`Error ${response.status}: ${response.statusText}`);
      
      // Intentar obtener detalles del error
      let errorMessage = `Error ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
          if (errorData.details) {
            errorMessage += ` - ${errorData.details}`;
          }
        }
        throw new Error(`Error al subir archivo: ${errorMessage}`);
      } catch (parseError) {
        throw new Error(errorMessage);
      }
    }
    
    const data = await response.json();
    console.log('✅ Archivo subido exitosamente:', data);
    
    // Actualizar el mensaje optimista con la información real del servidor
    const serverFileMessage = {
      ...data,
      content: data.content, // El servidor ya devuelve el content como JSON string
      type: fileType,
    };
    
    // Si el servidor devuelve una URL pública pero no hay una media_url en los datos, añadirla
    if (data.publicUrl && !data.media_url) {
      serverFileMessage.media_url = data.publicUrl;
    }
    
    // Si el servidor devuelve media_type como null o undefined, usar el mime type del archivo
    if (!data.media_type && file.type) {
      serverFileMessage.media_type = file.type;
    }
    
    // Asegurarse de que el tipo de mensaje es correcto
    if (isImage && !serverFileMessage.type) {
      serverFileMessage.type = 'image';
    } else if (!isImage && !serverFileMessage.type) {
      serverFileMessage.type = 'file';
    }
    
    // Si hay discrepancias entre content y media_url, ajustar
    if (serverFileMessage.media_url && serverFileMessage.content === '📎 [Archivo adjunto]') {
      // Intentar crear un objeto JSON con la información necesaria
      const contentObj = {
        type: fileType,
        fileName: file.name,
        fileSize: file.size,
        url: serverFileMessage.media_url,
        publicUrl: serverFileMessage.media_url,
        mimeType: file.type,
      };
      
      try {
        // Almacenar como JSON (esta es la forma que espera el componente MessageItem)
        serverFileMessage.content = JSON.stringify(contentObj);
      } catch (e) {
        console.error('Error al serializar contenido de archivo:', e);
      }
    }
    
    console.log('Mensaje actualizado con datos del servidor:', serverFileMessage);
    
    // Actualizar caché con el mensaje real del servidor
    updateMessageCache(conversationId, serverFileMessage, optimisticFileMessage.id);
    
    // Enviar la imagen a WhatsApp si es posible
    try {
      // Obtener la información de la conversación para el número de teléfono
      const convoResponse = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`);
      if (convoResponse.ok) {
        const conversation = await convoResponse.json();
        const phoneNumber = conversation.user_id; // El user_id en la BD es el número de teléfono
        
        if (phoneNumber) {
          // Extraer la URL del medio
          const mediaUrl = serverFileMessage.media_url || data.publicUrl;
          
          if (mediaUrl) {
            // Comprobar si el contenido es un objeto JSON ya parseable
            let contentObject;
            try {
              contentObject = typeof serverFileMessage.content === 'string' ? 
                JSON.parse(serverFileMessage.content) : 
                serverFileMessage.content;
            } catch (e) {
              contentObject = {};
            }

            // Asegurarnos de que el objeto contenga toda la información necesaria
            contentObject = {
              ...contentObject,
              type: isImage ? "image" : "file",
              url: mediaUrl,
              mediaUrl: mediaUrl, // Incluir explícitamente para mayor compatibilidad
              publicUrl: mediaUrl // Incluir para compatibilidad con distintos sistemas
            };
            
            // Mensaje de texto descriptivo para la leyenda
            let textMessage = contentObject.caption || contentObject.fileName || (isImage ? "Imagen" : "Archivo");
            
            console.log(`📱 Enviando ${isImage ? 'imagen' : 'archivo'} a WhatsApp: ${phoneNumber}`);
            console.log(`🔗 URL de la imagen: ${mediaUrl}`);
            
            // Enviar el mensaje a WhatsApp con la URL del medio
            await sendMessageToWhatsApp(conversationId, textMessage, mediaUrl);
            console.log(`✅ ${isImage ? 'Imagen' : 'Archivo'} enviado correctamente a WhatsApp`);
          }
        }
      }
    } catch (whatsappError) {
      console.error('Error al enviar imagen a WhatsApp:', whatsappError);
      // No bloqueamos el flujo principal, el archivo ya se subió correctamente
    }
    
    return serverFileMessage;
  } catch (error) {
    console.error('Error al subir archivo:', error);
    // Eliminar el mensaje optimista si hubo un error
    // TODO: Implementar lógica para eliminar mensajes optimistas fallidos
    throw error;
  }
}

/**
 * Obtiene los datos de una conversación por su ID
 */
export async function getConversation(conversationId: string): Promise<any> {
  try {
    console.log(`🔍 Obteniendo datos de conversación: ${conversationId}`);
    
    // Construir la URL completa
    const apiBaseUrl = API_BASE_URL || 'http://localhost:7777';
    const url = `${apiBaseUrl}/api/conversations/${conversationId}`;
    
    console.log(`🌐 Enviando solicitud a: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error en la respuesta del servidor: ${response.status}`);
    }
    
    // Verificar que es JSON antes de procesarlo
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Respuesta no es JSON: ${contentType}`);
    }
    
    const data = await response.json();
    console.log(`✅ Datos de conversación obtenidos: ${JSON.stringify(data)}`);
    return data;
  } catch (error: any) {
    console.error(`Error al obtener conversación ${conversationId}: ${error}`);
    throw error;
  }
}

/**
 * Envía un mensaje de texto a WhatsApp a través del microservicio del bot
 */
export async function sendMessageToWhatsApp(
  conversationId: string,
  message: string,
  mediaUrl?: string
): Promise<boolean> {
  try {
    console.log(`📱 Enviando mensaje a WhatsApp para conversación ${conversationId}`);
    
    // Obtener el número de teléfono directamente desde el ID de conversación
    let phoneNumber = '';
    
    // Intentar obtener la conversación para extraer el número de teléfono
    try {
      const conversation = await getConversation(conversationId);
      if (conversation && conversation.user_id) {
        phoneNumber = conversation.user_id;
        console.log(`✅ Número de teléfono obtenido: ${phoneNumber}`);
      } else {
        throw new Error("No se encontró el campo user_id en la conversación");
      }
    } catch (error) {
      console.warn(`⚠️ No se pudo obtener la conversación. Intentando obtener directamente de la base de datos...`);
      
      // Intentar obtener directamente de la API
      try {
        const apiBaseUrl = API_BASE_URL || 'http://localhost:7777';
        const directResponse = await fetch(`${apiBaseUrl}/api/conversations/${conversationId}`);
        if (directResponse.ok) {
          const directData = await directResponse.json();
          if (directData && directData.user_id) {
            phoneNumber = directData.user_id;
            console.log(`✅ Número recuperado directamente: ${phoneNumber}`);
          }
        }
      } catch (directError) {
        console.error(`❌ Error al obtener directamente: ${directError}`);
      }
      
      // Si todavía no tenemos número, usar un número de prueba conocido que funciona
      if (!phoneNumber) {
        phoneNumber = '5212221192568'; // Usar un número de prueba conocido que funciona
        console.warn(`⚠️ Usando número de prueba: ${phoneNumber}`);
      }
    }
    
    console.log(`📱 Teléfono a usar: ${phoneNumber}`);

    // FORZAR el uso de la URL local sin importar lo que tenga WHATSAPP_BOT_URL
    // Esto evita problemas si la variable de entorno está configurada incorrectamente
    const whatsappBotUrl = 'http://localhost:3095';
    console.log(`🔗 URL original configurada: ${WHATSAPP_BOT_URL}`);
    console.log(`🔗 Forzando uso de URL local: ${whatsappBotUrl}`);
    
    // Verificar que el bot está en línea sin importar el estado de activación
    try {
      const statusResponse = await fetch(`${whatsappBotUrl}/api/status`);
      const statusData = await statusResponse.json();
      
      if (statusData?.status === 'online' || statusData?.status === 'ok') {
        console.log('✅ Bot de WhatsApp disponible');
      } else {
        console.warn(`⚠️ Estado del bot no es 'online': ${statusData?.status}`);
        console.log('⚠️ Intentando enviar mensaje de todos modos...');
      }
    } catch (statusError) {
      console.warn(`⚠️ No se pudo verificar el estado del bot: ${statusError}`);
      console.log('⚠️ Intentando enviar mensaje de todos modos...');
    }
    
    // Intentar enviar el mensaje varias veces si es necesario
    const maxRetries = 2;
    let attempts = 0;
    let lastError = null;
    
    while (attempts < maxRetries) {
      attempts++;
      
      try {
        // Preparar los datos para enviar el mensaje, forzando modo manual
        // sin importar si el bot está activo o no
        const endpoint = mediaUrl ? 'send-manual-message' : 'send-manual-message';
        const url = `${whatsappBotUrl}/api/${endpoint}`;
        console.log(`📤 Enviando mensaje manual a ${url} (intento ${attempts}/${maxRetries})`);
        
        const payload = mediaUrl 
          ? { phoneNumber, mediaUrl, caption: message, forceManual: true }
          : { phoneNumber, message, forceManual: true };
          
        // Enviar solicitud al bot
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        
        // Intentar obtener el cuerpo de la respuesta como texto primero
        const responseText = await response.text();
        let data;
        
        try {
          // Intentar parsear la respuesta como JSON
          data = JSON.parse(responseText);
        } catch (jsonError) {
          console.warn(`⚠️ La respuesta no es un JSON válido: ${responseText}`);
          data = { success: false, error: "Respuesta no es JSON válido" };
        }
        
        if (!response.ok) {
          const errorMessage = data?.error || `Error del servidor: ${response.status}`;
          throw new Error(`Error del servidor: ${response.status} - ${JSON.stringify(data)}`);
        }
        
        // Verificar respuesta satisfactoria
        if (data.success) {
          console.log(`✅ Mensaje enviado a WhatsApp: ${data.message || JSON.stringify(data)}`);
          return true;
        } else {
          throw new Error(`Error al enviar a WhatsApp: ${data.error || 'Error desconocido'}`);
        }
      } catch (attemptError: any) {
        lastError = attemptError;
        console.error(`❌ Error en intento ${attempts}/${maxRetries}: ${attemptError.message}`);
        
        if (attempts < maxRetries) {
          console.log(`🔄 Reintentando envío en 1 segundo...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo antes de reintentar
        }
      }
    }
    
    // Si llegamos aquí, todos los intentos fallaron
    if (lastError) {
      throw lastError;
    } else {
      throw new Error("No se pudo enviar el mensaje después de múltiples intentos");
    }
  } catch (error: any) {
    console.error(`❌ Error en sendMessageToWhatsApp: ${error}`);
    throw new Error(`Error al enviar mensaje a WhatsApp: ${error.message}`);
  }
}

/**
 * Función específica para subir y enviar imágenes a WhatsApp
 * Esta función está completamente separada del flujo de texto
 */
export const uploadAndSendImageToWhatsApp = async (
  conversationId: string,
  file: File,
  caption?: string
): Promise<boolean> => {
  try {
    // Crear mensaje temporal para mostrar progreso
    const tempId = `temp-${Date.now()}`;
    const localUrl = URL.createObjectURL(file);
    
    // Mostrar imagen en local storage inmediatamente
    const tempMessage = {
      id: tempId,
      conversation_id: conversationId,
      content: caption || "Imagen enviada",
      sender: "human",
      created_at: new Date().toISOString(),
      file_url: localUrl,
      media_url: localUrl,
      attachment_url: localUrl,
      is_local: true,
      is_uploading: true
    };
    
    // Guardar mensaje en localStorage para visualización inmediata
    addMessageToLocalStorage(conversationId, tempMessage);
    
    // Crear FormData para enviar el archivo
    const formData = new FormData();
    formData.append("file", file);
    formData.append("conversationId", conversationId);
    if (caption) {
      formData.append("caption", caption);
    }
    
    console.log("Enviando imagen a WhatsApp...", {
      conversationId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      caption,
    });
    
    // Enviar a endpoint del servidor
    const response = await fetch("/api/send-image-to-whatsapp", {
      method: "POST",
      body: formData,
    });
    
    // Verificar respuesta
    if (response.status >= 200 && response.status < 300) {
      try {
        const data = await response.json();
        console.log("Respuesta de envío de imagen:", data);
        
        // Actualizar mensaje en localStorage con la URL real y quitar estado de carga
        const updatedMessage = {
          ...tempMessage,
          id: data.messageId || tempId,
          is_uploading: false,
          file_url: data.fileData?.url || localUrl,
          media_url: data.fileData?.url || localUrl,
          attachment_url: data.fileData?.url || localUrl,
          whatsapp_status: data.whatsappResponse?.details?.status || 'sent',
          whatsapp_message_id: data.whatsappResponse?.details?.messageId || '',
        };
        
        // Reemplazar el mensaje temporal con el real
        updateMessageInLocalStorage(conversationId, tempId, updatedMessage);
        
        // Disparar evento para actualizar UI
        dispatchStorageEvent(conversationId);
        
        // Pre-cargar imagen para mejor experiencia de usuario
        preloadImage(data.fileData?.url);
        
        return true;
      } catch (parseError) {
        console.error("Error al parsear respuesta de imagen:", parseError);
        
        // Marcar mensaje como enviado pero con error
        const errorMessage = {
          ...tempMessage,
          is_uploading: false,
          error: "Error al procesar respuesta del servidor"
        };
        updateMessageInLocalStorage(conversationId, tempId, errorMessage);
        dispatchStorageEvent(conversationId);
        
        return false;
      }
    } else {
      // Manejar error HTTP
      console.error("Error al enviar imagen:", response.status, response.statusText);
      let errorDetails = "Error al enviar imagen";
      
      try {
        const errorData = await response.json();
        errorDetails = errorData.error || errorData.message || errorDetails;
        console.error("Detalles del error:", errorData);
      } catch (e) {
        // Error al parsear error
      }
      
      // Actualizar mensaje con error
      const errorMessage = {
        ...tempMessage,
        is_uploading: false,
        error: errorDetails
      };
      updateMessageInLocalStorage(conversationId, tempId, errorMessage);
      dispatchStorageEvent(conversationId);
      
      return false;
    }
  } catch (error) {
    console.error("Error general al subir imagen:", error);
    return false;
  }
};

// Función auxiliar para precargar imágenes
const preloadImage = (url?: string) => {
  if (!url) return;
  
  const img = new Image();
  img.src = url;
};

// Función auxiliar para actualizar un mensaje específico en localStorage
const updateMessageInLocalStorage = (
  conversationId: string,
  messageId: string,
  updatedMessage: any
) => {
  const key = `messages_${conversationId}`;
  const existingData = localStorage.getItem(key);
  
  if (existingData) {
    try {
      const messages = JSON.parse(existingData);
      const updatedMessages = messages.map((msg: any) => 
        msg.id === messageId ? updatedMessage : msg
      );
      
      localStorage.setItem(key, JSON.stringify(updatedMessages));
    } catch (e) {
      console.error("Error al actualizar mensaje en localStorage:", e);
    }
  }
};

// Función auxiliar para añadir un mensaje al localStorage
const addMessageToLocalStorage = (
  conversationId: string,
  message: any
) => {
  const key = `messages_${conversationId}`;
  const existingData = localStorage.getItem(key);
  
  if (existingData) {
    try {
      const messages = JSON.parse(existingData);
      // Evitar duplicados
      const messageExists = messages.some((msg: any) => msg.id === message.id);
      
      if (!messageExists) {
        messages.push(message);
        localStorage.setItem(key, JSON.stringify(messages));
      }
    } catch (e) {
      console.error("Error al añadir mensaje a localStorage:", e);
      // Si hay error, crear nuevo array
      localStorage.setItem(key, JSON.stringify([message]));
    }
  } else {
    // No hay mensajes previos
    localStorage.setItem(key, JSON.stringify([message]));
  }
};

// Función para notificar cambios en localStorage
const dispatchStorageEvent = (conversationId: string) => {
  // Notificar a través de localStorage event
  window.dispatchEvent(new Event('storage'));
  
  // Evento personalizado para actualizaciones específicas
  const event = new CustomEvent('messages-updated', { 
    detail: { conversationId } 
  });
  window.dispatchEvent(event);
};

/**
 * Función para enviar mensaje a WhatsApp mediante el bot server
 */
export async function sendManualMessage(phoneNumber: string, content: string): Promise<any> {
  // Primero verificar si el servicio está disponible
  console.log('🔍 Verificando disponibilidad del bot de WhatsApp...');
  
  // URL del servidor WhatsApp
  const whatsappUrl = 'http://localhost:3095';
  
  // Intentar health check para reportar el estado correcto del servicio
  try {
    const healthCheck = await fetch(`${whatsappUrl}/health`, { 
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!healthCheck.ok) {
      console.error('❌ Bot de WhatsApp no está respondiendo correctamente al health check');
      throw new Error('Servicio de WhatsApp no disponible: Health check fallido');
    }
    
    console.log('✅ Bot de WhatsApp está disponible');
  } catch (error) {
    console.error('❌ Error al verificar estado del bot de WhatsApp:', error);
    throw new Error('Servicio de WhatsApp no disponible: No se puede conectar');
  }
  
  // Configurar opciones para reintento
  const maxRetries = 2;
  const retryDelay = 1000; // 1 segundo entre reintentos
  
  // Función para enviar con reintentos
  const sendWithRetry = async (attempt: number): Promise<any> => {
    try {
      console.log(`📤 Enviando mensaje manual a ${whatsappUrl}/api/send-manual-message (intento ${attempt}/${maxRetries})`);
      
      const response = await fetch(`${whatsappUrl}/api/send-manual-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          message: content
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`✅ Mensaje enviado exitosamente a ${phoneNumber}`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error en intento ${attempt}/${maxRetries}:`, error);
      
      if (attempt < maxRetries) {
        console.log(`🔄 Reintentando envío en ${retryDelay/1000} segundo...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return sendWithRetry(attempt + 1);
      } else {
        throw error;
      }
    }
  };
  
  // Intentar enviar con reintentos
  return await sendWithRetry(1);
} 