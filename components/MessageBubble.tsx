import React from 'react';
import Image from 'next/image';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { DatabaseMessage } from '@/types';

// Extender la interfaz DatabaseMessage para incluir los campos necesarios
interface ExtendedDatabaseMessage extends DatabaseMessage {
  media_url?: string;
  attachment_url?: string;
}

interface MessageBubbleProps {
  message: ExtendedDatabaseMessage;
  isUserMessage?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isUserMessage = false }) => {
  // Determinar si el mensaje tiene una imagen adjunta
  const hasImage = message.file_url || message.media_url || message.attachment_url;
  const imageUrl = message.file_url || message.media_url || message.attachment_url;
  
  // Función para manejar errores de carga de imágenes
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('Error al cargar imagen:', imageUrl);
    e.currentTarget.src = 'https://via.placeholder.com/400x300?text=Imagen+no+disponible';
    e.currentTarget.style.maxWidth = '250px';
    e.currentTarget.style.height = 'auto';
  };

  return (
    <div className={`flex mb-2 w-full ${isUserMessage ? 'justify-end' : 'justify-start'}`}>
      {!isUserMessage && (
        <div className="mr-2 bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center">
          B
        </div>
      )}
      
      <Card className={`max-w-[75%] ${isUserMessage ? 'bg-primary/10' : 'bg-background'} rounded-lg`}>
        <div className="p-3">
          {/* Mostrar imagen si existe */}
          {hasImage && (
            <div className="mb-2 max-w-full rounded overflow-hidden">
              <img
                src={imageUrl}
                alt="Imagen adjunta"
                className="w-full max-h-[300px] object-contain"
                onError={handleImageError}
              />
            </div>
          )}
          
          {/* Mostrar el texto del mensaje */}
          <div className="text-sm">
            {message.content || message.message}
          </div>
          
          {/* Mostrar hora del mensaje */}
          <div className="text-xs text-right mt-1 opacity-70">
            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </Card>
      
      {isUserMessage && (
        <div className="ml-2 bg-secondary text-secondary-foreground rounded-full w-8 h-8 flex items-center justify-center">
          T
        </div>
      )}
    </div>
  );
}; 