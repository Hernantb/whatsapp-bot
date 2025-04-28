import React, { useEffect, useState } from 'react';
import { MessageBubble } from './MessageBubble';

// Lista de contenidos de mensajes que sabemos que son del dashboard
const DASHBOARD_MESSAGES = [
  'hola', 'hello', 'hey', 'nada', 'hye', 'yuou', 'perro', 'gracias', 'Si ya', 
  'hello 4', 'que pedo', 'mejor a las 10:59', 'angus border', 'Prueba del servidor'
];

// IDs de conversaciones del dashboard
const DASHBOARD_CONVERSATIONS = [
  '4a42aa05-2ffd-418b-aa52-29e7c571eee8',
  'a92b4dcb-3e86-43ee-9af4-8ba2f7f3c80e'
];

const MinimalChatInterface = ({ conversationId }: { conversationId?: string }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Función para determinar si un mensaje es del dashboard (debe mostrarse a la derecha)
  const isDashboardMessage = (message: any) => {
    // Verificar si el mensaje es de tipo 'agent' - caso más común tras los cambios
    if (message.sender_type === 'agent') {
      return true;
    }
    
    // Compatibilidad con mensajes antiguos con sender_type 'bot'
    if (message.sender_type === 'bot') {
      return true;
    }

    // Verificar el remitente directo si ya está transformado
    if (message.sender === 'me') {
      return true;
    }
    
    // Verificar si la conversación es conocida como del dashboard (para mensajes sin tipo)
    if (conversationId && DASHBOARD_CONVERSATIONS.includes(conversationId)) {
      // Para mensajes en conversaciones del dashboard, verificar contenido
      if (message.content && typeof message.content === 'string') {
        const content = message.content.trim().toLowerCase();
        if (DASHBOARD_MESSAGES.some(msg => content.includes(msg.toLowerCase()))) {
          return true;
        }
      }
    }
    
    return false;
  };

  // Reiniciar completamente el localStorage para esta conversación
  const resetLocalStorage = () => {
    if (!conversationId) return;
    
    try {
      console.log(`🧹 Limpiando localStorage para conversación ${conversationId}...`);
      localStorage.removeItem(`messages_${conversationId}`);
      console.log('✅ localStorage limpiado exitosamente');
      window.location.reload(); // Recargar la página después de limpiar
    } catch (error) {
      console.error('❌ Error al limpiar localStorage:', error);
    }
  };

  // Cargar mensajes desde localStorage al inicio
  useEffect(() => {
    if (!conversationId) return;
    
    const loadMessages = () => {
      try {
        setLoading(true);
        // Intentar cargar mensajes del localStorage para esta conversación
        const storageKey = `messages_${conversationId}`;
        const storedMessages = localStorage.getItem(storageKey);
        
        if (storedMessages) {
          let parsedMessages = JSON.parse(storedMessages);
          console.log(`✅ Obtenidos ${parsedMessages.length} mensajes para conversación ${conversationId}`);
          
          // Corregir los mensajes del dashboard que pueden tener datos incorrectos
          if (DASHBOARD_CONVERSATIONS.includes(conversationId)) {
            parsedMessages = parsedMessages.map((msg: any) => {
              // Si el mensaje ya tiene sender_type='agent' o sender='me', mantenerlo como está
              if (msg.sender_type === 'agent' || msg.sender === 'me') {
                return msg;
              }
              
              // Verificar contenido para mensajes sin tipo correcto
              const content = msg.content?.trim()?.toLowerCase() || '';
              if (DASHBOARD_MESSAGES.some(dashMsg => content.includes(dashMsg.toLowerCase()))) {
                return {
                  ...msg,
                  sender: 'me',
                  sender_type: 'agent'  // Usamos 'agent' ahora que está permitido
                };
              }
              return msg;
            });
            
            // Guardar los mensajes corregidos de vuelta en localStorage
            localStorage.setItem(storageKey, JSON.stringify(parsedMessages));
          }
          
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
      if (event.key === `messages_${conversationId}`) {
        loadMessages();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Escuchar eventos personalizados para actualizar mensajes
    const handleNewMessage = (event: CustomEvent) => {
      if (event.detail?.message) {
        const newMessage = event.detail.message;
        if (newMessage.conversation_id === conversationId) {
          // Asegurarnos de que los nuevos mensajes tienen el formato correcto
          let processedMessage = {...newMessage};
          
          // Si es un mensaje del dashboard, asegurar que tiene sender_type='agent'
          if (DASHBOARD_CONVERSATIONS.includes(conversationId) && 
              DASHBOARD_MESSAGES.some(dashMsg => 
                newMessage.content?.toLowerCase().includes(dashMsg.toLowerCase())
              )) {
            processedMessage.sender = 'me';
            processedMessage.sender_type = 'agent';
          }
          
          setMessages(prev => [...prev, processedMessage]);
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
      // Determinar si es un mensaje de usuario o de dashboard/bot
      const isUserMessage = !isDashboardMessage(message);
      
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
      
      {/* Botón de reinicio para casos de emergencia */}
      <button 
        onClick={resetLocalStorage}
        className="mt-4 p-2 bg-red-500 text-white rounded text-xs opacity-40 hover:opacity-100"
        style={{position: 'fixed', right: '10px', bottom: '10px', zIndex: 10}}
      >
        Reiniciar Cache
      </button>
    </div>
  );
};

export default MinimalChatInterface; 