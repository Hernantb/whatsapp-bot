import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { Message } from '@/lib/supabase'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '@/hooks/useAuth'
import { 
  Send, 
  Paperclip, 
  MoreVertical, 
  Search, 
  Plus, 
  Bot, 
  BotOff,
  Trash2,
  Settings,
  Star,
  StarOff,
  Phone,
  Mail,
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  Loader2,
  LogOut
} from 'lucide-react'

interface ChatControlPanelProps {
  userId: string
  userEmail: string
}

export default function ChatControlPanel({ userId, userEmail }: ChatControlPanelProps) {
  const { signOut } = useAuth()
  const [selectedChat, setSelectedChat] = useState<string | null>(null)
  const [botActive, setBotActive] = useState(true)
  const [conversations, setConversations] = useState<Message[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Conversaciones</h2>
            <div className="flex items-center space-x-2">
              <button className="p-2 hover:bg-gray-100 rounded-full">
                <Plus className="w-5 h-5 text-gray-600" />
              </button>
              <button 
                onClick={signOut}
                className="p-2 hover:bg-gray-100 rounded-full text-red-600"
                title="Cerrar sesión"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
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
      </div>
    </div>
  )
} 