"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Send, Paperclip, Smile, MoreVertical, ArrowLeft, Info, CheckCheck, Check, MessageSquare } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useMediaQuery } from "@/hooks/use-media-query"
import { UIMessage, UIConversation } from "@/types"

interface ChatViewProps {
  conversation?: UIConversation
  messages: UIMessage[]
  isLoading: boolean
  onSendMessage: (content: string) => void
  onInfoToggle: () => void
  showInfo: boolean
  onBack: () => void
}

export default function ChatView({
  conversation,
  messages,
  isLoading,
  onSendMessage,
  onInfoToggle,
  showInfo,
  onBack,
}: ChatViewProps) {
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isMobile = useMediaQuery("(max-width: 1024px)")

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Format timestamp
  const formatMessageTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), "h:mm a")
    } catch (e) {
      return "now"
    }
  }

  // Format date for message groups
  const formatMessageDate = (timestamp: string) => {
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

      return format(messageDate, "MMMM d, yyyy")
    } catch (e) {
      return "Recent"
    }
  }

  // Group messages by date
  const groupedMessages = messages.reduce((groups: any, message) => {
    const date = formatMessageDate(message.timestamp)
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(message)
    return groups
  }, {})

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && !isSending) {
      setIsSending(true)
      onSendMessage(input)
      setInput("")
      setTimeout(() => setIsSending(false), 500)
    }
  }

  // Handle textarea key press (Enter to send)
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100">
        <p>Select a conversation</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center justify-between p-3 bg-dashboard-sidebar border-b">
        <div className="flex items-center">
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={onBack} className="mr-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Avatar className="h-10 w-10 mr-3">
            {conversation.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()}
          </Avatar>
          <div>
            <div className="flex items-center">
              <h3 className="font-medium">{conversation.name}</h3>
              {conversation.isBusinessAccount && (
                <Badge variant="outline" className="ml-2 text-xs bg-whatsapp/10 text-whatsapp border-none">
                  Business
                </Badge>
              )}
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
              <span>
                {conversation.status === "online"
                  ? "online"
                  : conversation.status === "typing"
                    ? "typing..."
                    : "offline"}
              </span>
              {conversation.labels.length > 0 && (
                <span className="ml-2 text-xs bg-gray-100 px-1.5 py-0.5 rounded-full">
                  {conversation.labels[0]}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onInfoToggle}
            className={cn("text-gray-500", showInfo && "bg-dashboard-active")}
          >
            <Info className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-gray-500">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Contact info</DropdownMenuItem>
              <DropdownMenuItem>Select messages</DropdownMenuItem>
              <DropdownMenuItem>Mute notifications</DropdownMenuItem>
              <DropdownMenuItem>Clear messages</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-500">Block contact</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-background">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <p className="text-muted-foreground">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-center bg-white p-6 rounded-lg shadow-sm">
              <div className="w-16 h-16 bg-whatsapp/10 rounded-full flex items-center justify-center mx-auto">
                <MessageSquare className="h-6 w-6 text-whatsapp" />
              </div>
              <p className="mt-4 font-medium">Start a conversation</p>
              <p className="text-sm text-muted-foreground mt-1">Send a message to {conversation.name}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date} className="space-y-3">
                <div className="flex justify-center">
                  <span className="text-xs bg-white/80 text-gray-500 px-2 py-1 rounded-md shadow-sm">{date}</span>
                </div>
                <div className="space-y-2">
                  {(msgs as UIMessage[]).map((message: UIMessage) => (
                    <div
                      key={message.id}
                      className={cn("flex", message.sender === "me" ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[75%] px-3 py-2 rounded-lg shadow-sm",
                          message.sender === "me" ? "message-sent" : "message-received"
                        )}
                      >
                        {message.type === "text" ? (
                          <>
                            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                            <div className="flex items-center justify-end mt-1 space-x-1">
                              <span className="text-[10px] text-gray-500">
                                {formatMessageTime(message.timestamp)}
                              </span>
                              {message.sender === "me" && (
                                message.status === "read" ? (
                                  <CheckCheck className="h-3 w-3 text-whatsapp" />
                                ) : message.status === "delivered" ? (
                                  <CheckCheck className="h-3 w-3 text-gray-400" />
                                ) : (
                                  <Check className="h-3 w-3 text-gray-400" />
                                )
                              )}
                            </div>
                          </>
                        ) : message.type === "image" ? (
                          <div className="space-y-1">
                            <img
                              src={message.content}
                              alt="Shared image"
                              className="max-w-[200px] max-h-[200px] object-contain rounded"
                            />
                            <div className="flex items-center justify-end space-x-1">
                              <span className="text-[10px] text-gray-500">
                                {formatMessageTime(message.timestamp)}
                              </span>
                            </div>
                          </div>
                        ) : message.type === "file" ? (
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <Paperclip className="h-4 w-4" />
                              <span className="text-sm">{message.fileName}</span>
                            </div>
                            <div className="flex items-center justify-end space-x-1">
                              <span className="text-[10px] text-gray-500">
                                {formatMessageTime(message.timestamp)}
                              </span>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="p-3 bg-dashboard-sidebar border-t">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex space-x-2">
            <Button type="button" variant="ghost" size="icon" className="text-gray-500">
              <Smile className="h-5 w-5" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="text-gray-500">
              <Paperclip className="h-5 w-5" />
            </Button>
          </div>

          <div className="relative flex-1">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type a message"
              className="min-h-[45px] max-h-[120px] resize-none py-3 rounded-md border-gray-200"
              disabled={isSending}
            />
          </div>

          <Button
            type="submit"
            size="icon"
            className="bg-whatsapp hover:bg-whatsapp-dark rounded-full h-10 w-10"
            disabled={isSending || !input.trim()}
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  )
}

