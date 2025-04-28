"use client"

import React, { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar"
import { MessageSquare, Search, Plus, LogOut, CheckCheck, Send, Paperclip, MoreVertical, Bot, BotOff, Loader2, Trash2, Settings, Star, StarOff, Phone, Mail, Clock, AlertCircle } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useUser } from '@/lib/hooks'
import { fetchUserConversations, fetchConversationMessages, sendMessage, toggleBot as toggleBotStatus } from '@/lib/database'
import type { Message, Conversation } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { useToast } from './ui/use-toast'

interface ChatControlPanelProps {
  userId: string
  userEmail: string
}

export default function ChatControlPanel({ userId, userEmail }: ChatControlPanelProps) {
  const { signOut } = useAuth()
  const { user } = useUser()
  const { toast } = useToast()
  const [selectedChat, setSelectedChat] = useState<string | null>(null)
  const [botActive, setBotActive] = useState(true)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('Verificando sesión...')
        const { data: { session } } = await supabase.auth.getSession()
        console.log('Sesión actual:', session)
        if (!session) {
          console.log('No hay sesión activa')
          return
        }
        loadConversations()
      } catch (error) {
        console.error('Error al verificar sesión:', error)
      }
    }
    
    checkSession()
  }, [])

  const loadConversations = async () => {
    if (!user?.id) {
      console.log('No user ID available')
      return
    }
    
    try {
      console.log('Iniciando carga de conversaciones...')
      setLoading(true)
      const data = await fetchUserConversations(user.id)
      console.log('Conversaciones obtenidas:', data)
      setConversations(data)
    } catch (error) {
      console.error('Error detallado al cargar conversaciones:', error)
      if (error instanceof Error) {
        console.error('Mensaje de error:', error.message)
        console.error('Stack trace:', error.stack)
      }
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las conversaciones',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async (conversationId: string) => {
    if (!user?.id) {
      console.log('No user ID available')
      return
    }

    try {
      setLoadingMessages(true)
      console.log('Loading messages for conversation:', conversationId)
      const data = await fetchConversationMessages(conversationId, user.id)
      console.log('Messages loaded:', data)
      setMessages(data)
    } catch (error) {
      console.error('Error loading messages:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los mensajes',
        variant: 'destructive',
      })
    } finally {
      setLoadingMessages(false)
    }
  }

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat)
    }
  }, [selectedChat])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !user?.id) return

    try {
      const sent = await sendMessage(selectedChat, newMessage, user.id, 'agent')
      if (sent) {
        setNewMessage('')
        loadMessages(selectedChat)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        title: 'Error',
        description: 'No se pudo enviar el mensaje',
        variant: 'destructive',
      })
    }
  }

  const toggleBot = async () => {
    if (!selectedChat) return
    
    try {
      const success = await toggleBotStatus(selectedChat, !botActive)
      if (success) {
        setBotActive(!botActive)
        toast({
          title: botActive ? 'Bot desactivado' : 'Bot activado',
          description: botActive ? 'El bot ha sido desactivado' : 'El bot ha sido activado',
        })
      }
    } catch (error) {
      console.error('Error toggling bot:', error)
      toast({
        title: 'Error',
        description: 'No se pudo cambiar el estado del bot',
        variant: 'destructive',
      })
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const filteredConversations = conversations.filter(conv => 
    conv.user_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.last_message?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="space-y-4 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-skyblue mx-auto" />
          <p className="text-gray-500">Cargando conversaciones...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Conversaciones</h2>
            <button className="p-2 hover:bg-gray-100 rounded-full">
              <Plus className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar conversaciones..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-skyblue focus:border-transparent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((conv) => (
            <div
              key={conv.id}
              className={`p-4 cursor-pointer hover:bg-gray-50 ${
                selectedChat === conv.id ? 'bg-skyblue bg-opacity-10' : ''
              }`}
              onClick={() => setSelectedChat(conv.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-skyblue rounded-full flex items-center justify-center text-white font-semibold">
                    {conv.sender_name?.charAt(0).toUpperCase() || conv.user_id.charAt(0).toUpperCase()}
                  </div>
                  <div className="ml-3">
                    <h3 className="font-medium text-gray-900">{conv.sender_name || conv.user_id}</h3>
                    <p className="text-sm text-gray-500">
                      {format(new Date(conv.last_message_time), 'HH:mm', { locale: es })}
                    </p>
                  </div>
                </div>
                <button className="p-1 hover:bg-gray-100 rounded-full">
                  <MoreVertical className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <p className="text-sm text-gray-600 truncate">{conv.last_message}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-skyblue rounded-full flex items-center justify-center text-white font-semibold">
                    {conversations.find(c => c.id === selectedChat)?.sender_name?.charAt(0).toUpperCase() || 
                     conversations.find(c => c.id === selectedChat)?.user_id.charAt(0).toUpperCase()}
                  </div>
                  <div className="ml-3">
                    <h3 className="font-medium text-gray-900">
                      {conversations.find(c => c.id === selectedChat)?.sender_name || 
                       conversations.find(c => c.id === selectedChat)?.user_id}
                    </h3>
                    <p className="text-sm text-gray-500">En línea</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={toggleBot}
                    className={`p-2 rounded-full ${
                      botActive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}
                  >
                    {botActive ? <Bot className="w-5 h-5" /> : <BotOff className="w-5 h-5" />}
                  </button>
                  <button className="p-2 hover:bg-gray-100 rounded-full">
                    <MoreVertical className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-background">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender_type === 'agent' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`message-bubble ${
                      message.sender_type === 'agent' ? 'user' : 'bot'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <div className="flex items-center justify-end mt-1 text-xs text-gray-500">
                      {format(new Date(message.created_at), 'HH:mm', { locale: es })}
                      {message.sender_type === 'agent' && message.read && (
                        <CheckCheck className="w-3 h-3 ml-1 text-skyblue" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="message-bubble bot">
                    <div className="typing-indicator">
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-center space-x-2">
                <button className="p-2 hover:bg-gray-100 rounded-full">
                  <Paperclip className="w-5 h-5 text-gray-400" />
                </button>
                <input
                  type="text"
                  placeholder="Escribe un mensaje..."
                  className="flex-1 p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-skyblue focus:border-transparent"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button
                  onClick={handleSendMessage}
                  className="p-2 bg-skyblue text-white rounded-full hover:bg-skyblue-dark transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-skyblue rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Selecciona una conversación
              </h3>
              <p className="text-gray-500">
                Elige una conversación del panel izquierdo para comenzar a chatear
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

