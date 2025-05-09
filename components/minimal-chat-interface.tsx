"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import MinimalConversationsList from "@/components/minimal-conversations-list"
import MinimalChatView from "@/components/minimal-chat-view"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"
import { Home, Moon, Sun, LogOut, BarChart2, Search, Menu, Check, Send, X, MessageCircle, Settings } from "lucide-react"
import { Loader2 } from "lucide-react"
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
  fetchMessages, 
  sendMessage, 
  toggleBot,
  sendDirectWhatsAppMessage
} from "@/lib/api-client"
import { getMessagesForConversation } from "@/services/messages"
import { deleteConversation } from "@/services/conversations"
import { supabase, subscribeToConversationMessages } from "@/lib/supabase"
import { useToast } from "@/components/ui/use-toast"
import type { Conversation, Message } from "@/lib/database"
import ModeToggle from "@/components/mode-toggle"
import { transformMessages, handleNewMessage, transformMessage, storeMessages } from "@/services/messages"
import { UIMessage, UIConversation } from "@/types"
import { invalidateMessagesCache } from '../services/messages'
import { cache } from '../lib/cache'

interface MinimalChatInterfaceProps {
  businessId?: string;
}

export default function MinimalChatInterface({ businessId }: MinimalChatInterfaceProps) {
  const [mounted, setMounted] = useState(false)
  const [selectedChat, setSelectedChat] = useState<string | { id: string } | null>(null)
  const [conversations, setConversations] = useState<any[]>([])
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [activeTab, setActiveTab] = useState("all")
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const { toast } = useToast()
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const conversationsRef = useRef<HTMLDivElement>(null)
  
  // Track de los mensajes enviados recientemente para evitar duplicados
  const [recentlySentMessages, setRecentlySentMessages] = useState<UIMessage[]>([])
  
  // Referencia para la función de carga expuesta - movida al nivel del componente
  const loadConversationsRef = useRef<() => void>(() => {})

  // Estado para controlar el diálogo de confirmación
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Constante para habilitar/deshabilitar logs de depuración
  const DEBUG = false;

  // Referencias para controlar el ciclo de vida de las solicitudes
  const lastProcessedIdRef = useRef<string | null>(null);
  const fetchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Estado para almacenar mensajes por ID de conversación
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, any[]>>({});

  // Estado para controlar la eliminación de conversación
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  // Cargar conversaciones al inicio
  useEffect(() => {
    const loadConversations = async () => {
      setIsLoadingConversations(true);
      try {
        // Obtener el usuario actual desde el contexto de Supabase
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session?.user) {
          console.error('Error al obtener la sesión:', sessionError);
          setServerError("No se pudo obtener la sesión de usuario. Por favor, inicie sesión nuevamente.");
          setIsLoadingConversations(false);
          return Promise.resolve();
        }
        
        // Usar el ID del usuario para obtener su business_id asociado
        const { data: businessUserData, error: businessUserError } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', session.user.id)
          .eq('is_active', true)
          .maybeSingle();
        
        if (businessUserError) {
          console.error('Error al obtener business_id:', businessUserError);
          setServerError("Error al obtener el negocio asociado a su cuenta.");
          setIsLoadingConversations(false);
          return Promise.resolve();
        }
        
        // Si no encontramos un business_id asociado, mostrar mensaje
        if (!businessUserData?.business_id) {
          console.warn('Usuario no tiene un negocio asociado');
          setServerError("Su cuenta no tiene un negocio asociado. Contacte al administrador.");
          setIsLoadingConversations(false);
          return Promise.resolve();
        }
        
        const businessId = businessUserData.business_id;
        console.log('🔄 Usando business_id real:', businessId);
        
        // Obtener conversaciones directamente de Supabase para este negocio
        const { data: conversationsData, error: conversationsError } = await supabase
          .from('conversations')
          .select('*')
          .eq('business_id', businessId)
          .order('last_message_time', { ascending: false });
        
        if (conversationsError) {
          console.error('Error al obtener conversaciones:', conversationsError);
          setServerError("Error al cargar las conversaciones. Intente nuevamente.");
          setIsLoadingConversations(false);
          return Promise.resolve();
        }
        
        // Procesar las conversaciones como antes
        if (conversationsData && conversationsData.length > 0) {
          console.log(`✅ Se encontraron ${conversationsData.length} conversaciones reales`);
          
          // Ordenar explícitamente las conversaciones por fecha de último mensaje (más reciente primero)
          const sortedConversations = conversationsData.sort((a: any, b: any) => {
            const dateA = new Date(a.last_message_time || a.created_at).getTime();
            const dateB = new Date(b.last_message_time || b.created_at).getTime();
            return dateB - dateA;
          });
          
          // Crear un mapa de las conversaciones actuales por ID para referencia rápida
          setConversations(prevConversations => {
            // Si no hay conversaciones previas, simplemente devolver las nuevas
            if (prevConversations.length === 0) {
              return sortedConversations.map((conv: any) => {
                // Verificar localStorage para ver si esta conversación fue manualmente movida a "Todos"
                let manuallyMovedToAll = conv.manuallyMovedToAll || false;
                let manuallyMovedToAllTimestamp = conv.manuallyMovedToAllTimestamp || null;
                
                // Verificar si hay información en localStorage para esta conversación
                if (typeof window !== 'undefined') {
                  const storedMoved = localStorage.getItem(`manually_moved_${conv.id}`);
                  const storedMovedTime = localStorage.getItem(`manually_moved_time_${conv.id}`);
                  
                  if (storedMoved === 'true') {
                    console.log(`🔍 Usando información de localStorage para conversación ${conv.id}: marcada como movida manualmente a "Todos"`);
                    manuallyMovedToAll = true;
                    manuallyMovedToAllTimestamp = storedMovedTime || new Date().toISOString();
                  }
                }
                
                // Determinar categoría de usuario basado en campos disponibles y estado de manuallyMovedToAll
                let userCategory = conv.user_category || "default";
                
                // Si tiene una frase clave pero fue movida manualmente a "Todos", debe quedar como "default"
                const keyPhrases = [
                  "¡Perfecto! tu cita ha sido confirmada para",
                  "¡Perfecto! un asesor te llamará",
                  "¡Perfecto! un asesor te contactará",
                  "¡Perfecto! una persona te contactará"
                ];
                
                const containsKeyPhrase = conv.last_message && keyPhrases.some(phrase => 
                  conv.last_message.toLowerCase().includes(phrase.toLowerCase())
                );
                
                // Si tiene una categoría "important" pero fue manualmente movida a todos,
                // respetamos la decisión manual
                if (userCategory === "important" && manuallyMovedToAll) {
                  console.log(`👀 Detectada conversación ${conv.id} que estaba marcada como importante pero fue manualmente movida a "Todos"`);
                  userCategory = "default";
                }
                
                return {
                  id: conv.id,
                  name: conv.sender_name || conv.user_id || 'Sin nombre',
                  phone: conv.user_id || '',
                  user_id: conv.user_id || '',
                  lastMessage: conv.last_message || "Nueva conversación",
                  timestamp: conv.last_message_time || conv.created_at,
                  unread: conv.unread_count || 0,
                  tag: manuallyMovedToAll ? "gray" : (conv.tag || "gray"),
                  colorLabel: manuallyMovedToAll ? "gray" : (conv.tag || "gray"),
                  botActive: conv.is_bot_active !== undefined ? conv.is_bot_active : true,
                  userCategory: userCategory,
                  manuallyMovedToAll: manuallyMovedToAll,
                  manuallyMovedToAllTimestamp: manuallyMovedToAllTimestamp
                };
              });
            }
            
            // Convertir el arreglo previo a un mapa para búsqueda rápida por ID
            const prevConvsMap = new Map(
              prevConversations.map(conv => [conv.id, conv])
            );
            
            // Mantener track de cuáles IDs hemos procesado
            const processedIds = new Set();
            
            // Crear un nuevo mapa para las conversaciones actualizadas con sus posiciones
            const updatedConvsWithPos = sortedConversations.map((conv: any, index: number) => {
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
                  user_id: conv.user_id || '',
                  lastMessage: conv.last_message || "Nueva conversación",
                  timestamp: conv.last_message_time || conv.created_at,
                  unread: conv.unread_count || 0,
                  tag: conv.tag || "gray",
                  colorLabel: conv.tag || "gray",
                  botActive: conv.is_bot_active !== undefined ? conv.is_bot_active : true,
                  userCategory: conv.user_category || "default",
                  manuallyMovedToAll: conv.manuallyMovedToAll || false, 
                  manuallyMovedToAllTimestamp: conv.manuallyMovedToAllTimestamp || null
                },
                position: index
              };
            });
            
            // Ordenar el resultado final según las posiciones y extraer solo las conversaciones
            return updatedConvsWithPos
              .sort((a: any, b: any) => a.position - b.position)
              .map((item: any) => item.conv);
          });
          
          setServerError(null);
        } else {
          console.log('❌ No se encontraron conversaciones para este negocio');
          setServerError("No hay conversaciones disponibles para su negocio.");
        }
      } catch (error) {
        console.error('Error al cargar conversaciones:', error);
        setServerError("Error al conectar con el servidor. Verifique que esté ejecutándose.");
      } finally {
        setIsLoadingConversations(false);
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

  // Función para forzar refresco completo de la UI (útil después de eliminaciones)
  const forceUIRefresh = useCallback(async () => {
    console.log('🔄 Iniciando refresco controlado de la UI');
    
    // Bandera para evitar múltiples actualizaciones
    let refreshStarted = false;
    
    try {
      if (refreshStarted) {
        console.log('⚠️ Ya hay un refresco en proceso, ignorando solicitud');
        return;
      }
      
      refreshStarted = true;
      
      // 1. Primero limpiar estado local para evitar inconsistencias
      setSelectedChat(null);
      setMessages([]);
      
      // 2. Intentar recargar conversaciones sin limpiar caché primero
      toast({
        title: "Actualizando",
        description: "Recargando conversaciones...",
        duration: 2000,
      });
      
      try {
        console.log('🔄 Intentando recarga sin limpiar caché');
        if (loadConversationsRef.current) {
          await loadConversationsRef.current();
          console.log('✅ Recarga completada exitosamente');
          refreshStarted = false;
          return;
        }
      } catch (initialError) {
        console.warn('⚠️ Error en recarga inicial:', initialError);
        // Continuar con enfoque más agresivo
      }
      
      // 3. Si falló el enfoque sutil, hacer una limpieza más agresiva
      console.log('🧹 Iniciando limpieza de caché y refresco completo');
      
      // Limpiar caché de conversaciones
      cache.invalidate('conversations', 'all');
      
      // Limpiar localStorage relacionado con conversaciones
      if (typeof window !== 'undefined') {
        try {
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('conv_') || key.startsWith('conversation_') || key.startsWith('messages_'))) {
              keysToRemove.push(key);
            }
          }
          
          // Eliminar claves en un segundo paso para evitar problemas con el índice
          keysToRemove.forEach(key => {
            try {
              localStorage.removeItem(key);
            } catch (e) {
              console.warn(`⚠️ No se pudo eliminar ${key} de localStorage:`, e);
            }
          });
        } catch (localStorageError) {
          console.warn('⚠️ Error al limpiar localStorage:', localStorageError);
        }
      }
      
      // Recargar conversaciones con caché limpia
      try {
        if (loadConversationsRef.current) {
          await loadConversationsRef.current();
          console.log('✅ Recarga completa exitosa después de limpieza de caché');
        }
      } catch (finalError) {
        console.error('❌ Error en recarga final:', finalError);
        toast({
          title: "Error de sincronización",
          description: "No se pudieron recargar las conversaciones. Intente refrescar la página.",
          variant: "destructive",
          duration: 4000,
        });
      }
    } catch (error) {
      console.error('❌ Error inesperado en forceUIRefresh:', error);
      toast({
        title: "Error inesperado",
        description: "Hubo un problema al refrescar la interfaz. Intente recargar la página.",
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      refreshStarted = false;
    }
  }, [setSelectedChat, setMessages, toast]);

  // Exponer la función de refresco para acceso global
  if (typeof window !== 'undefined') {
    (window as any).forceUIRefresh = forceUIRefresh;
  }

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
    const subscription = subscribeToConversationMessages(chatId, (payload: any) => {
      if (!payload || !payload.new) {
        console.log("Evento de tiempo real recibido sin datos nuevos");
        return;
      }
      
      // Obtener propiedades del nuevo mensaje
      const newMessage = payload.new;
      const messageId = newMessage.id || '';
      const messageContent = newMessage.content || '';
      
      console.log(`📩 Nuevo mensaje recibido en tiempo real: ${messageContent.substring(0, 20)}... [ID: ${messageId.substring(0, 8)}]`);
      
      // Verificar si este mensaje fue enviado por nosotros (optimistic UI)
      // Esto es crítico para evitar duplicados al enviar mensajes
      const isOurRecentlySentMessage = recentlySentMessages.some(sentMsg => {
        // Verificar por ID si existe
        if (sentMsg.id === messageId) {
          console.log(`🔍 Este mensaje es uno enviado por nosotros con el mismo ID, ignorando`);
          return true;
        }
        
        // Verificar por contenido y tiempo si el ID es diferente (puede ser un tempId vs ID real)
        if (sentMsg.content === messageContent && 
            Math.abs(new Date(sentMsg.timestamp).getTime() - new Date(newMessage.created_at).getTime()) < 10000) {
          console.log(`🔍 Este mensaje coincide con uno enviado por nosotros recientemente, ignorando`);
          return true;
        }
        
        return false;
      });
      
      // Si es un mensaje que enviamos nosotros, ignorarlo para evitar duplicados
      if (isOurRecentlySentMessage) {
        console.log(`🔄 Ignorando mensaje recibido por realtime que acabamos de enviar nosotros`);
        return;
      }
      
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
        
        // Verificar duplicados por contenido y timestamp cercano (dentro de 5 segundos)
        const isDuplicate = prevMessages.some(msg => 
          msg.content === transformedMessage.content && 
          msg.sender === transformedMessage.sender &&
          Math.abs(new Date(msg.timestamp).getTime() - new Date(transformedMessage.timestamp).getTime()) < 5000
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

      // Verificar si el mensaje contiene alguna de las frases clave
      const keyPhrases = [
        "¡Perfecto! tu cita ha sido confirmada para",
        "¡Perfecto! un asesor te llamará",
        "¡Perfecto! un asesor te contactará",
        "¡Perfecto! una persona te contactará"
      ];
      
      const containsKeyPhrase = transformedMessage.content ? keyPhrases.some(phrase => 
        transformedMessage.content.toLowerCase().includes(phrase.toLowerCase())
      ) : false;
      
      // Si el mensaje contiene una frase clave, verificar y registrar explícitamente
      if (containsKeyPhrase) {
        console.log(`🌟 FRASE CLAVE DETECTADA en mensaje: "${transformedMessage.content.substring(0, 50)}..."`);
        console.log(`🔍 Remitente: ${transformedMessage.sender}, conversación: ${chatId}`);
        
        // CAMBIO IMPORTANTE: SIEMPRE marcar como importante cuando el bot envía una frase clave
        console.log(`🔄 Marcando conversación ${chatId} como importante automáticamente porque contiene frase clave del bot`);
        
        // Forzar la actualización de la conversación para marcarla como importante
        try {
          // Actualizar en la base de datos primero
          console.log(`🔄 Marcando conversación ${chatId} como importante en la base de datos`);
          supabase
            .from('conversations')
            .update({ 
              user_category: "important", 
              tag: "yellow",
              colorLabel: "yellow",
              manuallyMovedToAll: false,
              manuallyMovedToAllTimestamp: null
            })
            .eq('id', chatId)
            .then(({ error }: { error: any }) => {
              if (error) {
                console.error('Error al actualizar categoría en la base de datos:', error);
              } else {
                console.log(`✅ Conversación ${chatId} marcada como importante en la base de datos`);
                
                // Limpiar localStorage también
                if (typeof window !== 'undefined') {
                  try {
                    console.log(`🧹 Eliminando estado "movido manualmente a Todos" para conversación ${chatId} de localStorage`);
                    localStorage.removeItem(`manually_moved_${chatId}`);
                    localStorage.removeItem(`manually_moved_time_${chatId}`);
                  } catch (e) {
                    console.error('Error removing from localStorage:', e);
                  }
                }
                
                // Actualizar también el objeto en memoria
                setConversations(prevConversations => {
                  return prevConversations.map(conv => {
                    if (conv.id === chatId) {
                      return {
                        ...conv,
                        userCategory: "important",
                        tag: "yellow",
                        colorLabel: "yellow",
                        manuallyMovedToAll: false,
                        manuallyMovedToAllTimestamp: null
                      };
                    }
                    return conv;
                  });
                });
                
                // Cambia a la pestaña de importantes automáticamente
                if (activeTab !== "important") {
                  console.log('🔄 Cambiando automáticamente a la pestaña IMPORTANTES');
                  setActiveTab("important");
                }
              }
            });
        } catch (dbError) {
          console.error('Error al intentar actualizar la base de datos:', dbError);
        }
      }
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
  const confirmDeleteConversation = useCallback(async () => {
    if (!selectedChat) return;
    
    try {
      const chatId = typeof selectedChat === 'string' ? selectedChat : selectedChat.id;
      console.log(`🗑️ Iniciando eliminación de conversación: ${chatId}`);
      
      // 1. Inmediatamente cerrar el diálogo y actualizar la UI
      setDeleteDialogOpen(false);
      
      // 2. Mostrar notificación de iniciando eliminación
      toast({
        title: "Eliminando conversación",
        description: "Iniciando proceso de eliminación...",
        duration: 2000
      });
      
      // 3. Primero limpiar toda la UI para evitar congelamiento
      setSelectedChat(null);
      setMessages([]);
      
      // 4. Extraer la conversación que vamos a eliminar antes de actualizar el estado
      const chatToDelete = conversations.find(conv => conv.id === chatId);
      
      // 5. Actualizar las conversaciones inmediatamente sin esperar la operación de DB
      setConversations(prev => prev.filter(conv => conv.id !== chatId));
      
      // 6. Ejecutar la eliminación real completamente desacoplada de la UI
      // Usamos un enfoque "fire and forget" con timeout
      setTimeout(() => {
        const deleteOperation = async () => {
          setIsDeleting(true);
          try {
            console.log(`🔄 Eliminando conversación ${chatId} en segundo plano`);
            const result = await deleteConversation(chatId);
            
            // Mostrar resultado silenciosamente sin bloquear
            if (result.success) {
              console.log(`✅ Conversación ${chatId} eliminada correctamente en la base de datos`);
              toast({
                title: "Conversación eliminada",
                description: "La conversación ha sido eliminada del servidor",
                duration: 3000
              });
              
              // Recargar conversaciones después de eliminar
              setTimeout(() => {
                if (loadConversationsRef.current) {
                  try {
                    console.log('✅ Recargando lista de conversaciones');
                    loadConversationsRef.current();
                  } catch (err: unknown) {
                    console.error('Error al recargar conversaciones:', err);
                  }
                }
              }, 1000);
            } else {
              console.error('⚠️ Error durante la eliminación en el servidor:', result.error);
              toast({
                title: "Advertencia",
                description: "La conversación fue eliminada de la interfaz pero puede haber un problema en el servidor",
                variant: "destructive",
                duration: 5000
              });
            }
          } catch (error) {
            console.error('⚠️ Error en eliminación en segundo plano:', error);
          } finally {
            setIsDeleting(false);
          }
        };
        
        // Ejecutar operación asincrónicamente
        deleteOperation().catch(e => {
          console.error('Error fatal en operación de eliminación:', e);
          setIsDeleting(false);
        });
      }, 100);
      
    } catch (error) {
      console.error('Error general en el proceso de eliminación:', error);
      setDeleteDialogOpen(false);
      setIsDeleting(false);
      
      toast({
        title: "Error inesperado",
        description: "Ocurrió un error al procesar la eliminación",
        variant: "destructive",
        duration: 5000
      });
    }
  }, [selectedChat, conversations, toast]);

  // Función para manejar el envío de mensajes
  const handleSendMessage = async (content: string, conversationId: string) => {
    try {
      if (!content.trim() || !conversationId) return;
      
      // Log inicial detallado para envío de mensaje
      console.log(`======== INICIO ENVÍO DE MENSAJE ========`);
      console.log(`📝 Mensaje: "${content}"`);
      console.log(`🆔 Conversación ID: ${conversationId}`); 
      
      setIsSending(true);
      
      try {
        // Generar un ID temporal para optimismo UI
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        // Usar Date.now() para el timestamp y asegurar formato ISO 8601 correcto
        const timestamp = new Date().toISOString();
        console.log(`⏰ Timestamp generado para nuevo mensaje: ${timestamp}`);
        
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
        // Añadir metadata para mejorar la detección del lado del servidor
        (optimisticMessage as any).metadata = {
          source: 'dashboard',
          sender_type: 'agent'
        };
        
        console.log(`💾 Creado mensaje optimista temporal con ID: ${tempId}`);
        
        // Añadir el mensaje a la lista de mensajes enviados recientemente
        // para evitar duplicados al recibir eventos de Supabase Realtime
        setRecentlySentMessages(prev => {
          const updatedList = [...prev, optimisticMessage];
          // Mantener solo los últimos 20 mensajes
          if (updatedList.length > 20) {
            updatedList.splice(0, updatedList.length - 20);
          }
          return updatedList;
        });
        
        // Programar la limpieza del mensaje de la lista después de 10 segundos
        setTimeout(() => {
          setRecentlySentMessages(prev => 
            prev.filter(msg => msg.id !== tempId && msg.content !== content)
          );
        }, 10000);
        
        // Actualizar el estado con el mensaje optimista
        setMessages(prevMessages => {
          // Verificar si prevMessages es un array válido
          if (!Array.isArray(prevMessages)) {
            console.warn('⚠️ prevMessages no es un array válido:', prevMessages);
            return [optimisticMessage];
          }
          
          // Asegurarnos de no duplicar mensajes
          if (prevMessages.some(msg => 
            msg.content === content && 
            Math.abs(new Date(msg.timestamp).getTime() - Date.now()) < 5000
          )) {
            console.log('⚠️ Mensaje duplicado detectado, no añadiendo:', content);
            return prevMessages;
          }
          
          const updatedMessages = [...prevMessages, optimisticMessage];
          
          // Usar la función centralizada para guardar en todos los sistemas
          storeMessages(conversationId, updatedMessages);
          console.log(`💾 Mensaje optimista guardado en localStorage`);
          
          // Scroll al final después de la actualización
          setTimeout(() => {
            scrollToBottom(true);
          }, 100);
          
          return updatedMessages;
        });
        
        // Enviar el mensaje a través de la API
        console.log(`📤 Enviando mensaje "${content}" a la API para conversación ${conversationId}`);
        const response = await sendMessage(conversationId, content, undefined, 'agent');
        
        if (response) {
          console.log(`✅ Mensaje enviado correctamente a través de la API:`, response);
          
          // Actualizar el mensaje optimista con los datos reales si es necesario
          if (response.id && response.id !== tempId) {
            console.log(`🔄 Actualizando mensaje optimista ${tempId} con el ID real ${response.id}`);
            setMessages(prevMessages => {
              return prevMessages.map(msg => {
                if (msg.id === tempId) {
                  return { ...msg, id: response.id, status: 'delivered' };
                }
                return msg;
              });
            });
          }
        } else {
          console.error(`❌ Error al enviar mensaje a través de la API`);
          toast({
            title: "Error al enviar mensaje",
            description: "No se pudo enviar el mensaje a WhatsApp. Se muestra localmente.",
            variant: "destructive",
            duration: 5000
          });
        }
        
        // Verificar si el mensaje contiene alguna de las frases clave
        const keyPhrases = [
          "¡Perfecto! tu cita ha sido confirmada para",
          "¡Perfecto! un asesor te llamará",
          "¡Perfecto! un asesor te contactará",
          "¡Perfecto! una persona te contactará"
        ];
        
        const containsKeyPhrase = content ? keyPhrases.some(phrase => 
          content.toLowerCase().includes(phrase.toLowerCase())
        ) : false;
        
        // Si el mensaje contiene una frase clave, verificar y registrar explícitamente
        if (containsKeyPhrase) {
          console.log(`🌟 FRASE CLAVE DETECTADA en mensaje: "${content.substring(0, 50)}..."`);
          console.log(`🔍 Remitente: me, conversación: ${conversationId}`);
          
          // CAMBIO IMPORTANTE: SIEMPRE marcar como importante cuando hay una frase clave
          console.log(`🔄 Marcando conversación ${conversationId} como importante automáticamente porque contiene frase clave`);
          
          // Forzar la actualización de la conversación para marcarla como importante
          try {
            // Actualizar en la base de datos primero
            console.log(`🔄 Marcando conversación ${conversationId} como importante en la base de datos`);
            supabase
              .from('conversations')
              .update({ 
                user_category: "important", 
                tag: "yellow",
                colorLabel: "yellow",
                manuallyMovedToAll: false,
                manuallyMovedToAllTimestamp: null
              })
              .eq('id', conversationId)
              .then(({ error }: { error: any }) => {
                if (error) {
                  console.error('Error al actualizar categoría en la base de datos:', error);
                } else {
                  console.log(`✅ Conversación ${conversationId} marcada como importante en la base de datos`);
                  
                  // Limpiar localStorage también
                  if (typeof window !== 'undefined') {
                    try {
                      console.log(`🧹 Eliminando estado "movido manualmente a Todos" para conversación ${conversationId} de localStorage`);
                      localStorage.removeItem(`manually_moved_${conversationId}`);
                      localStorage.removeItem(`manually_moved_time_${conversationId}`);
                    } catch (e) {
                      console.error('Error removing from localStorage:', e);
                    }
                  }
                  
                  // Actualizar también el objeto en memoria
                  setConversations(prevConversations => {
                    return prevConversations.map(conv => {
                      if (conv.id === conversationId) {
                        return {
                          ...conv,
                          userCategory: "important",
                          tag: "yellow",
                          colorLabel: "yellow",
                          manuallyMovedToAll: false,
                          manuallyMovedToAllTimestamp: null
                        };
                      }
                      return conv;
                    });
                  });
                  
                  // Cambia a la pestaña de importantes automáticamente
                  if (activeTab !== "important") {
                    console.log('🔄 Cambiando automáticamente a la pestaña IMPORTANTES');
                    setActiveTab("important");
                  }
                }
              });
          } catch (dbError) {
            console.error('Error al intentar actualizar la base de datos:', dbError);
          }
        }
        
        console.log(`======== FIN ENVÍO DE MENSAJE ========`);
      } catch (error) {
        console.error("❌ Error general al enviar mensaje:", error);
        toast({
          title: "Error inesperado",
          description: "Ocurrió un error al enviar el mensaje.",
          variant: "destructive",
        });
      } finally {
        setIsSending(false);
      }
    } catch (error) {
      console.error("❌ Error extremadamente inesperado:", error);
    }
  };

  // Funciones para actualizar conversación
  const handleUpdateConversation = async (id: string, updates: any) => {
    try {
      if (!id) return;
      
      console.log(`🔄 Iniciando actualización para conversación ${id}:`, updates);
      
      // Actualizar localmente primero para UI responsiva
      setConversations(prevConvs => {
        console.log(`🔄 Actualizando localmente...`);
        return prevConvs.map(conv => 
          conv.id === id ? { 
            ...conv, 
            ...updates,
            userCategory: updates.user_category || conv.userCategory 
          } : conv
        );
      });
      
      console.log(`🔄 Actualizando conversación ${id} directamente en Supabase:`, updates);
      
      // Usar Supabase directamente para evitar problemas de redirección
      const { data, error } = await supabase
        .from('conversations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error al actualizar conversación en Supabase:', error);
        // Revertir cambios locales si hay error
        toast({
          title: "Error",
          description: "No se pudo actualizar la conversación",
          variant: "destructive"
        });
        
        // Forzar refresco para restaurar el estado original
        console.log(`🔄 Forzando refresco para restaurar estado original`);
        loadConversationsRef.current();
      } else {
        console.log('✅ Conversación actualizada exitosamente en Supabase:', data);
        
        // Limpiar la caché de localStorage para esta conversación
        if (typeof window !== 'undefined') {
          try {
            // Intentar limpiar caches que puedan estar causando problemas
            console.log(`🧹 Limpiando caché local para id: ${id}`);
            localStorage.removeItem(`conversation_${id}`);
            localStorage.removeItem(`messages_${id}`);
          } catch (e) {
            console.log('Error al limpiar caché local:', e);
          }
        }
        
        // Mostrar toast de éxito
        toast({
          title: "Éxito",
          description: updates.user_category === 'important' 
            ? "Conversación marcada como importante" 
            : updates.user_category === 'default'
              ? "Conversación movida a Todos"
              : "Conversación actualizada correctamente",
          duration: 3000
        });
      }
    } catch (error) {
      console.error('❌ Error al actualizar conversación:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la conversación",
        variant: "destructive"
      });
    }
  }

  // Marcar como importante o no importante
  const handleToggleImportant = (id: string, isCurrentlyImportant: boolean) => {
    console.log(`🔄 Cambiando estado de conversación ${id}: ${isCurrentlyImportant ? 'importante → normal' : 'normal → importante'}`);
    
    // Si está marcada como importante, cambiarla a default
    // Si no está marcada como importante, cambiarla a important
    const newCategory = isCurrentlyImportant ? "default" : "important";
    
    // Obtener la hora actual para el timestamp
    const now = new Date().toISOString();
    
    // Preparar actualizaciones según la acción
    const updates: any = { 
      user_category: newCategory 
    };
    
    // Si la estamos pasando a importante
    if (newCategory === "important") {
      updates.tag = "yellow";
      updates.colorLabel = "yellow";
      updates.manuallyMovedToAll = false;
      updates.manuallyMovedToAllTimestamp = null;
    } 
    // Si la estamos pasando a todos (no importante)
    else {
      updates.tag = "gray";
      updates.colorLabel = "gray";
      updates.manuallyMovedToAll = true;
      updates.manuallyMovedToAllTimestamp = now;
      
      // Guardar en localStorage para persistir entre recargas
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`manually_moved_${id}`, 'true');
          localStorage.setItem(`manually_moved_time_${id}`, now);
          console.log(`✅ Guardado estado "movido manualmente a Todos" para conversación ${id} en localStorage`);
        } catch (e) {
          console.error('Error saving to localStorage:', e);
        }
      }
    }
    
    // Actualizar UI inmediatamente para mejor experiencia
    setConversations(prevConvs => 
      prevConvs.map(conv => 
        conv.id === id ? { 
          ...conv, 
          userCategory: newCategory,
          colorLabel: newCategory === "important" ? "yellow" : "gray",
          tag: newCategory === "important" ? "yellow" : "gray",
          manuallyMovedToAll: newCategory === "important" ? false : true,
          manuallyMovedToAllTimestamp: newCategory === "important" ? null : now
        } : conv
      )
    );
    
    // Luego enviar a la base de datos con prioridad alta
    console.log(`⚠️ Enviando actualización prioritaria a la base de datos para conversación ${id}`);
    
    // Usar una función directa a Supabase para garantizar que la actualización se realiza
    // incluso si hay errores en otras partes de la aplicación
    const updateDatabase = async () => {
      try {
        // Actualización directa en Supabase
        const { data, error } = await supabase
          .from('conversations')
          .update({
            user_category: newCategory,
            tag: newCategory === "important" ? "yellow" : "gray",
            manuallyMovedToAll: newCategory === "important" ? false : true,
            manuallyMovedToAllTimestamp: newCategory === "important" ? null : now
          })
          .eq('id', id);
        
        if (error) {
          console.error('❌ Error al actualizar en Supabase:', error);
          toast({
            title: "Error de sincronización",
            description: "No se pudo guardar el cambio en el servidor. Los cambios podrían perderse al recargar.",
            variant: "destructive"
          });
          return false;
        }
        
        console.log('✅ Actualización en Supabase completada con éxito');
        return true;
      } catch (e) {
        console.error('❌ Excepción al actualizar en Supabase:', e);
        return false;
      }
    };
    
    // Ejecutar la actualización de Supabase y también la función normal para actualizar el resto del estado
    updateDatabase().then(success => {
      if (success) {
        handleUpdateConversation(id, updates);
      }
    });
    
    // Forzar refresco completo y cambio de pestaña
    setTimeout(() => {
      // Cambiar a la pestaña destino según la acción que se realizó
      if (isCurrentlyImportant) {
        // Si estaba importante y ahora pasa a normal, ir a "all"
        console.log(`🔄 Cambiando a pestaña TODOS después de desmarcar conversación ${id}`);
        setActiveTab("all");
      } else {
        // Si estaba normal y ahora pasa a importante, ir a "important"
        console.log(`🔄 Cambiando a pestaña IMPORTANTES después de marcar conversación ${id}`);
        setActiveTab("important");
      }
      
      // Forzar refresco completo para que los filtros se apliquen correctamente
      console.log(`🔄 Forzando refresco completo de conversaciones`);
      try {
        loadConversationsRef.current();
        console.log(`✅ Refresco completo finalizado`);
      } catch (error) {
        console.error("Error al refrescar conversaciones:", error);
      }
    }, 500);
  };

  // Actualizar etiqueta de conversación
  const handleUpdateTag = (id: string, tag: string) => {
    handleUpdateConversation(id, { tag });
  }

  // Actualizar categoría de usuario
  const handleUpdateUserCategory = (id: string, userCategory: "default" | "important" | "urgent" | "completed") => {
    handleUpdateConversation(id, { user_category: userCategory });
  }

  // Actualizar etiqueta de color
  const handleUpdateColorLabel = useCallback((id: string, colorLabel: string) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === id ? { ...conv, colorLabel } : conv
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
    setShowAnalytics(true)
    setShowConfig(false)
    setSelectedChat(null)
    router.push('/dashboard/analytics')
  }, [router])

  // Cambiar a la vista de configuración
  const toggleConfig = useCallback(() => {
    setShowConfig(true)
    setShowAnalytics(false)
    setSelectedChat(null)
    router.push('/dashboard/config')
  }, [router])

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
      (conv.lastMessage?.toLowerCase()?.includes(searchQuery.toLowerCase()) ?? false);

    // Frases claves para detectar conversaciones importantes
    const keyPhrases = [
      "¡Perfecto! tu cita ha sido confirmada para",
      "¡Perfecto! un asesor te llamará",
      "¡Perfecto! un asesor te contactará",
      "¡Perfecto! una persona te contactará"
    ];

    // Verificar si el mensaje contiene alguna de las frases clave
    const containsKeyPhrase = keyPhrases.some(phrase => 
      (conv.lastMessage?.toLowerCase().includes(phrase.toLowerCase()) ?? false)
    );

    // Verificar si fue movida manualmente a "Todos"
    const wasManuallyMovedToAll = conv.manuallyMovedToAll === true;
    
    // Una conversación es importante si:
    // 1. Tiene categoría "important"/"urgent" O
    // 2. Contiene frases clave Y NO fue movida manualmente a "Todos"
    const isImportant = 
      (conv.userCategory === "important" || conv.userCategory === "urgent") || 
      (containsKeyPhrase && !wasManuallyMovedToAll); // Solo considerar frases clave si no fue movida manualmente

    if (activeTab === "important") return matchesSearch && isImportant;
    // En la pestaña "Todos" mostrar las que NO son importantes
    if (activeTab === "all") return matchesSearch && !isImportant;
    
    return matchesSearch;
  });

  // Handler for updating a conversation's name
  const handleUpdateName = useCallback((id: string, name: string) => {
    console.log(`📝 Actualizando nombre para conversación ${id} a "${name}"`);
    
    // Actualizar el estado local inmediatamente para una experiencia más fluida
    setConversations(prevConvs => 
      prevConvs.map(conv => 
        conv.id === id ? { 
          ...conv, 
          name: name  // Actualizar el nombre localmente
        } : conv
      )
    );
    
    // Luego enviar la actualización al servidor
    handleUpdateConversation(id, { sender_name: name });
  }, []);

  // Efecto para comprobar y restaurar la sesión si es necesario
  useEffect(() => {
    const checkAndRestoreSession = async () => {
      // Comprobar si acabamos de navegar desde otra página usando el parámetro keepSession
      if (typeof window !== 'undefined' && window.location.search.includes('keepSession=true')) {
        try {
          // Intentar obtener la sesión actual
          const { data: { session } }: { data: { session: any } } = await supabase.auth.getSession();
          
          // Si no hay sesión pero tenemos un token de respaldo, intentar restaurarla
          if (!session) {
            const backupToken = localStorage.getItem('supabase_auth_token_backup');
            const backupExpiry = localStorage.getItem('supabase_auth_token_backup_expiry');
            
            if (backupToken && backupExpiry && parseInt(backupExpiry) > Date.now()) {
              console.log('🔄 Intentando restaurar sesión desde token de respaldo');
              
              // Intentar restaurar la sesión con el token de respaldo
              const { error } = await supabase.auth.setSession({
                access_token: backupToken,
                refresh_token: backupToken // Usar como refresh token en caso de emergencia
              });
              
              if (error) {
                console.error('❌ Error al restaurar sesión:', error);
                toast({
                  title: "Error de sesión",
                  description: "No se pudo restaurar la sesión. Por favor, inicie sesión nuevamente.",
                  variant: "destructive"
                });
                router.push('/login');
              } else {
                console.log('✅ Sesión restaurada correctamente');
                toast({
                  title: "Sesión restaurada",
                  description: "Su sesión se ha restaurado correctamente.",
                  duration: 2000
                });
              }
            }
          } else {
            console.log('✅ Sesión activa detectada');
          }
        } catch (error) {
          console.error('❌ Error al verificar sesión:', error);
        } finally {
          // Limpiar parámetros de URL para evitar problemas
          if (window.history && window.history.replaceState) {
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
          }
        }
      }
    };
    
    if (mounted) {
      checkAndRestoreSession();
    }
  }, [mounted, router, toast]);

  // Set up a global subscription to conversations table to detect important status changes
  useEffect(() => {
    console.log('🔄 Configurando suscripción global a actualizaciones de conversaciones');
    
    // Create a channel for conversations updates
    const channel = supabase
      .channel('conversations-status-changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
      }, (payload: any) => {
        // If no data or no updated conversation, ignore
        if (!payload || !payload.new || !payload.old) {
          return;
        }
        
        const updatedConversation = payload.new;
        const oldConversation = payload.old;
        
        // If is_important or user_category changed, update our UI
        const importantStatusChanged = 
          updatedConversation.is_important !== oldConversation.is_important ||
          updatedConversation.user_category !== oldConversation.user_category;
        
        if (importantStatusChanged) {
          console.log(`🔔 Actualización de estado importante detectada para conversación: ${updatedConversation.id}`);
          console.log(`   - is_important: ${oldConversation.is_important} → ${updatedConversation.is_important}`);
          console.log(`   - user_category: ${oldConversation.user_category} → ${updatedConversation.user_category}`);
          
          // Update the conversations state
          setConversations(prevConversations => {
            // First check if we already have this conversation
            const existingConversation = prevConversations.find(c => c.id === updatedConversation.id);
            
            if (!existingConversation) {
              console.log(`📊 Conversación ${updatedConversation.id} no encontrada en el estado actual, recargando todas las conversaciones...`);
              
              // If we don't have this conversation, refresh all conversations
              if (loadConversationsRef.current) {
                setTimeout(() => {
                  try {
                    loadConversationsRef.current();
                    console.log('✅ Lista de conversaciones actualizada en tiempo real');
                  } catch (err) {
                    console.error('❌ Error al recargar conversaciones:', err);
                  }
                }, 100);
              }
              
              return prevConversations;
            }
            
            // Update just this conversation
            return prevConversations.map(conv => {
              if (conv.id === updatedConversation.id) {
                return {
                  ...conv,
                  userCategory: updatedConversation.user_category || conv.userCategory,
                  is_important: updatedConversation.is_important,
                  manuallyMovedToAll: updatedConversation.manuallyMovedToAll,
                  colorLabel: updatedConversation.colorLabel || conv.colorLabel,
                  tag: updatedConversation.tag || conv.tag,
                };
              }
              return conv;
            });
          });
          
          // If is_important changed to true, switch to important tab
          if (updatedConversation.is_important === true && oldConversation.is_important === false) {
            if (activeTab !== "important") {
              console.log('🔄 Cambiando automáticamente a la pestaña IMPORTANTES debido a actualización en tiempo real');
              setTimeout(() => setActiveTab("important"), 300);
            }
          }
        }
      })
      .subscribe((status: string) => {
        console.log(`🔄 Estado de suscripción a cambios de conversaciones: ${status}`);
      });
    
    // Clean up the subscription on unmount
    return () => {
      channel.unsubscribe();
      console.log('🔕 Suscripción a conversaciones cancelada');
    };
  }, []); // Empty dependency array to run only once on mount

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
                setIsLoadingConversations(true);
                fetchConversations(hardcodedId)
                  .then(conversations => {
                    if (conversations && conversations.length > 0) {
                      const sortedConversations = conversations.sort((a: any, b: any) => {
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
                    setIsLoadingConversations(false);
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
        <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-r-2xl">
          <div className="text-center">
            <div className="mb-6 flex items-center justify-center">
              <img
                src={theme === "dark" ? "/logobalanco/blancotransparte.png" : "/logo longin/BEXO (8).png"}
                alt="BEXOR Logo"
                className="h-40 w-auto object-contain"
              />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Powered by BEXOR</h3>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Selecciona un chat para comenzar a enviar mensajes
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Renderizar la interfaz principal
  return (
    <div className="flex h-full bg-gray-100 dark:bg-gray-950 p-2">
      <div className="flex w-full max-w-[98%] mx-auto rounded-2xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800">
        {/* Barra de navegación principal */}
        <div className="w-16 bg-[#f2e8df] dark:bg-[#4e6b95] flex flex-col items-center py-6 text-[#2e3c53] dark:text-white rounded-xl">
          <div className="flex-1 flex flex-col items-center mt-8 space-y-10">
            <Button
              variant="ghost"
              className={cn(
                "w-12 h-12 p-0 hover:bg-[#afc5de] dark:hover:bg-[#364863] rounded-xl",
                !showAnalytics && !showConfig && !selectedChat && "bg-[#afc5de] dark:bg-[#364863]",
              )}
              onClick={() => {
                setShowAnalytics(false)
                setShowConfig(false)
                setSelectedChat(null)
              }}
            >
              <Home className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              className={cn(
                "w-12 h-12 p-0 hover:bg-[#afc5de] dark:hover:bg-[#364863] rounded-xl",
                showAnalytics && "bg-[#afc5de] dark:bg-[#364863]",
              )}
              onClick={toggleAnalytics}
            >
              <BarChart2 className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              className={cn(
                "w-12 h-12 p-0 hover:bg-[#afc5de] dark:hover:bg-[#364863] rounded-xl",
                showConfig && "bg-[#afc5de] dark:bg-[#364863]",
              )}
              onClick={toggleConfig}
            >
              <Settings className="h-6 w-6 text-[#40E0D0]" />
            </Button>
          </div>
          <div className="flex flex-col items-center space-y-10 mb-10 mt-10">
            <Button
              variant="ghost"
              className="w-12 h-12 p-0 hover:bg-[#afc5de] dark:hover:bg-[#364863] rounded-xl"
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
            </Button>
            <Button
              variant="ghost"
              className="w-12 h-12 p-0 hover:bg-[#afc5de] dark:hover:bg-[#364863] rounded-xl"
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
            {isLoadingConversations && !conversations.length ? (
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
              onUpdateTag={handleUpdateTag}
              onUpdateColorLabel={(id, colorLabel) => handleUpdateConversation(id, { tag: colorLabel })}
              onUpdateUserCategory={handleUpdateUserCategory}
              onToggleImportant={handleToggleImportant}
              onUpdateName={handleUpdateName}
              allConversations={conversations}
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
                    <img
                      src={theme === "dark" ? "/logobalanco/blancotransparte.png" : "/logo longin/BEXO (8).png"}
                      alt="BEXOR Logo"
                      className="h-40 w-auto object-contain"
                    />
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
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDeleteConversation}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


