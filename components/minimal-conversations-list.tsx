"use client"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { Search, Tag, X, RefreshCw, AlertTriangle, User, Bell, CheckCheck, MoreVertical } from "lucide-react"
import { useState, memo, useCallback, useMemo, useEffect } from "react"
import { UserAvatar } from "./user-avatar"
import { ChatTagButton } from "./chat-tag-button"
import type { UIConversation } from "@/types"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Button } from "./ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"
import { Badge } from "./ui/badge"

interface MinimalConversationsListProps {
  conversations: UIConversation[]
  selectedChatId: string | { id: string } | null
  onSelectChat: (id: string) => void
  onSearch: (query: string) => void
  searchQuery: string
  activeTab: string
  setActiveTab: (tab: string) => void
  onUpdateColorLabel: (id: string, colorLabel: string) => void
  onUpdateUserCategory: (id: string, category: "default" | "important" | "urgent" | "completed") => void
  onUpdateTag?: (id: string, tag: string) => void
  onToggleImportant?: (id: string, isCurrentlyImportant: boolean) => void
  onUpdateName?: (id: string, name: string) => void
  allConversations?: UIConversation[]
}

// Cachear las fechas para evitar re-renderizados
const dateCache = new Map<string, string>();

// Función para formatear fecha con caché
const formatRelativeDate = (timestamp: string) => {
  if (!timestamp) return 'Fecha desconocida';
  
  // Si ya tenemos esta fecha en caché, devolverla
  if (dateCache.has(timestamp)) {
    return dateCache.get(timestamp) as string;
  }
  
  // Si no está en caché, calcularla
  try {
    const date = new Date(timestamp);
    const formatted = formatDistanceToNow(date, { addSuffix: true });
    // Guardar en caché
    dateCache.set(timestamp, formatted);
    return formatted;
  } catch (error) {
    console.error('Error formateando fecha:', error);
    return 'Fecha inválida';
  }
};

// Memo-ized conversation item to prevent unnecessary re-renders
const ConversationItem = memo(({
  conversation,
  isSelected,
  onSelect,
  onTagUpdate,
  onToggleImportant,
  onUpdateName
}: {
  conversation: UIConversation
  isSelected: boolean
  onSelect: (id: string) => void
  onTagUpdate: (id: string, tag: string) => void
  onToggleImportant?: (id: string, isCurrentlyImportant: boolean) => void
  onUpdateName?: (id: string, name: string) => void
}) => {
  // Formatear de manera óptima usando nuestra función cacheada
  const formattedDate = formatRelativeDate(conversation.timestamp);
  const isImportant = conversation.userCategory === "important" || conversation.userCategory === "urgent";
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(conversation.name);
  
  // Actualizar el estado local cuando cambia la prop conversation.name
  useEffect(() => {
    setNewName(conversation.name);
  }, [conversation.name]);
  
  // Utilizar el número de teléfono (user_id) como el nombre a mostrar
  const displayName = conversation.name !== conversation.user_id ? 
    conversation.name : conversation.user_id;
  
  // Iniciales para el avatar basadas en el nombre o número
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2);

  const handleEditName = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingName(true);
  }, []);

  const handleSaveName = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (newName && newName.trim() && newName !== conversation.name && onUpdateName) {
      onUpdateName(conversation.id, newName);
    }
    setIsEditingName(false);
  }, [conversation.id, conversation.name, newName, onUpdateName]);

  return (
    <div
      onClick={() => onSelect(conversation.id)}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors relative",
        isSelected
          ? "bg-primary-50 dark:bg-primary-900/30"
          : "hover:bg-gray-100 dark:hover:bg-gray-800",
        isImportant 
          ? "border-l-4 border-yellow-400" 
          : ""
      )}
    >
      <UserAvatar
        size="lg"
        colorCategory={conversation.userCategory as "default" | "important" | "urgent" | "completed"}
        initials={initials}
        showUserIcon={true}
        isBotActive={conversation.botActive}
      />

      {/* Menú de opciones - 3 puntos */}
      <div className="absolute top-3 right-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <MoreVertical className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={handleEditName}
            >
              <User className="mr-2 h-4 w-4" />
              <span>Cambiar nombre</span>
            </DropdownMenuItem>
            
            {onToggleImportant && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleImportant(conversation.id, isImportant);
                }}
                className={isImportant ? "text-yellow-600" : ""}
              >
                {isImportant ? (
                  <>
                    <CheckCheck className="mr-2 h-4 w-4" />
                    <span>Mover a Todos</span>
                  </>
                ) : (
                  <>
                    <Bell className="mr-2 h-4 w-4" />
                    <span>Marcar como Importante</span>
                  </>
                )}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 min-w-0 pr-6">
        <div className="flex items-center justify-between">
          {isEditingName ? (
            <form onSubmit={handleSaveName} onClick={(e) => e.stopPropagation()} className="flex-1 mr-2">
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={handleSaveName}
                className="h-7 py-1"
              />
            </form>
          ) : (
            <>
              <h4 className="font-medium truncate dark:text-white">{displayName}</h4>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formattedDate}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Mostrar siempre el número de teléfono */}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {conversation.user_id}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {conversation.status === "typing" ? (
              <span className="italic text-primary-600 dark:text-primary-400">typing...</span>
            ) : (
              conversation.lastMessage
            )}
          </p>
          {conversation.unread && typeof conversation.unread === 'number' && conversation.unread > 0 && (
            <span className="flex-shrink-0 h-5 w-5 flex items-center justify-center bg-primary-600 text-white rounded-full text-xs">
              ●
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

// Nombrar el componente para ayudar con la depuración
ConversationItem.displayName = 'ConversationItem';

// Componente principal con exportación por defecto
function MinimalConversationsList({
  conversations,
  selectedChatId,
  onSelectChat,
  onSearch,
  searchQuery,
  activeTab,
  setActiveTab,
  onUpdateColorLabel,
  onUpdateUserCategory,
  onUpdateTag,
  onToggleImportant,
  onUpdateName,
  allConversations,
}: MinimalConversationsListProps) {
  const [selectedColorFilter, setSelectedColorFilter] = useState<string>("all")
  const [isUpdating, setIsUpdating] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState<any>(null)

  // Función simple para determinar si una conversación es importante
  const isImportant = (conv: UIConversation) => {
    return conv.userCategory === "important" || conv.userCategory === "urgent";
  };

  // Filter conversations by color
  const filteredByColor =
    selectedColorFilter === "all"
      ? conversations
      : conversations.filter((conv) => conv.colorLabel === selectedColorFilter)

  // Filter conversations by search and active tab
  const filteredConversations = filteredByColor.filter((conv) => {
    // Verificar que todas las propiedades necesarias existan
    if (!conv || !conv.name) return false;
    
    // Verificación de depuración para asegurar que los valores necesarios están presentes
    console.log(`🔍 Filtrando conversación:`, {
      id: conv.id,
      name: conv.name,
      userCategory: conv.userCategory,
      tab: activeTab,
      manuallyMovedToAll: conv.manuallyMovedToAll
    });
    
    const matchesSearch =
      (conv.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (conv.user_id?.includes(searchQuery) ?? false) ||
      (conv.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    if (!matchesSearch) return false;

    // Frases claves para detectar conversaciones importantes
    const keyPhrases = [
      "¡Perfecto! tu cita ha sido confirmada para",
      "¡Perfecto! un asesor te llamará",
      "¡Perfecto! un asesor te contactará",
      "¡Perfecto! una persona te contactará"
    ];

    // Verificar si el mensaje contiene alguna de las frases clave
    const containsKeyPhrase = conv.lastMessage && keyPhrases.some(phrase => 
      (conv.lastMessage.toLowerCase().includes(phrase.toLowerCase()) ?? false)
    );

    // Verificar si fue movida manualmente a "Todos"
    const wasManuallyMovedToAll = conv.manuallyMovedToAll === true;
    
    // Una conversación es importante si:
    // 1. Tiene categoría "important"/"urgent" O
    // 2. Contiene frases clave PERO no fue movida manualmente a "Todos"
    const isImportant = 
      (conv.userCategory === "important" || conv.userCategory === "urgent") || 
      (containsKeyPhrase && !wasManuallyMovedToAll);
    
    // Mostrar por qué esta conversación se considera importante o no
    console.log(`🏷️ Conversación ${conv.id} (${conv.name}): ${isImportant ? '✅ IMPORTANTE' : '❌ NORMAL'}`);
    if (isImportant) {
      if (conv.userCategory === "important" || conv.userCategory === "urgent") {
        console.log(`  - Por categoría: ${conv.userCategory}`);
      }
      if (containsKeyPhrase && !wasManuallyMovedToAll) {
        console.log(`  - Por frase clave en: "${conv.lastMessage}"`);
      }
    } else if (containsKeyPhrase && wasManuallyMovedToAll) {
      console.log(`  - Contiene frase clave PERO fue movida manualmente a TODOS`);
    }

    // PESTAÑA IMPORTANTES: Mostrar SOLO las conversaciones importantes
    if (activeTab === "important") {
      const shouldShow = isImportant;
      console.log(`  - En pestaña IMPORTANTES: ${shouldShow ? '✅ MOSTRAR' : '❌ OCULTAR'}`);
      return shouldShow;
    }
    
    // PESTAÑA TODOS: Mostrar SOLO las conversaciones NO importantes
    if (activeTab === "all") {
      const shouldShow = !isImportant;
      console.log(`  - En pestaña TODOS: ${shouldShow ? '✅ MOSTRAR' : '❌ OCULTAR'}`);
      return shouldShow;
    }
    
    // Si por algún motivo llegamos aquí, no mostrar
    console.log(`  - Caso no controlado: ❌ OCULTAR`);
    return false;
  })

  // Handle tag update - Memoized to prevent unnecessary re-creations
  const handleTagUpdate = useCallback((id: string, tag: string) => {
    if (onUpdateTag) {
      onUpdateTag(id, tag)
    }
  }, [onUpdateTag]);

  // Memoized select handler factory
  const createSelectHandler = useCallback((id: string) => () => {
    onSelectChat(id);
  }, [onSelectChat]);

  // Función para manejar la actualización manual
  const handleManualRefresh = () => {
    setIsUpdating(true);
    // Utilizar la función expuesta globalmente
    if (typeof window !== 'undefined' && (window as any).refreshConversations) {
      (window as any).refreshConversations()
        .then(() => {
          // Mostrar un toast de éxito si es necesario
        })
        .catch((error: any) => {
          console.error('Error al actualizar conversaciones:', error);
        })
        .finally(() => {
          setTimeout(() => {
            setIsUpdating(false);
          }, 500); // Pequeño retraso para la animación
        });
    } else {
      setIsUpdating(false);
    }
  };

  // Helper para determinar si una conversación está seleccionada
  const isConversationSelected = (convId: string) => {
    if (!selectedChatId) return false;
    return typeof selectedChatId === 'string' 
      ? selectedChatId === convId 
      : selectedChatId.id === convId;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center bg-white rounded-full p-3 h-20 w-20">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/BEXO%20%281%29-ioN7LHMsHngPVmhgPVNy7Pns2XPtZH.png"
              alt="BEXOR Logo"
              className="h-16 w-auto object-contain"
            />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold dark:text-white text-lg">Chat Control</h2>
          </div>
          <button
            onClick={handleManualRefresh}
            disabled={isUpdating}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Actualizar conversaciones"
          >
            <RefreshCw className={`h-5 w-5 text-gray-500 dark:text-gray-300 ${isUpdating ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Looking for..."
            className="pl-9 bg-white dark:bg-gray-800 border-none rounded-xl shadow-sm"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => onSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b dark:border-gray-700 bg-white dark:bg-gray-800 p-1 gap-1">
        <button
          className={cn(
            "flex-1 py-3 text-sm font-medium rounded-lg transition-colors relative",
            activeTab === "all"
              ? "text-white bg-[#332c40] dark:bg-[#26212f]"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700",
          )}
          onClick={() => setActiveTab("all")}
        >
          Todos
          {(allConversations || conversations) && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-400 text-black">
              {(allConversations || conversations).filter(conv => !isImportant(conv)).length}
            </span>
          )}
        </button>
        <button
          className={cn(
            "flex-1 py-3 text-sm font-medium rounded-lg transition-colors relative",
            activeTab === "important"
              ? "text-white bg-[#332c40] dark:bg-[#26212f]"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700",
          )}
          onClick={() => setActiveTab("important")}
        >
          Importantes
          {(allConversations || conversations) && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-400 text-black">
              {(allConversations || conversations).filter(conv => isImportant(conv)).length}
            </span>
          )}
        </button>
      </div>

      {/* Chats */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Chats</h3>
          <div className="space-y-1">
            {filteredConversations.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {searchQuery || selectedColorFilter !== "all" ? "No conversations found" : "No conversations yet"}
                </p>
              </div>
            ) : (
              filteredConversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isSelected={isConversationSelected(conversation.id)}
                  onSelect={createSelectHandler(conversation.id)}
                  onTagUpdate={handleTagUpdate}
                  onToggleImportant={onToggleImportant}
                  onUpdateName={onUpdateName}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Exportamos una versión memorizada del componente principal para evitar renderizados innecesarios
export default memo(MinimalConversationsList);