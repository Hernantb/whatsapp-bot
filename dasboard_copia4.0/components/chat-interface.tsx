"use client"

import { useState, useEffect } from "react"
import ConversationsList from "@/components/conversations-list"
import ChatView from "@/components/chat-view"
import ContactInfo from "@/components/contact-info"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"
import { mockConversations, mockMessages } from "@/lib/mock-data"
import { MessageSquare } from "lucide-react"
import { UIConversation } from "@/types"

export default function ChatInterface() {
  const [selectedChat, setSelectedChat] = useState<string | null>(null)
  const [showContactInfo, setShowContactInfo] = useState(false)
  const [conversations, setConversations] = useState(mockConversations)
  const [messages, setMessages] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const isMobile = useMediaQuery("(max-width: 1024px)")

  // Load messages when a chat is selected
  useEffect(() => {
    if (selectedChat) {
      setIsLoading(true)
      // Simulate API call
      setTimeout(() => {
        setMessages(mockMessages.filter((msg) => msg.conversationId === selectedChat))
        setIsLoading(false)

        // Mark conversation as read
        setConversations((prev) => prev.map((conv) => (conv.id === selectedChat ? { ...conv, unread: 0 } : conv)))
      }, 500)
    }
  }, [selectedChat])

  // Filter conversations based on search query
  const filteredConversations = conversations.filter((conv) =>
    searchQuery === "" ||
      conv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.phone.includes(searchQuery) ||
      conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()),
  ).map(conv => {
    // Añadir los campos requeridos por el tipo UIConversation
    return {
      ...conv,
      userCategory: "default",
      unread: Boolean(conv.unread)  // Convertir número a booleano
    } as UIConversation;
  });

  // Handle sending a new message
  const handleSendMessage = (content: string) => {
    if (!selectedChat || !content.trim()) return

    const newMessage = {
      id: `msg-${Date.now()}`,
      conversationId: selectedChat,
      content,
      timestamp: new Date().toISOString(),
      status: "sent",
      sender: "me",
    }

    // Add message to the list
    setMessages((prev) => [...prev, newMessage])

    // Update conversation preview
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === selectedChat
          ? {
              ...conv,
              lastMessage: content,
              timestamp: new Date().toISOString(),
            }
          : conv,
      ),
    )

    // Simulate received message after 2 seconds
    setTimeout(() => {
      const autoReply = {
        id: `msg-${Date.now() + 1}`,
        conversationId: selectedChat,
        content: "Thanks for your message. I'll get back to you soon.",
        timestamp: new Date().toISOString(),
        status: "received",
        sender: "them",
      }

      setMessages((prev) => [...prev, autoReply])

      // Update conversation preview
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === selectedChat
            ? {
                ...conv,
                lastMessage: autoReply.content,
                timestamp: new Date().toISOString(),
              }
            : conv,
        ),
      )
    }, 2000)
  }

  return (
    <div className="flex h-full">
      {/* Conversations list */}
      <div className={cn("w-full lg:w-80 xl:w-96 border-r bg-white", selectedChat && isMobile ? "hidden" : "block")}>
        <ConversationsList
          conversations={filteredConversations}
          selectedChatId={selectedChat}
          onSelectChat={setSelectedChat}
          onSearch={setSearchQuery}
          searchQuery={searchQuery}
        />
      </div>

      {/* Chat view */}
      <div className={cn("flex-1 flex", !selectedChat && isMobile ? "hidden" : "flex")}>
        <div
          className={cn("flex-1 flex flex-col", showContactInfo && !isMobile ? "lg:w-[calc(100%-350px)]" : "w-full")}
        >
          {selectedChat ? (
            <ChatView
              conversation={conversations.find((c) => c.id === selectedChat) as UIConversation | undefined}
              messages={messages}
              isLoading={isLoading}
              onSendMessage={handleSendMessage}
              onInfoToggle={() => setShowContactInfo(!showContactInfo)}
              showInfo={showContactInfo}
              onBack={() => setSelectedChat(null)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-dashboard-bg">
              <div className="text-center p-8">
                <div className="w-16 h-16 bg-whatsapp/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="h-8 w-8 text-whatsapp" />
                </div>
                <h3 className="text-xl font-semibold mb-2">WhatsApp Business Dashboard</h3>
                <p className="text-muted-foreground max-w-md">Select a conversation from the list to start chatting</p>
              </div>
            </div>
          )}
        </div>

        {/* Contact info sidebar */}
        {showContactInfo && selectedChat && (
          <div className={cn("w-full lg:w-[350px] border-l bg-white", isMobile ? "absolute inset-0 z-20" : "relative")}>
            <ContactInfo
              contact={conversations.find((c) => c.id === selectedChat)}
              onClose={() => setShowContactInfo(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

