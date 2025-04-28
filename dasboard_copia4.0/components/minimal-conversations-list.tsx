"use client"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { Search, Tag, X, RefreshCw, AlertTriangle, User, Bell, CheckCheck } from "lucide-react"
import { useState, memo, useCallback, useMemo } from "react"
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
  onTagUpdate
}: {
  conversation: UIConversation
  isSelected: boolean
  onSelect: (id: string) => void
  onTagUpdate: (id: string, tag: string) => void
}) => {
  // Formatear de manera óptima usando nuestra función cacheada
  const formattedDate = formatRelativeDate(conversation.timestamp);

  return (
    <div
      onClick={() => onSelect(conversation.id)}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors relative",
        isSelected
          ? "bg-primary-50 dark:bg-primary-900/30"
          : "hover:bg-gray-100 dark:hover:bg-gray-800",
      )}
    >
      <UserAvatar
        size="lg"
        colorCategory={conversation.userCategory as "default" | "important" | "urgent" | "completed"}
        initials={conversation.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .substring(0, 2)}
        showUserIcon={true}
        isBotActive={conversation.botActive}
      />

      {/* Tag button - Positioned absolutely */}
      <div className="absolute top-3 right-3">
        <ChatTagButton
          currentTag={conversation.tag}
          onTagChange={(tag) => onTagUpdate(conversation.id, tag)}
        />
      </div>

      <div className="flex-1 min-w-0 pr-6">
        <div className="flex items-center justify-between">
          <h4 className="font-medium truncate dark:text-white">{conversation.name}</h4>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formattedDate}
          </span>
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
}: MinimalConversationsListProps) {
  const [selectedColorFilter, setSelectedColorFilter] = useState<string>("all")
  const [isUpdating, setIsUpdating] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState<any>(null)

  // Filter conversations by color
  const filteredByColor =
    selectedColorFilter === "all"
      ? conversations
      : conversations.filter((conv) => conv.colorLabel === selectedColorFilter)

  // Filter conversations by search and active tab
  const filteredConversations = filteredByColor.filter((conv) => {
    const matchesSearch =
      conv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.user_id?.includes(searchQuery) ?? false) ||
      conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())

    // Frases claves para detectar conversaciones importantes
    const keyPhrases = [
      "¡Perfecto! tu cita ha sido confirmada para",
      "¡Perfecto! un asesor te llamará",
      "¡Perfecto! un asesor te contactará",
      "¡Perfecto! una persona te contactará"
    ];

    // Verificar si el mensaje contiene alguna de las frases clave
    const containsKeyPhrase = keyPhrases.some(phrase => 
      conv.lastMessage.toLowerCase().includes(phrase.toLowerCase())
    );

    if (activeTab === "unread") return matchesSearch && containsKeyPhrase
    // En la pestaña "Todos" solo mostrar las que NO contienen frases clave
    if (activeTab === "all") return matchesSearch && !containsKeyPhrase
    return matchesSearch
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
            "flex-1 py-3 text-sm font-medium rounded-lg transition-colors",
            activeTab === "all"
              ? "text-white bg-[#332c40] dark:bg-[#26212f]"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700",
          )}
          onClick={() => setActiveTab("all")}
        >
          Todos
        </button>
        <button
          className={cn(
            "flex-1 py-3 text-sm font-medium rounded-lg transition-colors",
            activeTab === "unread"
              ? "text-white bg-[#332c40] dark:bg-[#26212f]"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700",
          )}
          onClick={() => setActiveTab("unread")}
        >
          Importantes
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