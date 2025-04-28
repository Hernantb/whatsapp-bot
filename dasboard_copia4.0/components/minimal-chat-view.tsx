"use client"

import React, { memo } from "react"

import { useState, useRef, useEffect, useMemo, useCallback, useTransition, useDeferredValue } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Send, ArrowLeft, Check, CheckCheck, ImageIcon, Paperclip, X, Download, File, Trash, Bot, BotOff, ChevronLeft, MessageSquare, Loader2, Trash2, MoreVertical, User, Clock } from "lucide-react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { UserAvatar } from "./user-avatar"
import { UIConversation, UIMessage } from "@/types"
import Image from "next/image"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast, useToast } from "@/components/ui/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { SendHorizonal } from "lucide-react"
import { FaWhatsapp } from "react-icons/fa"
import { IoCamera } from 'react-icons/io5'
import * as api from '@/lib/api-client'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface Message {
  id: string
  conversationId: string
  content: string
  timestamp: string
  status: "sent" | "delivered" | "read" | "received" | "pending"
  sender: "me" | "them"
  type: "text" | "image" | "file"
  fileName?: string
  fileSize?: string
  user_id: string
  error?: string
  mediaUrl?: string
  sentToWhatsApp?: boolean
  sentToWhatsAppAt?: string
}

interface Conversation {
  id: string
  name: string
  user_id: string
  lastMessage: string
  timestamp: string
  unread: boolean
  status: "online" | "offline" | "typing"
  isBusinessAccount: boolean
  labels: string[]
  colorLabel: string
  userCategory?: "default" | "important" | "urgent" | "completed"
  assignedTo?: string
  botActive: boolean
  phone: string
}

export interface MinimalChatViewProps {
  conversation: any;
  messages: UIMessage[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onBack: () => void;
  onToggleBot: (conversationId: string, active: boolean) => void;
  onDeleteConversation: (conversation: Conversation) => void;
  onUpdateConversation: (conversation: any) => void;
  business?: boolean;
}

// Extender la interfaz UIMessageExtended para incluir los campos de WhatsApp
interface UIMessageExtended extends UIMessage {
  media_url?: string;
  media_type?: string;
  file_name?: string;
  file_size?: string;
  error?: string;
  sentToWhatsApp?: boolean;
  sentToWhatsAppAt?: string;
}

// Renombrar File a FileIcon para mantener la consistencia con el uso
const FileIcon = File;

// Memoized mensaje individual para reducir renderizados
const MessageItem = memo(({ 
  message, 
  formatMessageTime,
  onImageLoad,
  conversation,
  onUpdateConversation
}: { 
  message: UIMessageExtended, 
  formatMessageTime: (timestamp: string) => string,
  onImageLoad?: () => void,
  conversation: any,
  onUpdateConversation: (conversation: any) => void
}) => {
  const [imageVersion, setImageVersion] = useState(Date.now());
  const [forceRender, setForceRender] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isCurrentlySending, setIsCurrentlySending] = useState(false);
  const { toast } = useToast();
  const messageId = message.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  // Intenta parsear el contenido si parece ser JSON
  let parsedContent: any = null;
  
  try {
    if (message.content && (message.content.startsWith('{') || message.content.includes('type'))) {
      parsedContent = JSON.parse(message.content);
      console.log(`📄 Contenido JSON parseado para mensaje ${messageId}:`, parsedContent);
    }
  } catch (e) {
    console.debug("No se pudo parsear el contenido como JSON:", message.content);
  }
  
  // Determinar si es una imagen a través de múltiples métodos
  const isImage = message.type === "image" || 
                 (parsedContent && parsedContent.type === "image") ||
                 (message.media_url && message.media_type && message.media_type.startsWith('image/')) ||
                 (parsedContent && parsedContent.mimeType && parsedContent.mimeType.startsWith('image/'));
  
  // Obtener la URL de la imagen de todas las posibles fuentes
  let imageUrl = message.media_url || 
                (parsedContent && parsedContent.publicUrl) ||
                (parsedContent && parsedContent.url) || 
                (parsedContent && parsedContent.media_url) ||
                (isImage ? message.content : null);

  const fileName = message.fileName || 
                  (parsedContent && parsedContent.fileName) || 
                  message.file_name || '';
                  
  const fileSize = message.fileSize || 
                  (parsedContent && parsedContent.fileSize) || 
                  message.file_size || '';
  
  // Log para depuración extensiva
  useEffect(() => {
    if (isImage) {
      console.log(`🖼️ Renderizando imagen en mensaje ${messageId}:`, { 
        id: message.id,
        type: message.type,
        isImage: isImage,
        imageUrl: imageUrl,
        media_url: message.media_url,
        media_type: message.media_type,
        content: message.content?.substring(0, 100),
        parsedContent: parsedContent,
        message: message
      });
    }
  }, [message.id, imageUrl, messageId, parsedContent]);

  // Sistema agresivo de verificación para imágenes
  useEffect(() => {
    if (!isImage || !imageUrl) return;
    
    console.log(`🔄 Sistema de verificación de imagen para mensaje ${messageId}: ${imageUrl}`);
    
    // Verificación inicial
    fetch(imageUrl, { method: 'HEAD' })
      .then(response => {
        console.log(`📊 Verificación inicial: ${response.status} para ${imageUrl}`);
        if (response.ok) {
          setImageLoaded(true);
          setImageVersion(Date.now());
        } else {
          console.log(`⚠️ Imagen no disponible (${response.status}), programando reintentos`);
          setImageError(true);
          startRetrySequence();
        }
      })
      .catch(error => {
        console.error(`❌ Error en verificación: ${error.message}`);
        setImageError(true);
        startRetrySequence();
      });
    
    // Función para iniciar secuencia de reintentos
    function startRetrySequence() {
      const checkImage = () => {
        if (imageLoaded) return;
        
        console.log(`🔄 Intento ${forceRender+1} para ${imageUrl}`);
        
        const img = document.createElement('img');
        img.onload = () => {
          console.log(`✅ Imagen cargada en intento ${forceRender+1}`);
          setImageLoaded(true);
          setImageError(false);
          setImageVersion(Date.now());
        };
        
        img.onerror = () => {
          setImageError(true);
          setForceRender(prev => {
            const newValue = prev + 1;
            if (newValue < 20) {
              setTimeout(checkImage, 1000);
            }
            return newValue;
          });
        };
        
        img.src = `${imageUrl}?v=${Date.now()}`;
      };
      
      checkImage();
    }
  }, [isImage, imageUrl, messageId, forceRender, imageLoaded]);

  // Función para recargar manualmente
  const reloadImage = useCallback(() => {
    if (!isImage || !imageUrl) return;
    
    console.log(`🔄 Recarga manual: ${imageUrl}`);
    setImageVersion(Date.now());
    setImageError(false);
    
    // Forzar recarga
    const img = document.createElement('img');
    img.onload = () => {
      console.log(`✅ Recarga manual exitosa: ${imageUrl}`);
      setImageLoaded(true);
      
      // Actualizar DOM si es posible
      const imgElement = document.querySelector(`#img-${messageId}`) as HTMLImageElement;
      if (imgElement) {
        imgElement.src = `${imageUrl}?v=${Date.now()}`;
        imgElement.style.opacity = "1";
      }
    };
    img.onerror = () => {
      console.error(`❌ Recarga fallida: ${imageUrl}`);
      setImageError(true);
    };
    img.src = `${imageUrl}?v=${Date.now()}`;
  }, [isImage, imageUrl, messageId]);

  // Actualizar la función para enviar imágenes a WhatsApp
  const handleSendImageToWhatsApp = async () => {
    if (!message || !message.media_url || !conversation) {
      console.error("No se puede enviar imagen: faltan datos necesarios");
      return;
    }
    
    try {
      setIsCurrentlySending(true);
      
      // Verificar si tenemos un número de teléfono para esta conversación
      if (!conversation.user_id) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No hay número de teléfono asociado a esta conversación"
        });
        return;
      }
      
      console.log(`Enviando imagen a WhatsApp: ${message.media_url?.substring(0, 100)}...`);
      
      // Llamar al endpoint que envía imágenes a WhatsApp
      const response = await fetch('/api/send-whatsapp-media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: conversation.user_id,
          mediaUrl: message.media_url,
          caption: message.content || '',
          conversationId: conversation.id
        }),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        toast({
          variant: "default",
          title: "Éxito",
          description: "Imagen enviada a WhatsApp correctamente"
        });
        
        // Actualizar los mensajes a través de onUpdateConversation
        const updatedMessages = Array.isArray(conversation.messages) ? 
          conversation.messages.map((m: UIMessageExtended) => {
            if (m.id === message.id) {
              return {
                ...m,
                sentToWhatsApp: true,
                sentToWhatsAppAt: new Date().toISOString()
              };
            }
            return m;
          }) : 
          []; // Si no hay mensajes, devolver un array vacío
        
        // Llamar a la función de actualización de la conversación
        onUpdateConversation({
          ...conversation,
          messages: updatedMessages
        });
      } else {
        console.error("Error enviando imagen a WhatsApp:", result.error);
        toast({
          variant: "destructive",
          title: "Error",
          description: `Error al enviar imagen: ${result.error || 'Error desconocido'}`
        });
      }
    } catch (error) {
      console.error("Error enviando imagen a WhatsApp:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al enviar imagen a WhatsApp"
      });
    } finally {
      setIsCurrentlySending(false);
    }
  };
  
  return (
    <div className={cn("flex", message.sender === "me" ? "justify-end" : "justify-start")} id={`msg-${messageId}`}>
      <div
        className={cn(
          "max-w-xs sm:max-w-md md:max-w-lg px-3 py-1.5 rounded-lg text-sm",
          message.sender === "me"
            ? "bg-[#332c40] text-white rounded-br-none" // Morado para mensajes enviados
            : "bg-white text-gray-800 dark:text-gray-800 rounded-bl-none border border-gray-200"
        )}
      >
        {message.type === "text" && <p>{message.content}</p>}

        {isImage && (
          <div className="space-y-1">
            <div className="relative rounded overflow-hidden bg-gray-100 dark:bg-gray-800">
              {imageError ? (
                <div 
                  className="flex flex-col items-center justify-center p-4 bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-pointer"
                  onClick={reloadImage}
                >
                  <span className="text-xs mb-1">Error al cargar imagen</span>
                  <Button variant="outline" size="sm" onClick={reloadImage}>
                    Reintentar
                  </Button>
                </div>
              ) : (
                <img
                  id={`img-${messageId}`}
                  src={`${imageUrl}?v=${imageVersion}`}
                  alt="Imagen compartida"
                  className={cn(
                    "max-w-full max-h-[200px] object-contain transition-opacity duration-300",
                    !imageLoaded && "opacity-60"
                  )}
                  onLoad={() => {
                    setImageLoaded(true);
                    onImageLoad?.();
                  }}
                  onError={reloadImage}
                />
              )}
            </div>
            {fileName && (
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{fileName}</span>
                <span>{fileSize}</span>
              </div>
            )}
          </div>
        )}

        {message.type === "file" && (
          <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-md p-2 gap-2">
            <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-md">
              <FileIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{fileName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{fileSize}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 dark:text-blue-400">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Mostrar mensaje de error si existe */}
        {(message as any).error && (
          <div className="text-xs text-red-500 mt-1">
            Error al enviar. Toca para reintentar.
          </div>
        )}

        <div className="flex items-center justify-end mt-1 space-x-1">
          <span className="text-[9px] opacity-70">
            {formatMessageTime(message.timestamp)}
          </span>
          {message.sender === "me" &&
            (message.status === "read" ? (
              <CheckCheck className="h-2.5 w-2.5 opacity-70" />
            ) : message.status === "delivered" ? (
              <CheckCheck className="h-2.5 w-2.5 opacity-70" />
            ) : message.status === "pending" ? (
              <Check className="h-2.5 w-2.5 opacity-70" />
            ) : (
              <Check className="h-2.5 w-2.5 opacity-70" />
            ))}
        </div>

        {message.media_url && (
          <div className="flex flex-row space-x-4 text-xs mb-2">
            <a
              href={message.media_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
              download
            >
              Descargar imagen
            </a>
            
            {message.sender_type === 'bot' && !message.sentToWhatsApp && (
              <button
                onClick={handleSendImageToWhatsApp}
                className="text-green-500 hover:underline focus:outline-none flex items-center"
                disabled={isCurrentlySending}
              >
                <FaWhatsapp className="mr-1" />
                {isCurrentlySending ? 'Enviando...' : 'Enviar a WhatsApp'}
              </button>
            )}
            
            {message.sentToWhatsApp && (
              <span className="text-green-500 flex items-center">
                <FaWhatsapp className="mr-1" />
                Enviado a WhatsApp
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// Asignar un nombre para debugging
MessageItem.displayName = 'MessageItem';

// Memoized group de mensajes para reducir renderizados
const MessageGroup = memo(({ 
  date, 
  messages, 
  formatMessageTime,
  conversation,
  onUpdateConversation
}: { 
  date: string, 
  messages: UIMessage[], 
  formatMessageTime: (timestamp: string) => string,
  conversation: any,
  onUpdateConversation: (conversation: any) => void
}) => {
  return (
    <div className="mb-6">
      <div className="flex justify-center mb-4">
        <div className="text-xs bg-white px-2 py-1 rounded-full text-gray-500 shadow-sm">
          {date}
        </div>
      </div>
      <div className="space-y-2">
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message as UIMessageExtended}
            formatMessageTime={formatMessageTime}
            conversation={conversation}
            onUpdateConversation={onUpdateConversation}
          />
        ))}
      </div>
    </div>
  );
});

// Asignar un nombre para debugging
MessageGroup.displayName = 'MessageGroup';

function formatFileSize(size: string | number): string {
  const numSize = typeof size === "string" ? parseInt(size) : size;
  if (isNaN(numSize)) return "0 B";

  if (numSize < 1024) return `${numSize} B`;
  if (numSize < 1024 * 1024) return `${(numSize / 1024).toFixed(1)} KB`;
  if (numSize < 1024 * 1024 * 1024) return `${(numSize / (1024 * 1024)).toFixed(1)} MB`;
  return `${(numSize / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// Styles para la barra de dashboard
const styles = {
  dashboardSidebar: "bg-[#332c40] dark:bg-[#26212f] text-white"
};

export default function MinimalChatView({
  conversation,
  messages,
  isLoading,
  onSendMessage,
  onBack,
  onToggleBot,
  onDeleteConversation,
  onUpdateConversation,
  business
}: MinimalChatViewProps) {
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [fileToSend, setFileToSend] = useState<{ name: string; size: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const [isSendingToWhatsApp, setIsSendingToWhatsApp] = useState(false)
  const [currentSendingId, setCurrentSendingId] = useState<string | null>(null)
  const [isCurrentlySending, setIsCurrentlySending] = useState(false);
  const { toast } = useToast();

  const scrollToBottom = (smooth = false) => {
    if (messagesEndRef.current) {
      if (smooth) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
      } else {
        messagesEndRef.current.scrollIntoView()
      }
    }
  }

  const groupMessagesByDate = (messages: UIMessage[]) => {
    return messages.reduce((groups, message) => {
        const date = new Date(message.timestamp);
      const dateKey = format(date, "yyyy-MM-dd");
        if (!groups[dateKey]) {
          groups[dateKey] = [];
        }
        groups[dateKey].push(message);
      return groups;
    }, {} as Record<string, UIMessage[]>);
  }

  const formatGroupDate = (dateKey: string) => {
    // Convertir fecha ISO a objeto Date
    const date = new Date(dateKey);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Formatear según sea hoy, ayer o una fecha anterior
    if (date.getTime() === today.getTime()) {
      return "Hoy";
    } else if (date.getTime() === yesterday.getTime()) {
      return "Ayer";
    } else {
      return format(date, "d 'de' MMMM, yyyy", { locale: es });
    }
  };

  const formatMessageTime = (timestamp: string) => {
    return format(new Date(timestamp), "HH:mm");
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        onSendMessage(input);
        setInput("");
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input);
      setInput("");
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (!file) return;
    
    // Verificar tamaño del archivo (limitar a 10MB)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      toast({
        title: "Archivo demasiado grande",
        description: "La imagen no debe superar los 10MB",
        variant: "destructive",
      });
      // Limpiar input
      if (e.target.value) e.target.value = '';
      return;
    }
    
    try {
      setIsSending(true);
      
      toast({
        title: "Enviando",
        description: "Enviando imagen...",
      });
      
      if (conversation) {
        // Usar FormData directamente en lugar de la función que podría activar confirmaciones
        const formData = new FormData();
        formData.append("file", file);
        formData.append("conversationId", conversation.id);
        formData.append("caption", 'Imagen enviada desde el dashboard');
        
        // Enviar directamente al endpoint sin confirmación
        const response = await fetch("/api/send-image-to-whatsapp", {
          method: "POST",
          body: formData,
          credentials: 'include', // Incluir cookies
        });
        
        // Verificar si la respuesta es JSON o HTML
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          // Si no es JSON, podría ser una redirección o HTML de error
          const text = await response.text();
          console.error('Respuesta no-JSON recibida:', text.substring(0, 150) + '...');
          throw new Error('Respuesta del servidor no es JSON. Posible problema de autenticación.');
        }
        
        // Ahora sabemos que es JSON
        const data = await response.json();
        console.log("Respuesta del servidor:", data);
        
        if (!response.ok) {
          throw new Error(data.error || `Error del servidor: ${response.status}`);
        }
        
        // Recargar mensajes para mostrar la imagen en el chat
        if (onUpdateConversation && conversation) {
          onUpdateConversation(conversation);
        }
        
        toast({
          title: "Éxito",
          description: "Imagen enviada correctamente"
        });
      } else {
        throw new Error("No hay una conversación activa");
      }
      
      // Limpiar el input de archivo para permitir seleccionar la misma imagen de nuevo
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
    } catch (error) {
      console.error('Error al enviar imagen a WhatsApp:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Error al enviar imagen: ${error instanceof Error ? error.message : 'Error desconocido'}`
      });
    } finally {
      setIsSending(false);
    }
  };

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (file) {
      // Check file size (limit to 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Archivo demasiado grande",
          description: "El archivo no debe superar los 10MB",
          variant: "destructive",
        });
        e.target.value = "";
      return;
    }
    
      try {
        setIsSending(true);
        
        // Importar de forma dinámica para evitar problemas de dependencias circulares
        const { uploadFile } = await import('@/lib/api-client');
        
        setFileToSend({
          name: file.name,
          size: formatFileSize(file.size),
        });
        
        if (!conversation?.id) {
          toast({
            title: "Error",
            description: "No hay una conversación seleccionada",
            variant: "destructive",
          });
          setIsSending(false);
          return;
        }
        
        await uploadFile(conversation.id, file, 'bot');
        
        setFileToSend(null);
        setIsSending(false);
        
        toast({
          title: "Archivo enviado",
          description: "El archivo se ha subido correctamente",
        });
        
        scrollToBottom();
        
      } catch (error: any) {
        console.error("Error al subir el archivo:", error);
        setIsSending(false);
        e.target.value = "";
        
        toast({
          title: "Error al enviar el archivo",
          description: error.message || "No se pudo enviar el archivo",
          variant: "destructive",
        });
      }
    }
  };

  const cancelAttachment = () => {
    setImagePreview(null);
    setFileToSend(null);
  };

  const handleImageButtonClick = () => {
    if (imageInputRef.current) {
      imageInputRef.current.click();
    }
  };

  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleDeleteConversation = () => {
    if (onDeleteConversation && conversation) {
    onDeleteConversation(conversation);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  useEffect(() => {
    if (!isLoading) {
      scrollToBottom();
    }
  }, [isLoading]);

  const groupedMessages = useMemo(() => groupMessagesByDate(messages), [messages]);

  const handleToggleBot = useCallback(() => {
    try {
      // Cambiar el estado actual del bot
      const newBotStatus = !conversation.botActive;
      
      // Agregar logs de depuración
      console.log(`🤖 Intentando ${newBotStatus ? 'ACTIVAR' : 'DESACTIVAR'} el bot para conversación: ${conversation.id}`);
      console.log(`🔍 Estado actual del bot antes de cambiar: ${conversation.botActive ? 'ACTIVO' : 'INACTIVO'}`);
      
      if (onToggleBot) {
        // Asegurarse de pasar el boolean como segundo parámetro
        onToggleBot(conversation.id, newBotStatus);
        console.log(`✅ Bot ${newBotStatus ? 'ACTIVADO' : 'DESACTIVADO'} correctamente a través de onToggleBot`);
        console.log(`👉 Parámetros enviados: id=${conversation.id}, active=${newBotStatus}`);
      }
      
      toast({
        title: newBotStatus ? "Bot activado" : "Bot desactivado",
        description: newBotStatus 
          ? "El bot ahora responderá automáticamente a los mensajes entrantes." 
          : "El bot ha sido desactivado. No responderá automáticamente.",
        duration: 3000,
      });
      
      console.log(`🤖 El bot ahora está ${newBotStatus ? 'ACTIVO' : 'INACTIVO'} para la conversación ${conversation.id}`);
    } catch (error) {
      console.error(`❌ Error al cambiar el estado del bot:`, error);
      
      toast({
        title: `Error al cambiar el estado del bot`,
        description: "Ocurrió un error. Por favor intenta nuevamente.",
        variant: "destructive",
        duration: 5000,
      });
    }
  }, [conversation, onToggleBot, toast]);

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-gray-500 space-y-4">
        <MessageSquare className="h-16 w-16 opacity-50" />
        <div className="text-center space-y-1">
          <h3 className="font-medium text-lg">No hay conversación seleccionada</h3>
          <p className="text-sm">Selecciona una conversación o inicia una nueva</p>
      </div>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col">
      <header className="sticky top-0 z-10 flex justify-between items-center p-4 border-b dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              {conversation?.name?.[0] || conversation?.user_id?.[0] || "?"}
            </div>
            <div>
              <h2 className="font-semibold">{conversation?.name || conversation?.user_id || "Contacto"}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {conversation?.user_id || "Sin información de contacto"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleToggleBot}
            className={cn(
              conversation.botActive 
                ? "bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800" 
                : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
            )}
            title={conversation.botActive ? "Desactivar bot" : "Activar bot"}
          >
            <Bot className={cn(
              "h-5 w-5",
              conversation.botActive ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-400"
            )} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuItem onClick={handleDeleteConversation}>
                <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                <span>Eliminar conversación</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ÁREA DE MENSAJES - con overflow explícito */}
      <div 
        className="flex-1 p-4 overflow-y-auto"
        style={{
          overflowY: 'auto',
          height: 'calc(100vh - 180px)' // Altura explícita, restando header y footer
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedMessages).map(([dateKey, msgs]) => (
            <MessageGroup 
                key={dateKey}
                date={formatGroupDate(dateKey)}
                messages={msgs}
              formatMessageTime={formatMessageTime} 
                conversation={conversation}
                onUpdateConversation={onUpdateConversation}
            />
            ))}
        <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ÁREA DE ENTRADA - diseño tradicional */}
      <div className="p-3 border-t bg-white dark:bg-gray-800">
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="flex items-center space-x-2 w-full max-w-full px-2">
            <input 
              type="file"
              ref={imageInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0"
              onClick={handleImageButtonClick}
              disabled={isSending}
            >
              <ImageIcon className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0"
              onClick={handleFileButtonClick}
              disabled={isSending}
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            <div className="relative flex-1">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe un mensaje..."
                className="min-h-[42px] py-2 pr-12 resize-none border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-400"
                onKeyDown={handleKeyPress}
              />
              <Button
                type="submit"
                size="icon"
                className="absolute top-1/2 right-2 transform -translate-y-1/2 h-8 w-8 rounded-full bg-[#332c40] hover:bg-[#403852] dark:bg-[#403852] dark:hover:bg-[#4a4260]"
                disabled={isSending || !input.trim() && !imagePreview && !fileToSend}
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <Send className="h-4 w-4 text-white" />
                )}
              </Button>
            </div>
          </div>

          {(imagePreview || fileToSend) && (
            <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-md w-full px-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium dark:text-gray-200">
                  {imagePreview ? "Imagen a enviar" : fileToSend?.name}
                </p>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-full dark:text-gray-300 dark:hover:bg-gray-600"
                  onClick={cancelAttachment}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {imagePreview && (
                <div className="mt-2 rounded overflow-hidden">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-[150px] object-contain border dark:border-gray-600"
                  />
                </div>
              )}
              {fileToSend && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{fileToSend.size}</p>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

