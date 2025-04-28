import React, { useEffect, useState } from 'react';
import { MessageBubble } from './MessageBubble';

const MinimalChatInterface = ({ conversationId }: { conversationId?: string }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Cargar mensajes desde localStorage al inicio
  useEffect(() => {
    if (!conversationId) return;
    
    const loadMessages = () => {
      try {
        setLoading(true);
        // Intentar cargar mensajes del localStorage para esta conversación
        const storageKey = `conversation_messages_${conversationId}`;
        const storedMessages = localStorage.getItem(storageKey);
        
        if (storedMessages) {
          const parsedMessages = JSON.parse(storedMessages);
          console.log(`✅ Obtenidos ${parsedMessages.length} mensajes para conversación ${conversationId}`);
          setMessages(parsedMessages);
        }
      } catch (error) {
        console.error('❌ Error al cargar mensajes:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadMessages();
    
    // También recargar cuando la clave de localStorage cambie
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === `conversation_messages_${conversationId}`) {
        loadMessages();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Escuchar eventos personalizados para actualizar mensajes
    const handleNewMessage = (event: CustomEvent) => {
      if (event.detail?.message) {
        const newMessage = event.detail.message;
        if (newMessage.conversation_id === conversationId) {
          setMessages(prev => [...prev, newMessage]);
        }
      }
    };
    
    const handleRefresh = (event: CustomEvent) => {
      if (event.detail?.conversationId === conversationId) {
        loadMessages();
      }
    };
    
    window.addEventListener('chat-message-received', handleNewMessage as EventListener);
    window.addEventListener('force-messages-refresh', handleRefresh as EventListener);
    
    // Comprobar mensajes con imágenes para depuración
    const checkLocalStorageForImages = () => {
      try {
        const storageKey = `conversation_messages_${conversationId}`;
        const storageMessages = JSON.parse(localStorage.getItem(storageKey) || '[]');
        
        storageMessages.forEach((msg: any) => {
          if (msg.file_url || msg.media_url || msg.attachment_url) {
            console.log(`🖼️ Imagen encontrada en localStorage:`, msg);
          }
        });
      } catch (e) {
        console.error('Error al revisar localStorage:', e);
      }
    };
    
    checkLocalStorageForImages();
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('chat-message-received', handleNewMessage as EventListener);
      window.removeEventListener('force-messages-refresh', handleRefresh as EventListener);
    };
  }, [conversationId]);

  const renderMessages = () => {
    if (loading) {
      return <div className="flex justify-center p-4">Cargando mensajes...</div>;
    }
    
    if (!messages.length) {
      return (
        <div className="flex justify-center items-center h-[50vh] text-gray-500">
          <p>No hay mensajes en esta conversación.</p>
        </div>
      );
    }

    return messages.map((message, index) => {
      const isUserMessage = message.sender === 'user';
      
      // Depurar mensajes con imágenes
      if (message.file_url || message.media_url || message.attachment_url) {
        console.log('📸 Mensaje con imagen detectado:', JSON.stringify(message, null, 2));
      }
      
      return (
        <div key={message.id || `msg-${index}`} className="mb-4">
          <MessageBubble 
            message={message} 
            isUserMessage={isUserMessage} 
          />
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col gap-2 p-4">
      {renderMessages()}
    </div>
  );
};

export default MinimalChatInterface; 