"use client"

import React, { memo } from "react"

import { useState, useRef, useEffect, useMemo, useCallback, useTransition, useDeferredValue } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Send, ArrowLeft, Check, CheckCheck, ImageIcon, Paperclip, X, Download, File, Trash, Bot, BotOff, ChevronLeft, MessageSquare, Loader2, Trash2, MoreVertical } from "lucide-react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { UserAvatar } from "./user-avatar"
import { UIMessage, UIConversation } from "@/types"
import Image from "next/image"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

interface Message {
  id: string
  conversationId: string
  content: string
  timestamp: string
  status: "sent" | "delivered" | "read" | "received"
  sender: "me" | "them"
  type: "text" | "image" | "file"
  fileName?: string
  fileSize?: string
  user_id: string
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

interface MinimalChatViewProps {
  conversation: Conversation;
  messages: UIMessage[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onBack: () => void;
  onToggleBot: (active: boolean) => void;
  onDeleteConversation: (conversation: Conversation) => void;
  onUpdateConversation: (conversation: Conversation) => void;
  business?: boolean;
}

// Memoized mensaje individual para reducir renderizados
const MessageItem = memo(({ 
  message, 
  formatMessageTime 
}: { 
  message: UIMessage, 
  formatMessageTime: (timestamp: string) => string 
}) => {
  return (
    <div key={message.id} className={cn("flex", message.sender === "me" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] px-3 py-2 rounded-2xl shadow-sm",
          message.sender === "me"
            ? "message-sent bg-indigo-700 text-white"
            : "message-received bg-white dark:bg-gray-700 text-gray-800 dark:text-white",
        )}
      >
        {message.type === "text" && <p className="text-sm">{message.content}</p>}

        {message.type === "image" && (
          <div className="space-y-1">
            <div className="relative">
              <img
                src={message.content || "/placeholder.svg"}
                alt="Shared image"
                className="rounded-md max-w-full max-h-[200px] object-contain"
              />
            </div>
            {message.fileName && (
              <div className="flex items-center justify-between text-xs text-gray-300 dark:text-gray-400">
                <span>{message.fileName}</span>
                <span>{message.fileSize}</span>
              </div>
            )}
          </div>
        )}

        {message.type === "file" && (
          <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-md p-2 gap-2">
            <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-md">
              <File className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{message.fileName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{message.fileSize}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 dark:text-blue-400">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex items-center justify-end mt-1 space-x-1">
          <span className="text-[10px] text-gray-300 dark:text-gray-500">
            {formatMessageTime(message.timestamp)}
          </span>
          {message.sender === "me" &&
            (message.status === "read" ? (
              <CheckCheck className="h-3 w-3 text-gray-300 dark:text-gray-500" />
            ) : message.status === "delivered" ? (
              <CheckCheck className="h-3 w-3 text-gray-300 dark:text-gray-500" />
            ) : (
              <Check className="h-3 w-3 text-gray-300 dark:text-gray-500" />
            ))}
        </div>
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
  formatMessageTime 
}: { 
  date: string, 
  messages: UIMessage[], 
  formatMessageTime: (timestamp: string) => string 
}) => {
  return (
    <div key={date} className="space-y-3">
      <div className="flex justify-center">
        <span className="text-xs bg-white/80 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-md shadow-sm">
          {date}
        </span>
      </div>

      {messages.map((message) => (
        <MessageItem 
          key={message.id} 
          message={message} 
          formatMessageTime={formatMessageTime} 
        />
      ))}
    </div>
  );
});

// Asignar un nombre para debugging
MessageGroup.displayName = 'MessageGroup';

export function MinimalChatView({
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
  const [isPending, startTransition] = useTransition()
  const wasNearBottomRef = useRef(true)
  const [formattedMessages, setFormattedMessages] = useState<any[]>([])
  
  // Usar valores diferidos para evitar bloqueos durante actualizaciones
  const deferredMessages = useDeferredValue(messages)

  // Función para agrupar mensajes por fecha - MOVIDA AQUÍ ARRIBA
  const groupMessagesByDate = (messages: UIMessage[]) => {
    // Usamos un objeto para agrupar mensajes por fecha
    const groups: Record<string, UIMessage[]> = {};
    
    messages.forEach(message => {
      if (!message) return;
      
      try {
        // Obtener la fecha del mensaje sin la hora
        const messageDate = new Date(message.timestamp);
        const dateStr = messageDate.toLocaleDateString();
        
        // Si no existe el grupo para esta fecha, crearlo
        if (!groups[dateStr]) {
          groups[dateStr] = [];
        }
        
        // Añadir el mensaje al grupo correspondiente
        groups[dateStr].push(message);
      } catch (error) {
        console.error('Error al procesar fecha del mensaje:', error);
      }
    });
    
    return groups;
  };

  // Filtrar mensajes que pertenecen a esta conversación únicamente
  const filteredMessages = useMemo(() => {
    if (!conversation || !Array.isArray(messages)) {
      console.log("No hay conversación seleccionada o mensajes válidos");
      return [];
    }
    
    // Filtrar solo mensajes que pertenecen a esta conversación (filtro estricto)
    const filtered = messages.filter(msg => 
      msg && msg.conversationId === conversation.id
    );
    
    console.log(`Filtrando mensajes para conversación ${conversation.id}:`);
    console.log(`- Total mensajes disponibles: ${messages.length}`);
    console.log(`- Mensajes en esta conversación: ${filtered.length}`);
    
    return filtered;
  }, [messages, conversation]);

  // Agrupar mensajes por fecha - memoizado
  const messagesByDate = useMemo(() => {
    return groupMessagesByDate(filteredMessages);
  }, [filteredMessages]);

  // Scroll to bottom when messages change - usando transiciones suaves
  useEffect(() => {
    if (messagesEndRef.current) {
      // Usar un flag para determinar si es carga inicial o nuevos mensajes
      const isInitialLoad = filteredMessages.length > 0 && deferredMessages.length === messages.length;
      
      if (isInitialLoad) {
        // Para carga inicial, scroll instantáneo sin animación
        messagesEndRef.current.scrollIntoView({ behavior: "auto" });
      } else {
        // Para nuevos mensajes, usar transición suave
      startTransition(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    }
    }
  }, [deferredMessages, messages.length, filteredMessages.length]);

  // Format timestamp - memoizado para mejor rendimiento
  const formatMessageTime = useCallback((timestamp: string) => {
    try {
      return format(new Date(timestamp), "h:mm a", { locale: es })
    } catch (e) {
      return "now"
    }
  }, []);

  // Format date for message groups - memoizado
  const formatMessageDate = useCallback((timestamp: string) => {
    try {
      const today = new Date()
      const messageDate = new Date(timestamp)

      if (
        messageDate.getDate() === today.getDate() &&
        messageDate.getMonth() === today.getMonth() &&
        messageDate.getFullYear() === today.getFullYear()
      ) {
        return "Today"
      }

      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      if (
        messageDate.getDate() === yesterday.getDate() &&
        messageDate.getMonth() === yesterday.getMonth() &&
        messageDate.getFullYear() === yesterday.getFullYear()
      ) {
        return "Yesterday"
      }

      return format(messageDate, "MMMM d, yyyy", { locale: es })
    } catch (e) {
      return "Recent"
    }
  }, []);

  // Función para desplazarse al último mensaje
  const scrollToBottom = (smooth = false) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end',
      })
    }
  }
  
  // Manejar envío de mensajes
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    // Limpiar el input primero para una mejor experiencia de usuario
    const messageText = input
    setInput('')

    try {
      onSendMessage(messageText)
      // No hacemos scroll inmediatamente, se maneja automáticamente con useEffect
    } catch (error) {
      console.error('Error al enviar mensaje:', error)
    }
  }

  // Handle textarea key press (Enter to send) - memoizado
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }, [handleSubmit]);

  // Handle image selection - memoizado
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // In a real environment, we would upload the image to a server
      // For this example, we use a placeholder
      setImagePreview("/placeholder.svg?height=300&width=400")

      // Clear the input to allow selecting the same file again
      e.target.value = ""
    }
  }, []);

  // Handle file selection - memoizado
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // In a real environment, we would upload the file to a server
      setFileToSend({
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      })

      // Clear the input to allow selecting the same file again
      e.target.value = ""
    }
  }, []);

  // Cancel sending image or file - memoizado
  const cancelAttachment = useCallback(() => {
    setImagePreview(null)
    setFileToSend(null)
  }, []);

  // Click handlers memoizados
  const handleImageButtonClick = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handleFileButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  // Scroll instantáneo al montar el componente
  useEffect(() => {
    // Este efecto solo se ejecuta una vez al montar el componente
    if (messagesEndRef.current) {
      // Usamos setTimeout para asegurar que se ejecute después del renderizado
      setTimeout(() => {
        // Posicionar el scroll al final sin animación
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        
        // Posicionar el contenedor de mensajes al final
        const messagesContainer = document.getElementById('messages-container');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 0);
    }
  }, []);

  // Verificar si se debe desplazar automáticamente
  const isNearBottom = (container: HTMLElement) => {
    const tolerance = 150 // Píxeles de tolerancia
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight <=
      tolerance
    )
  }
  
  // Agrupar mensajes por fecha cuando cambian los mensajes
  useEffect(() => {
    if (!Array.isArray(filteredMessages)) {
      console.log("Mensajes a formatear: 0");
      setFormattedMessages([]);
      return;
    }
    
    console.log(`Mensajes a formatear: ${filteredMessages.length}`);
    
    // Actualizar los mensajes mostrados
    startTransition(() => {
      const groupedByDate = groupMessagesByDate(filteredMessages);
      console.log(`Mensajes agrupados por fecha: ${Object.keys(groupedByDate).length}`);
      
      // Convertir el objeto groupedByDate a un arreglo de objetos [{date, messages}]
      const formattedArray = Object.keys(groupedByDate).map(date => ({
        date: formatMessageDate(date),
        messages: groupedByDate[date]
      }));
      
      // Ordenar por fecha
      formattedArray.sort((a, b) => {
        const dateA = new Date(a.messages[0]?.timestamp || '').getTime();
        const dateB = new Date(b.messages[0]?.timestamp || '').getTime();
        return dateA - dateB;
      });
      
      setFormattedMessages(formattedArray);
    });
  }, [filteredMessages, formatMessageDate]);
  
  // Formatear la fecha para mostrarla
  const formatDateForDisplay = (dateString: string) => {
    const messageDate = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (messageDate.toDateString() === today.toDateString()) {
      return 'Hoy'
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Ayer'
    } else {
      return messageDate.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    }
  }
  
  // Generar clases para los mensajes
  const getMessageClasses = (message: any) => {
    const alignmentClass = message.sender === 'me' ? 'justify-end' : 'justify-start'
    const bubbleClass = message.sender === 'me' 
      ? 'bg-primary text-primary-foreground' 
      : 'bg-muted text-muted-foreground'
      
    const statusClass = message.error 
      ? 'error' 
      : (message.status === 'sending' ? 'sending' : '')
      
    return { alignmentClass, bubbleClass, statusClass }
  }
  
  // Renderizar un mensaje individual
  const renderMessage = (message: any) => {
    const { alignmentClass, bubbleClass, statusClass } = getMessageClasses(message)
    
    return (
      <div 
        key={message.id} 
        className={`flex items-end mb-2 ${alignmentClass}`}
      >
        <div className="flex flex-col">
          <div
            className={`px-4 py-2 rounded-lg max-w-[80%] relative ${bubbleClass} ${statusClass}`}
          >
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
            {message.error && (
              <div className="text-xs text-red-500 mt-1">
                Error al enviar. Toca para reintentar.
              </div>
            )}
          </div>
          <div
            className={`text-xs mt-1 text-gray-500 ${
              message.sender === 'me' ? 'text-right' : 'text-left'
            }`}
          >
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">Select a conversation</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h2 className="text-lg font-semibold">{conversation.name || 'Chat'}</h2>
            <p className="text-sm text-gray-500">
              {conversation.lastMessage ? new Date(conversation.timestamp).toLocaleString() : 'No messages'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {business && (
            <Switch
              checked={conversation.botActive}
              onCheckedChange={(checked) => onToggleBot(checked)}
            />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 hover:bg-gray-100 rounded-full">
                <MoreVertical className="h-6 w-6" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem 
                onClick={() => {
                  if (onDeleteConversation && conversation) {
                    onDeleteConversation(conversation);
                  }
                }}
              >
                Delete Conversation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages area */}
      <div 
        id="messages-container"
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'flex-end',
          minHeight: '100%'
        }}
      >
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Cargando mensajes...</span>
          </div>
        ) : formattedMessages.length === 0 ? (
          <div className="flex justify-center items-center h-full text-gray-500">
            {Array.isArray(messages) && messages.length > 0 
              ? "Procesando mensajes..." 
              : "No hay mensajes aún"}
          </div>
        ) : (
          formattedMessages.map(({ date, messages }) => (
            <MessageGroup 
              key={date} 
              date={date} 
              messages={messages} 
              formatMessageTime={formatMessageTime} 
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area - Now thinner with centered icons */}
      <div className="p-4 border-t">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button type="submit" disabled={!input.trim()}>
            Send
          </Button>
        </form>
      </div>
    </div>
  )
}

