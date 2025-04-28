"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { Search, Plus, Filter, MoreVertical, CheckCheck, Check } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UIConversation } from "@/types"
import { format, isToday, isYesterday } from "date-fns"
import { es } from "date-fns/locale"

interface ConversationsListProps {
  conversations: UIConversation[]
  selectedChatId: string | null
  onSelectChat: (id: string) => void
  onSearch: (query: string) => void
  searchQuery: string
}

export default function ConversationsList({
  conversations,
  selectedChatId,
  onSelectChat,
  onSearch,
  searchQuery,
}: ConversationsListProps) {
  const [activeTab, setActiveTab] = useState("all")

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    if (isToday(date)) {
      return format(date, "HH:mm")
    }
    if (isYesterday(date)) {
      return "Ayer"
    }
    return format(date, "dd/MM/yy")
  }

  // Filter conversations based on active tab
  const filteredByTab = conversations.filter((conv) => {
    if (activeTab === "unread") return typeof conv.unread === 'number' ? conv.unread > 0 : !!conv.unread
    if (activeTab === "business") return conv.isBusinessAccount
    if (activeTab === "personal") return !conv.isBusinessAccount
    return true // "all" tab
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Chats</h2>
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="icon" className="text-gray-500">
              <Filter className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-gray-500">
              <Plus className="h-5 w-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-gray-500">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>New group</DropdownMenuItem>
                <DropdownMenuItem>New broadcast</DropdownMenuItem>
                <DropdownMenuItem>Labels</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Sort by</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search or start new chat"
            className="pl-9 bg-dashboard-hover border-none"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
        <div className="px-3 pt-2">
          <TabsList className="w-full bg-muted grid grid-cols-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="business">Business</TabsTrigger>
            <TabsTrigger value="personal">Personal</TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto">
        {filteredByTab.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm">
              {searchQuery ? "No conversations found" : "No conversations yet"}
            </p>
          </div>
        ) : (
          filteredByTab.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => onSelectChat(conversation.id)}
              className={cn(
                "w-full p-3 flex items-start gap-3 hover:bg-gray-100 transition-colors",
                selectedChatId === conversation.id && "bg-gray-100",
              )}
            >
              <Avatar className="h-10 w-10 shrink-0">
                <div className="flex h-full w-full items-center justify-center bg-primary text-primary-foreground font-semibold">
                  {conversation.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </div>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium truncate">{conversation.name}</p>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatTime(conversation.timestamp)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm text-muted-foreground truncate">
                    {conversation.lastMessage}
                  </p>
                  {conversation.unread && (
                    <Badge variant="default" className="h-2 w-2 rounded-full p-0" />
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

