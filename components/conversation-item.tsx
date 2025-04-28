import { memo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { MoreVertical } from 'lucide-react'
import type { Conversation } from '@/lib/database'

interface ConversationItemProps {
  conversation: Conversation
  isSelected: boolean
  onSelect: (id: string) => void
}

function ConversationItem({ conversation, isSelected, onSelect }: ConversationItemProps) {
  return (
    <div
      className={`p-4 cursor-pointer hover:bg-gray-50 ${
        isSelected ? 'bg-skyblue bg-opacity-10' : ''
      }`}
      onClick={() => onSelect(conversation.id)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-skyblue rounded-full flex items-center justify-center text-white font-semibold">
            {conversation.user_id.charAt(0).toUpperCase()}
          </div>
          <div className="ml-3">
            <h3 className="font-medium text-gray-900">{conversation.user_id}</h3>
            <p className="text-sm text-gray-500">
              {format(new Date(conversation.last_message_time), 'HH:mm', { locale: es })}
            </p>
          </div>
        </div>
        <button className="p-1 hover:bg-gray-100 rounded-full">
          <MoreVertical className="w-4 h-4 text-gray-400" />
        </button>
      </div>
      <p className="text-sm text-gray-600 truncate">{conversation.last_message || ''}</p>
    </div>
  )
}

export default memo(ConversationItem) 