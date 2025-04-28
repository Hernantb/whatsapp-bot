"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import MinimalConversationsList from "@/components/minimal-conversations-list"
import MinimalChatView from "@/components/minimal-chat-view"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"
import { Home, Moon, Sun, LogOut, BarChart2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  fetchConversations, 
  sendMessage, 
  toggleBot 
} from "@/lib/api-client"
import { getMessagesForConversation } from "@/services/messages"
import { supabase, subscribeToConversationMessages } from "@/lib/supabase"
import { useToast } from "@/components/ui/use-toast"
import type { Conversation, Message } from "@/lib/database"
import ModeToggle from "@/components/mode-toggle"
import { transformMessages, handleNewMessage, transformMessage } from "@/services/messages"
import { UIMessage, UIConversation } from "@/types"

interface MinimalChatInterfaceProps {
  businessId?: string;
}

export default function MinimalChatInterface({ businessId }: MinimalChatInterfaceProps) {
  const [mounted, setMounted] = useState(false)
  const [selectedChat, setSelectedChat] = useState<string | { id: string } | null>(null)
  const [conversations, setConversations] = useState<any[]>([])
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const { toast } = useToast()
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Referencia para la función de carga expuesta - movida al nivel del componente
  const loadConversationsRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // Estado para controlar el diálogo de confirmación
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Constante para habilitar/deshabilitar logs de depuración
  const DEBUG = false;

  // Referencias para controlar el ciclo de vida de las solicitudes
  const lastProcessedIdRef = useRef<string | null>(null);
  const fetchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Estado para almacenar mensajes por ID de conversación
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, any[]>>({});

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  // Cargar conversaciones al inicio
  useEffect(() => {
    const loadConversations = async () => {
      setIsLoading(true)
      try {
        // Usar directamente el ID conocido que funciona
        const hardcodedId = "2d385aa5-40e0-4ec9-9360-19281bc605e4"
        console.log('🔄 Usando ID hardcodeado para cargar conversaciones:', hardcodedId)
        
        const userConversations = await fetchConversations(hardcodedId)
        
        if (userConversations && userConversations.length > 0) {
          console.log(`✅ Se encontraron ${userConversations.length} conversaciones`)
          
          // Ordenar explícitamente las conversaciones por fecha de último mensaje (más reciente primero)
          const sortedConversations = userConversations.sort((a, b) => {
            const dateA = new Date(a.last_message_time || a.created_at).getTime();
            const dateB = new Date(b.last_message_time || b.created_at).getTime();
            return dateB - dateA;
          });
          
          // Crear un mapa de las conversaciones actuales por ID para referencia rápida
          setConversations(prevConversations => {
            // Si no hay conversaciones previas, simplemente devolver las nuevas
            if (prevConversations.length === 0) {
              return sortedConversations.map((conv: any) => ({
                id: conv.id,
                name: conv.sender_name || conv.user_id || 'Sin nombre',
                phone: conv.user_id || '',
                lastMessage: conv.last_message || "Nueva conversación",
                timestamp: conv.last_message_time || conv.created_at,
                unread: conv.unread_count || 0,
                tag: conv.tag || "gray",
                colorLabel: conv.tag || "gray",
                botActive: conv.is_bot_active !== undefined ? conv.is_bot_active : true,
                userCategory: conv.user_category || "default"
              }));
            }
            
            // Convertir el arreglo previo a un mapa para búsqueda rápida por ID
            const prevConvsMap = new Map(
              prevConversations.map(conv => [conv.id, conv])
            );
            
            // Mantener track de cuáles IDs hemos procesado
            const processedIds = new Set();
            
            // Crear un nuevo mapa para las conversaciones actualizadas con sus posiciones
            const updatedConvsWithPos = sortedConversations.map((conv: any, index) => {
              const existingConv = prevConvsMap.get(conv.id);
              processedIds.add(conv.id);
              
              // Si la conversación existe y no ha cambiado, reutilizar el objeto
              if (existingConv && 
                  existingConv.lastMessage === (conv.last_message || "Nueva conversación") &&
                  existingConv.timestamp === (conv.last_message_time || conv.created_at)) {
                return {
                  conv: existingConv,
                  position: index
                };
              }
              
              // Si es nueva o ha cambiado, crear un nuevo objeto
              return {
                conv: {
                  id: conv.id,
                  name: conv.sender_name || conv.user_id || 'Sin nombre',
                  phone: conv.user_id || '',
                  lastMessage: conv.last_message || "Nueva conversación",
                  timestamp: conv.last_message_time || conv.created_at,
                  unread: conv.unread_count || 0,
                  tag: conv.tag || "gray",
                  colorLabel: conv.tag || "gray",
                  botActive: conv.is_bot_active !== undefined ? conv.is_bot_active : true,
                  userCategory: conv.user_category || "default"
                },
                position: index
              };
            });
            
            // Ordenar el resultado final según las posiciones y extraer solo las conversaciones
            return updatedConvsWithPos
              .sort((a, b) => a.position - b.position)
              .map(item => item.conv);
          });
          
          setServerError(null)
        } else {
          console.log('❌ No se encontraron conversaciones')
        }
      } catch (error) {
        console.error('Error al cargar conversaciones:', error)
        setServerError("Error al conectar con el servidor. Verifica que esté ejecutándose.")
      } finally {
        setIsLoading(false)
      }
      
      // Retornar una promesa resuelta para poder encadenar con .then()
      return Promise.resolve();
    }

    // Crear una versión expuesta que devuelve una promesa
    const exposedLoadConversations = () => {
      // Siempre devuelve una promesa
      return loadConversations().catch(error => {
        console.error('Error en la carga expuesta de conversaciones:', error);
        // Re-lanzar para que pueda ser manejado
        return Promise.reject(error);
      });
    };

    // Actualizar la referencia en lugar de crear una nueva
    loadConversationsRef.current = exposedLoadConversations;
    
    // Asignar la función a una propiedad del componente para acceso externo
    if (typeof window !== 'undefined') {
      (window as any).refreshConversations = exposedLoadConversations;
    }

    // Cargar conversaciones inicialmente solo una vez al montar
    if (mounted) {
      loadConversations()
    }
    
  }, [mounted])

  // Función más inteligente para desplazarse al último mensaje
  const scrollToBottom = useCallback((smooth = false) => {
    setTimeout(() => {
      const messagesContainer = document.getElementById('messages-container');
      if (messagesContainer) {
        // Usar scroll behavior para controlar la suavidad
        messagesContainer.scrollTo({
          top: messagesContainer.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto'
        });
      }
    }, 100);
  }, []);

  // Efecto para cargar mensajes al seleccionar una conversación
  useEffect(() => {
    if (!selectedChat) return;
    
    const chatId = typeof selectedChat === 'string' ? selectedChat : selectedChat.id;
    console.log(`🔄 Cargando mensajes para conversación: ${chatId}`);
    
    // Limpiar mensajes anteriores para evitar problemas de orden
    setMessages([]);
    setIsLoadingMessages(true);
    
    const loadMessages = async () => {
      try {
        const messages = await getMessagesForConversation(chatId);
        console.log(`✅ Obtenidos ${messages.length} mensajes para conversación ${chatId}`);
        
        // Transformar y ordenar los mensajes antes de establecerlos
        const uiMessages = transformMessages(messages).sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          return timeA - timeB;
        });
        
        // Establecer los mensajes ordenados
        setMessages(uiMessages as UIMessage[]);
      } catch (error) {
        console.error('Error cargando mensajes:', error);
        toast({
          title: "Error al cargar mensajes",
          description: "No se pudieron cargar los mensajes para esta conversación.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingMessages(false);
      }
    };
    
    loadMessages();
    
    // Suscribirse a cambios en tiempo real para esta conversación
    const subscription = subscribeToConversationMessages(chatId, (payload) => {
      if (!payload || !payload.new) {
        console.log("Evento de tiempo real recibido sin datos nuevos");
        return;
      }
      
      console.log("📩 Nuevo mensaje recibido en tiempo real:", payload.new.content?.substring(0, 20));
      
      const newMessage = payload.new;
      
      // Transformar el mensaje para la UI sin filtrar por remitente
      const transformedMessage = transformMessage(newMessage);
      if (!transformedMessage) {
        console.log("No se pudo transformar el mensaje");
        return;
      }

      console.log(`Mensaje recibido en tiempo real: "${transformedMessage.content.substring(0, 30)}..." - ID: ${transformedMessage.id} - Remitente: ${transformedMessage.sender}`);
      
      // Actualizar la lista de mensajes de forma inmediata
      setMessages(prevMessages => {
        // Verificar si el mensaje ya existe por ID
        if (prevMessages.some(msg => msg.id === transformedMessage.id)) {
          console.log(`Mensaje con ID ${transformedMessage.id} ya existe, no añadiendo`);
          return prevMessages;
        }
        
        // Verificar duplicados por contenido y timestamp cercano (dentro de 2 segundos)
        const isDuplicate = prevMessages.some(msg => 
          msg.content === transformedMessage.content && 
          Math.abs(new Date(msg.timestamp).getTime() - new Date(transformedMessage.timestamp).getTime()) < 2000
        );
        
        if (isDuplicate) {
          console.log(`Mensaje duplicado detectado por contenido/timestamp: ${transformedMessage.content.substring(0, 20)}...`);
          return prevMessages;
        }
        
        console.log(`Añadiendo nuevo mensaje: ${transformedMessage.id} de remitente ${transformedMessage.sender}`);
        
        // Añadir el mensaje y ordenar por timestamp
        const updatedMessages = [...prevMessages, transformedMessage].sort((a, b) => {
          return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        });
        
        console.log(`Lista actualizada: ${updatedMessages.length} mensajes total`);
        
        // Scroll al final después de la actualización
        setTimeout(() => {
          scrollToBottom(true);
        }, 100);
        
        return updatedMessages as UIMessage[];
      });
      
      // Actualizar la información de la conversación
      setConversations(prevConvs => {
        // Si la conversación no existe en la lista, no hacemos nada
        if (!prevConvs.some(conv => conv.id === chatId)) {
          console.log(`Conversación ${chatId} no encontrada en la lista`);
          return prevConvs;
        }
        
        console.log(`Actualizando información de conversación ${chatId}`);
        
        return prevConvs.map(conv => 
          conv.id === chatId 
            ? { 
                ...conv, 
                lastMessage: transformedMessage.content.substring(0, 30), 
                timestamp: transformedMessage.timestamp,
                unread: conv.id !== chatId // Marcar como no leído solo si no es la conversación actual
              } 
            : conv
        );
      });
    });
    
    return () => {
      // Limpiar suscripción al desmontar
      subscription?.unsubscribe?.();
    };
  }, [selectedChat, toast]);

  // Handler para eliminar conversación
  const handleDeleteConversation = useCallback(() => {
    if (!selectedChat) return
    setDeleteDialogOpen(true)
  }, [selectedChat])

  // Confirmar eliminación de conversación
  const confirmDeleteConversation = useCallback(() => {
    if (!selectedChat) return
    setConversations((prev) => prev.filter((conv) => conv.id !== selectedChat))
    setMessages([])
    setSelectedChat(null)
    setDeleteDialogOpen(false)
  }, [selectedChat])

  // Función para manejar el envío de mensajes
  const handleSendMessage = async (content: string, conversationId: string) => {
    if (!content.trim() || !conversationId) return;
    
    setIsSending(true);
    
    try {
      // Generar un ID temporal para optimismo UI
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Usar Date.now() para el timestamp y asegurar formato ISO 8601 correcto
      const timestamp = new Date().toISOString();
      console.log(`Timestamp generado para nuevo mensaje: ${timestamp}`);
      
      // Mensaje optimista para mostrar inmediatamente
      const optimisticMessage: UIMessage = {
        id: tempId,
        conversationId,
        content,
        timestamp,
        sender: 'me',  // Este mensaje siempre es del agente (nosotros)
        status: 'sent',
        type: 'text',
        sender_type: 'agent',  // Marcar explícitamente como enviado por agente
        created_at: timestamp,
        read: false
      };
      
      // Añadir explícitamente el atributo user_id para la detección en transformMessage
      (optimisticMessage as any).user_id = 'agent';
      
      console.log("Enviando mensaje como agente:", optimisticMessage);
      
      // Importar dinámicamente storeMessages para evitar referencias circulares
      const { storeMessages } = await import('../services/messages');
      
      // Actualizar el estado con el mensaje optimista
      setMessages(prevMessages => {
        // Verificar si prevMessages es un array válido
        if (!Array.isArray(prevMessages)) {
          console.warn('prevMessages no es un array válido:', prevMessages);
          return [optimisticMessage];
        }
        
        // Asegurarnos de no duplicar mensajes
        if (prevMessages.some(msg => 
          msg.content === content && 
          Math.abs(new Date(msg.timestamp).getTime() - Date.now()) < 5000
        )) {
          console.log('Mensaje duplicado detectado, no añadiendo:', content);
          return prevMessages;
        }
        
        const updatedMessages = [...prevMessages, optimisticMessage];
        
        // Usar la función centralizada para guardar en todos los sistemas
        storeMessages(conversationId, updatedMessages);
        
        // Scroll al final después de la actualización
        setTimeout(() => {
          scrollToBottom(true);
        }, 100);
        
        return updatedMessages;
      });
      
      // Variables para manejar reintentos
      let attempts = 0;
      const maxAttempts = 3;
      let savedMessage = null;
      
      while (attempts < maxAttempts && !savedMessage) {
        attempts++;
        
        try {
          // Enviar el mensaje al servidor
          const response = await sendMessage(conversationId, content, undefined, 'bot');
          
          if (!response || !response.id) {
            console.warn(`Intento ${attempts}/${maxAttempts}: No se recibió una respuesta válida del servidor`);
            
            // Si no es el último intento, esperar antes de reintentar
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempts)); // Espera incremental
              continue;
            } else {
              throw new Error('No se recibió una respuesta válida del servidor después de varios intentos');
            }
          }
          
          // Mensaje guardado exitosamente
          savedMessage = response;
          console.log(`✅ Mensaje enviado correctamente a Supabase en el intento ${attempts}:`, response.id);
          
          // Actualizar el mensaje optimista con el ID real y estado (manteniendo el estilo normal)
          setMessages(prev => {
            const updatedMessages = prev.map(msg => 
              msg.id === tempId 
                ? { ...msg, id: response.id, status: 'sent' as 'sent' | 'delivered' | 'read' | 'pending' }
                : msg
            );
            
            // Usar la función centralizada para guardar mensajes
            storeMessages(conversationId, updatedMessages);
            console.log(`💾 Mensajes actualizados en localStorage después de envío exitoso`);
            
            return updatedMessages;
          });
          
          // Actualizar la última conversación sin recargar todas
          setConversations(prevConvs => 
            prevConvs.map(conv => 
              conv.id === conversationId 
                ? { ...conv, lastMessage: content, timestamp }
                : conv
            )
          );
          
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
          }
          
          break; // Salir del bucle si el mensaje se guardó correctamente
        } catch (error) {
          console.error(`Error al enviar mensaje (intento ${attempts}/${maxAttempts}):`, error);
          
          // Si es el último intento, mostrar error al usuario
          if (attempts >= maxAttempts) {
            // Marcar el mensaje como fallido pero manteniendo estilo normal
            setMessages(prev => {
              const updatedMessages = prev.map(msg => 
                msg.id === tempId 
                  ? { ...msg, status: 'sent' as 'sent' | 'delivered' | 'read' | 'pending', error: true }
                  : msg
              );
              
              // Usar la función centralizada para guardar mensajes
              storeMessages(conversationId, updatedMessages);
              
              return updatedMessages;
            });
            
            toast({
              title: "Error al enviar mensaje",
              description: "No se pudo guardar el mensaje en el servidor después de varios intentos.",
              variant: "destructive",
            });
          } else {
            console.log(`Reintentando envío (${attempts+1}/${maxAttempts})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts)); // Espera incremental
          }
        }
      }
    } catch (error) {
      console.error("Error general al enviar mensaje:", error);
      toast({
        title: "Error inesperado",
        description: "Ocurrió un error al enviar el mensaje.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  // Actualizar etiqueta de color
  const handleUpdateColorLabel = useCallback((id: string, colorLabel: string) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === id ? { ...conv, colorLabel } : conv
      )
    )
  }, [])

  // Actualizar categoría de usuario
  const handleUpdateUserCategory = useCallback((id: string, category: "default" | "important" | "urgent" | "completed") => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === id ? { ...conv, userCategory: category } : conv
      )
    )
  }, [])

  // Actualizar etiqueta
  const handleUpdateTag = useCallback((id: string, tag: string) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === id ? { ...conv, tag } : conv
      )
    )
  }, [])

  // Activar/desactivar bot
  const handleToggleBot = useCallback(async (id: string | { id: string }, active: boolean) => {
    const chatId = typeof id === 'string' ? id : id.id;
    
    try {
      console.log(`🤖 ${active ? 'Activando' : 'Desactivando'} bot para conversación: ${chatId}`);
      
      // Primero comunicar el cambio al servidor
      await toggleBot(chatId, active);
      
      console.log(`✅ Estado del bot actualizado en el servidor a: ${active ? 'ACTIVO' : 'INACTIVO'}`);
      
      // Luego actualizar el estado local para reflejar el cambio en la UI
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === chatId ? { ...conv, botActive: active } : conv
        )
      );
    } catch (error) {
      console.error(`❌ Error al ${active ? 'activar' : 'desactivar'} bot:`, error);
      
      // Notificar al usuario
      toast({
        title: `Error al ${active ? 'activar' : 'desactivar'} bot`,
        description: "No se pudo actualizar el estado del bot. Intenta nuevamente.",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Cambiar tema
  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark")
  }, [theme, setTheme])

  // Cambiar a la vista de analytics
  const toggleAnalytics = useCallback(() => {
    setShowAnalytics(!showAnalytics)
    if (!showAnalytics) {
      router.push("/dashboard/analytics")
    } else {
      router.push("/dashboard")
    }
  }, [showAnalytics, router])

  // Cerrar sesión
  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
      router.push('/login')
    }
  }, [router])

  // Filtrar conversaciones
  const filteredConversations = conversations.filter((conv) => {
      const matchesSearch =
      (conv.name?.toLowerCase()?.includes(searchQuery.toLowerCase()) ?? false) ||
      (conv.phone?.includes(searchQuery) ?? false) ||
      (conv.lastMessage?.toLowerCase()?.includes(searchQuery.toLowerCase()) ?? false)

    if (activeTab === "unread") return matchesSearch && (conv.unread > 0)
      return matchesSearch
    })

  // Si no está montado, no renderizar nada
  if (!mounted) return null

  // Componente para estados vacíos
  function EmptyState({ error, isLoading }: { error?: string, isLoading: boolean }) {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
          <div className="animate-spin w-8 h-8 border-t-2 border-blue-500 border-solid rounded-full mb-4"></div>
          <p className="text-gray-600">Cargando conversaciones...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
          <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">
            <h3 className="font-bold mb-2">Error al cargar conversaciones</h3>
            <p className="mb-4">{error}</p>
            <button 
              onClick={() => {
                // Usar directamente el ID conocido que funciona
                const hardcodedId = "2d385aa5-40e0-4ec9-9360-19281bc605e4";
                setIsLoading(true);
                fetchConversations(hardcodedId)
                  .then(conversations => {
                    if (conversations && conversations.length > 0) {
                      const sortedConversations = conversations.sort((a, b) => {
                        const dateA = new Date(a.last_message_time || a.created_at).getTime();
                        const dateB = new Date(b.last_message_time || b.created_at).getTime();
                        return dateB - dateA;
                      });
                      
                      setConversations(sortedConversations.map((conv: any) => ({
                        id: conv.id,
                        name: conv.sender_name || conv.user_id || 'Sin nombre',
                        phone: conv.user_id || '',
                        lastMessage: conv.last_message || "Nueva conversación",
                        timestamp: conv.last_message_time || conv.created_at,
                        unread: conv.unread_count || 0,
                        tag: conv.tag || "gray",
                        colorLabel: conv.tag || "gray",
                        botActive: conv.is_bot_active !== undefined ? conv.is_bot_active : true,
                        userCategory: conv.user_category || "default"
                      })));
                      setServerError(null);
                    }
                  })
                  .catch(error => {
                    console.error('Error al recargar conversaciones:', error);
                    setServerError("Error al conectar con el servidor. Verifica que esté ejecutándose.");
                  })
                  .finally(() => {
                    setIsLoading(false);
                  });
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Intentar nuevamente
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-16 h-16 bg-gray-200 rounded-full mb-4 flex items-center justify-center">
          <span className="text-gray-500 text-2xl">📨</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">No hay conversaciones</h3>
        <p className="text-gray-500 mb-4">No se encontraron conversaciones para este negocio.</p>
        <button
          onClick={() => {
            // Usar directamente el ID conocido que funciona
            const hardcodedId = "2d385aa5-40e0-4ec9-9360-19281bc605e4";
            setIsLoading(true);
            fetchConversations(hardcodedId)
              .then(conversations => {
                if (conversations && conversations.length > 0) {
                  const sortedConversations = conversations.sort((a, b) => {
                    const dateA = new Date(a.last_message_time || a.created_at).getTime();
                    const dateB = new Date(b.last_message_time || b.created_at).getTime();
                    return dateB - dateA;
                  });
                  
                  setConversations(sortedConversations.map((conv: any) => ({
                    id: conv.id,
                    name: conv.sender_name || conv.user_id || 'Sin nombre',
                    phone: conv.user_id || '',
                    lastMessage: conv.last_message || "Nueva conversación",
                    timestamp: conv.last_message_time || conv.created_at,
                    unread: conv.unread_count || 0,
                    tag: conv.tag || "gray",
                    colorLabel: conv.tag || "gray",
                    botActive: conv.is_bot_active !== undefined ? conv.is_bot_active : true,
                    userCategory: conv.user_category || "default"
                  })));
                  setServerError(null);
                }
              })
              .catch(error => {
                console.error('Error al recargar conversaciones:', error);
                setServerError("Error al conectar con el servidor. Verifica que esté ejecutándose.");
              })
              .finally(() => {
                setIsLoading(false);
              });
          }}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Actualizar
        </button>
      </div>
    );
  }

  // Renderizar la interfaz principal
  return (
    <div className="flex h-full bg-gray-100 dark:bg-gray-950 p-2">
      <div className="flex w-full max-w-[98%] mx-auto rounded-2xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800">
        {/* Barra de navegación principal */}
        <div className="w-16 bg-[#332c40] dark:bg-[#26212f] flex flex-col items-center py-6 text-white rounded-xl">
          <div className="flex-1 flex flex-col items-center mt-8 space-y-10">
            <Button
              variant="ghost"
              className={cn(
                "w-12 h-12 p-0 hover:bg-[#26212f] dark:hover:bg-[#15121b] rounded-xl",
                !showAnalytics && !selectedChat && "bg-[#26212f] dark:bg-[#15121b]",
              )}
              onClick={() => {
                setShowAnalytics(false)
                setSelectedChat(null)
              }}
            >
              <Home className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              className={cn(
                "w-12 h-12 p-0 hover:bg-[#26212f] dark:hover:bg-[#15121b] rounded-xl",
                showAnalytics && "bg-[#26212f] dark:bg-[#15121b]",
              )}
              onClick={toggleAnalytics}
            >
              <BarChart2 className="h-6 w-6" />
            </Button>
          </div>
          <div className="flex flex-col items-center space-y-10 mb-10 mt-10">
            <Button
              variant="ghost"
              className="w-12 h-12 p-0 hover:bg-[#26212f] dark:hover:bg-[#15121b] rounded-xl"
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
            </Button>
            <Button
              variant="ghost"
              className="w-12 h-12 p-0 hover:bg-[#26212f] dark:hover:bg-[#15121b] rounded-xl"
              onClick={handleLogout}
            >
              <LogOut className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Área principal */}
        <div className="flex flex-1 overflow-hidden bg-gray-100 dark:bg-gray-900 rounded-r-lg">
          {/* Lista de conversaciones */}
          <div className={cn("w-96 border-r dark:border-gray-700", selectedChat && isMobile ? "hidden" : "block")}>
            {isLoading && !conversations.length ? (
              <EmptyState isLoading={true} />
            ) : serverError ? (
              <EmptyState error={serverError} isLoading={false} />
            ) : (
            <MinimalConversationsList
              conversations={filteredConversations}
              selectedChatId={selectedChat}
              onSelectChat={setSelectedChat}
              onSearch={setSearchQuery}
              searchQuery={searchQuery}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onUpdateColorLabel={handleUpdateColorLabel}
              onUpdateUserCategory={handleUpdateUserCategory}
              onUpdateTag={handleUpdateTag}
            />
            )}
          </div>

          {/* Vista del chat */}
          <div
            className={cn(
              "min-h-full flex-1 flex flex-col transition-all bg-gray-50 dark:bg-gray-900 sm:rounded-r-lg overflow-hidden",
              isMobile && !selectedChat && "hidden"
            )}
          >
            {selectedChat ? (
              selectedChat && <MinimalChatView
                conversation={conversations.find((c) => c.id === (typeof selectedChat === "string" ? selectedChat : selectedChat?.id)) || {
                  id: typeof selectedChat === "string" ? selectedChat : selectedChat?.id || "unknown",
                  name: 'Chat',
                  lastMessage: '',
                  timestamp: new Date().toISOString(),
                  botActive: true,
                  phone: '',
                  user_id: '',
                  status: 'online',
                  isBusinessAccount: false,
                  labels: [],
                  colorLabel: 'gray',
                  unread: false
                }}
                messages={messages}
                isLoading={isLoadingMessages}
                onSendMessage={(message) => handleSendMessage(message, typeof selectedChat === 'string' ? selectedChat : selectedChat?.id || '')}
                onBack={() => setSelectedChat(null)}
                onToggleBot={() => handleToggleBot(selectedChat, !conversations.find((c) => c.id === (typeof selectedChat === "string" ? selectedChat : selectedChat?.id))?.botActive)}
                onDeleteConversation={handleDeleteConversation}
                onUpdateConversation={(conversation) => {
                  // Actualizamos la conversación en la lista
                  const updatedConversations = conversations.map(c => 
                    c.id === conversation.id ? conversation : c
                  );
                  setConversations(updatedConversations);
                }}
                business={true}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-r-2xl">
                <div className="text-center">
                  <div className="mb-6 flex items-center justify-center">
                    <div className="rounded-full bg-white p-4 w-32 h-32 flex items-center justify-center">
                      <img
                        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/BEXO%20%281%29-ioN7LHMsHngPVmhgPVNy7Pns2XPtZH.png"
                        alt="BEXOR Logo"
                        className="h-20 w-auto object-contain"
                      />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Powered by BEXOR</h3>
                  <p className="text-gray-600 dark:text-gray-300 mt-2">
                    Selecciona un chat para comenzar a enviar mensajes
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Diálogo de confirmación para eliminar conversación */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar conversación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar esta conversación? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row justify-end gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDeleteConversation}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

