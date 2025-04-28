/**
 * Cliente API para interactuar con el servidor
 */

import type { Conversation, Message } from "@/lib/database";
import { API_BASE_URL } from '@/components/config';

/**
 * Obtener todas las conversaciones para un negocio
 * @param businessId ID del negocio
 * @returns Array de conversaciones
 */
export const fetchConversations = async (businessId: string): Promise<Conversation[]> => {
  console.log(`[api-client] fetchConversations llamado con businessId: ${businessId}`);
  
  // Validación adicional para el ID de negocio
  if (!businessId) {
    console.error('[api-client] Error: businessId es requerido');
    return [];
  }
  
  const url = `${API_BASE_URL}/api/conversations/business/${businessId}`;
  console.log(`[api-client] Fetching conversations from: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Error al obtener conversaciones: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[api-client] Error al recuperar conversaciones:', error);
    
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error('[api-client] Error de conexión. Verifique que el servidor esté ejecutándose.');
    }
    
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error('[api-client] CORS detectado. Revise que el servidor esté configurado correctamente.');
      console.error('[api-client] El servidor en localhost:3010 debe permitir solicitudes desde http://localhost:3000');
    }
    
    return [];
  }
};

/**
 * Obtener mensajes para una conversación específica
 * @param conversationId ID de la conversación
 * @returns Array de mensajes
 */
export const fetchMessages = async (conversationId: string): Promise<Message[]> => {
  if (!conversationId) {
    console.error('[api-client] Error: conversationId es requerido');
    return [];
  }
  
  const url = `${API_BASE_URL}/api/messages/${conversationId}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Error al obtener mensajes: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[api-client] Error al recuperar mensajes:', error);
    return [];
  }
};

/**
 * Enviar un mensaje a una conversación
 * @param conversationId ID de la conversación
 * @param message Contenido del mensaje
 * @param senderType Tipo de remitente (usuario o bot)
 * @returns El mensaje creado o null en caso de error
 */
export const sendMessage = async (conversationId: string, message: string, senderType: string = 'bot'): Promise<Message | null> => {
  if (!conversationId || !message) {
    console.error('[api-client] Error: conversationId y message son requeridos');
    return null;
  }
  
  const url = `${API_BASE_URL}/api/messages`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        conversation_id: conversationId,
        message,
        sender_type: senderType
      })
    });
    
    if (!response.ok) {
      throw new Error(`Error al enviar mensaje: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[api-client] Error al enviar mensaje:', error);
    return null;
  }
}; 