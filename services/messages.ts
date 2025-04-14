import { supabase } from '../lib/supabase'
import { cache } from '../lib/cache'
import type { Message } from '../lib/database'
import { fetchMessages } from '@/lib/api-client'

// Definición de UIMessage para el uso interno en este archivo
interface UIMessage {
  id: string;
  conversationId: string;
  content: string;
  timestamp: string;
  sender: 'me' | 'them';
  status: string;
  type: string;
  user_id?: string;
  error?: boolean;
  sender_type?: string;
}

// Variables para almacenamiento en memoria
const inMemoryMessageStore = new Map<string, UIMessage[]>();
const requestsInProgress = new Map<string, Promise<UIMessage[]>>();
const lastRequestTime = new Map<string, number>();
const requestDebounceTime = 1000; // 1 segundo entre solicitudes
const recentMessages = new Map<string, { content: string, timestamp: number }>();

/**
 * Almacena mensajes en todos los sistemas disponibles: memoria, caché y localStorage
 * Esto garantiza que los mensajes persistan entre recargas de página
 */
export function storeMessages(conversationId: string, messages: UIMessage[]): void {
  try {
    if (!conversationId || !messages || !Array.isArray(messages)) {
      console.warn('❌ Intentando guardar mensajes con datos inválidos');
      return;
    }

    // Eliminar duplicados por ID antes de guardar
    const uniqueMessages = Array.from(
      new Map(messages.map(msg => [msg.id, msg])).values()
    );
    
    // Eliminar también duplicados por contenido y timestamp cercano (menos de 2 segundos)
    const finalMessages: UIMessage[] = [];
    uniqueMessages.forEach(msg => {
      const isDuplicate = finalMessages.some(existingMsg => 
        existingMsg.content === msg.content && 
        Math.abs(new Date(existingMsg.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 2000
      );
      
      if (!isDuplicate) {
        finalMessages.push(msg);
      }
    });

    // 1. Guardar en memoria (más rápido para acceso repetido)
    inMemoryMessageStore.set(conversationId, [...finalMessages]);
    
    // 2. Guardar en caché (persistencia entre componentes)
    cache.set('messages', conversationId, finalMessages);
    
    // 3. Guardar en localStorage (persistencia entre recargas)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`messages_${conversationId}`, JSON.stringify(finalMessages));
        console.log(`🔒 Mensajes guardados en localStorage y memoria para conversación ${conversationId}`);
      } catch (e) {
        console.error('Error al guardar mensajes en localStorage:', e);
      }
    }
  } catch (error) {
    console.error('Error al almacenar mensajes:', error);
  }
}

/**
 * Obtiene los mensajes para una conversación específica
 * Esta función se asegura de filtrar adecuadamente por ID de conversación
 * e implementa debounce para evitar llamadas API excesivas
 */
export async function getMessagesForConversation(conversationId: string) {
  try {
    if (!conversationId) {
      console.error('❌ Error: se requiere un ID de conversación válido');
      return [];
    }
    
    console.log(`🔄 Obteniendo mensajes para conversación: ${conversationId}`);
    
    // Obtener mensajes directamente desde Supabase en lugar de usar la API
    const { data: messagesData, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    
    if (error) {
      console.error('❌ Error al obtener mensajes de Supabase:', error);
      return [];
    }
    
    console.log(`✅ Supabase devolvió ${messagesData?.length || 0} mensajes para conversación ${conversationId}`);
    
    // Deduplicar mensajes por ID y contenido/timestamp
    const uniqueMessages = new Map<string, Message>();
    messagesData.forEach((msg: Message) => {
      const existingMsg = uniqueMessages.get(msg.id);
      if (!existingMsg) {
        // Si no existe mensaje con ese ID, verificar duplicados por contenido/timestamp
        const isDuplicate = Array.from(uniqueMessages.values()).some(existing => 
          existing.content === msg.content && 
          Math.abs(new Date(existing.created_at).getTime() - 
                  new Date(msg.created_at).getTime()) < 5000
        );
        
        if (!isDuplicate) {
          uniqueMessages.set(msg.id, msg);
        }
      }
    });
    
    // Convertir a array y ordenar
    const allMessages = Array.from(uniqueMessages.values());
    allMessages.sort((a, b) => {
      const getTimestamp = (msg: Message): number => {
        return new Date(msg.created_at).getTime();
      };
      return getTimestamp(a) - getTimestamp(b);
    });
    
    // Transformar mensajes al formato UI
    const uiMessages: UIMessage[] = allMessages.map(msg => ({
      id: msg.id,
      conversationId: msg.conversation_id,
      content: msg.content,
      timestamp: msg.created_at,
      sender: (msg.sender_type === 'bot' || msg.sender_type === 'agent') ? 'me' : 'them' as const,
      status: 'sent',
      type: 'text',
      sender_type: msg.sender_type
    }));
    
    // Guardar los mensajes en todos los sistemas
    storeMessages(conversationId, uiMessages);
    
    return uiMessages;
  } catch (error) {
    console.error('❌ Error general obteniendo mensajes:', error);
    return [];
  }
}

export async function fetchConversationMessages(conversationId: string, userId: string): Promise<Message[]> {
  // Intentar obtener del caché primero
  const cachedMessages = await cache.get('messages', conversationId)
  if (cachedMessages) {
    return cachedMessages as Message[]
  }

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching messages:', error)
      return []
    }

    // Invertir para mantener el orden cronológico
    const chronologicalMessages = [...data].reverse()
    
    // Guardar en caché con expiración de 30 segundos
    await cache.set('messages', conversationId, chronologicalMessages)
    return chronologicalMessages as Message[]
  } catch (error) {
    console.error('Error in fetchConversationMessages:', error)
    return []
  }
}

export async function sendMessage(message: Partial<Message>): Promise<Message | null> {
  try {
    // Verificar si es un mensaje duplicado reciente (dentro de 5 segundos)
    const key = `${message.conversation_id}-${message.content}`
    const recentMessage = recentMessages.get(key)
    if (recentMessage && Date.now() - recentMessage.timestamp < 5000) {
      console.log('Preventing duplicate message')
      return null
    }

    // Registrar el mensaje como reciente
    recentMessages.set(key, {
      content: message.content!,
      timestamp: Date.now()
    })

    // Limpiar mensajes antiguos (más de 10 segundos)
    for (const [key, value] of recentMessages.entries()) {
      if (Date.now() - value.timestamp > 10000) {
        recentMessages.delete(key)
      }
    }

    // Verificar si el mensaje ya existe en la base de datos
    // Intentar conseguir mensajes recientes para esta conversación
    try {
      const { data: existingMessages, error: queryError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', message.conversation_id)
        .eq('content', message.content)
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (existingMessages && existingMessages.length > 0) {
        // Verificar si hay mensajes idénticos recientes (dentro de 5 segundos)
        const isDuplicate = existingMessages.some(msg => {
          const msgTime = new Date(msg.created_at).getTime();
          const now = Date.now();
          return now - msgTime < 5000;
        });
        
        if (isDuplicate) {
          console.log('Mensaje duplicado detectado en la base de datos');
          return existingMessages[0];
        }
      }
    } catch (err) {
      console.error('Error al verificar duplicados:', err);
    }

    const { data, error } = await supabase
      .from('messages')
      .insert([message])
      .select()
      .single()

    if (error) {
      console.error('Error sending message:', error)
      return null
    }

    if (data) {
      // Obtener mensajes actuales de la conversación para asegurar consistencia
      const existingMessages = await getMessagesForConversation(data.conversation_id) || [];
      
      // Asegurar que el mensaje no esté duplicado
      const messageExists = existingMessages.some((m: any) => 
        m.id === data.id || 
        (m.content === data.content && 
         Math.abs(new Date(m.timestamp || m.created_at).getTime() - new Date(data.created_at).getTime()) < 5000)
      );
      
      if (!messageExists) {
        // Convertir el mensaje al formato UIMessage
        const uiMessage: UIMessage = {
          id: data.id,
          conversationId: data.conversation_id,
          content: data.content || '',
          timestamp: data.created_at,
          sender: data.sender_type === 'agent' ? 'me' : 'them',
          status: 'sent',
          type: 'text',
          sender_type: data.sender_type
        };
        
        // Agregar el mensaje a la colección existente y guardar en todos los sistemas
        const updatedMessages = [...existingMessages, uiMessage];
        storeMessages(data.conversation_id, updatedMessages);
        
        console.log(`✅ Mensaje agregado y guardado correctamente en la conversación real: ${data.conversation_id}`);
      }
    }

    return data
  } catch (error) {
    console.error('Error in sendMessage:', error)
    return null
  }
}

export async function updateMessageRead(messageId: string, read: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('messages')
      .update({ read })
      .eq('id', messageId)

    if (error) {
      console.error('Error updating message read status:', error)
    }
  } catch (error) {
    console.error('Error in updateMessageRead:', error)
  }
}

export function invalidateMessagesCache(conversationId: string): void {
  cache.invalidate('messages', conversationId)
}

export async function handleOptimisticMessageUpdate(
  conversationId: string,
  tempMessage: Message,
  finalMessage: Message
): Promise<void> {
  try {
    // Verificar si el mensaje temporal existe antes de actualizarlo
    const cachedMessages = await cache.get('messages', conversationId) as Message[] || []
    const tempExists = cachedMessages.some((m: Message) => m.id === tempMessage.id)
    
    if (tempExists) {
      await cache.handleOptimisticUpdate('messages', conversationId, tempMessage, finalMessage)
    }
  } catch (error) {
    console.error('Error in handleOptimisticMessageUpdate:', error)
  }
}

/**
 * Servicio para manejo de mensajes y conversaciones
 * Este archivo contiene funciones relacionadas con la transformación, carga y
 * procesamiento de mensajes para el sistema de chat.
 */

/**
 * Transforma un mensaje de la base de datos al formato UI
 */
export function transformMessage(message: any): UIMessage {
  // Verificar si el mensaje ya tiene el formato UIMessage
  if (message.sender === 'me' || message.sender === 'them') {
    return message as UIMessage;
  }
  
  // Asegurarse de que siempre hay un timestamp válido
  let timestamp = message.timestamp || message.created_at || new Date().toISOString();
  
  // Verificar y corregir formato de timestamp si es necesario
  if (typeof timestamp === 'string') {
    const parsedDate = new Date(timestamp);
    if (!isNaN(parsedDate.getTime())) {
      // Si es válido, normalizar al formato ISO estándar
      timestamp = parsedDate.toISOString();
    } else {
      // Si no es válido, usar la hora actual
      console.warn(`Timestamp inválido detectado: ${timestamp}, usando hora actual`);
      timestamp = new Date().toISOString();
    }
  } else if (timestamp instanceof Date) {
    timestamp = timestamp.toISOString();
  } else {
    // Para cualquier otro tipo, usar la hora actual
    timestamp = new Date().toISOString();
  }
  
  // Modificación: siempre mostrar mensajes de bot o agent como 'me' (a la derecha)
  let isSentByMe = false;
  
  // Los mensajes con sender_type 'bot' o 'agent' siempre se posicionan a la derecha
  // También consideramos mensajes enviados desde el dashboard, incluso si tienen sender_type 'user'
  if (message.sender_type === 'bot' || 
      message.sender_type === 'agent' || 
      message.sender_type === 'system' || 
      message.user_id === 'agent' ||
      message.sender === 'me' ||
      // Verificar si es un mensaje enviado desde el dashboard (añadir esta condición)
      (message.sent_from_dashboard === true) ||
      // Verificamos también si la conversación corresponde y se envió desde el dashboard (otra forma de detectarlo)
      (message.conversation && message.conversation.business_id && message.sent_by_business === true) ||
      // En algunos casos, el sender_type es 'user' pero fue enviado desde el dashboard
      (message.metadata && message.metadata.source === 'dashboard') ||
      (message.payload && message.payload.sender === 'agent') ||
      (message.metadata && message.metadata.sender_type === 'agent')) {
    isSentByMe = true;
  }
  
  // Para asegurar que cualquier mensaje enviado desde el dashboard se muestre a la derecha
  // Este caso es más simple pero detecta muchos mensajes enviados manualmente
  if (message.sender_type === 'user' && !message.user_id && message.conversation_id) {
    isSentByMe = true;
  }
  
  // Log para depuración de problemas de remitente
  console.log(`Mensaje ${message.id?.substring(0, 8)}: sender_type=${message.sender_type}, user_id=${message.user_id}, clasificado como ${isSentByMe ? 'me' : 'them'}`);
  
  return {
    id: message.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    conversationId: message.conversationId || message.conversation_id,
    content: message.content || message.message || "",
    timestamp: timestamp,
    sender: isSentByMe ? 'me' : 'them',
    status: message.status || "sent",
    type: message.type || "text",
    user_id: message.user_id || "",
    sender_type: message.sender_type || "",
    error: message.error || false
  };
}

/**
 * Transforma un array de mensajes del formato API al formato UI
 */
export function transformMessages(messages: any[]): UIMessage[] {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    console.log('No hay mensajes para transformar o el formato es inválido');
    return [];
  }
  
  try {
    // Asegurar que el array esté ordenado cronológicamente
    const sortedMessages = [...messages].sort((a, b) => {
      const dateA = new Date(a.created_at || a.timestamp).getTime();
      const dateB = new Date(b.created_at || b.timestamp).getTime();
      return dateA - dateB;
    });
    
    // Mapear los mensajes al formato de la UI
    return sortedMessages.map(msg => {
      if (!msg) return null;
      
      // Usar la función transformMessage para mantener la misma lógica
      return transformMessage(msg);
    }).filter(Boolean) as UIMessage[]; // Filtrar valores nulos
  } catch (error) {
    console.error('Error al transformar mensajes:', error);
    return [];
  }
}

/**
 * Maneja la llegada de un nuevo mensaje
 */
export const handleNewMessage = (
  message: any,
  currentMessages: UIMessage[],
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>> | ((updater: (messages: UIMessage[]) => UIMessage[]) => void),
  updateConversation?: (id: string, lastMessage: string, timestamp: string) => void,
  scrollToBottom?: () => void
) => {
  if (!message) {
    console.warn('Mensaje nulo o indefinido recibido');
    return;
  }

  try {
    // Transformar el mensaje al formato de UI
    const transformedMessage = transformMessage(message);
    
    if (!transformedMessage) {
      console.warn('No se pudo transformar el mensaje', message);
      return;
    }
    
    // Verificar si el mensaje ya existe para evitar duplicados
    // Usar una función de actualización compatible con ambos tipos de setMessages
    const updateMessagesFunction = (prevMessages: UIMessage[]) => {
      // Si el mensaje ya existe, no hacer nada
      if (prevMessages.some((msg: UIMessage) => msg.id === transformedMessage.id)) {
        return prevMessages;
      }
      
      // Ordenar los mensajes por fecha
      const sortedMessages = [...prevMessages, transformedMessage].sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();
        return dateA - dateB;
      });
      
      // Hacer scroll después de que se actualice el estado
      if (scrollToBottom) {
        setTimeout(() => scrollToBottom(), 100);
      }
      
      return sortedMessages;
    };
    
    // Llamar a setMessages con la función de actualización
    setMessages(updateMessagesFunction);
    
    // Actualizar la conversación en la lista para reflejar el último mensaje
    if (updateConversation && transformedMessage.conversationId) {
      updateConversation(
        transformedMessage.conversationId,
        transformedMessage.content,
        transformedMessage.timestamp
      );
    }
  } catch (error) {
    console.error('❌ Error al manejar mensaje nuevo:', error);
  }
}; 