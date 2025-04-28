import { memo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Message } from '@/lib/database'

interface MessageItemProps {
  message: Message
  isCurrentUser: boolean
}

function MessageItem({ message, isCurrentUser }: MessageItemProps) {
  return (
    <div
      className={`flex ${
        isCurrentUser ? 'justify-end' : 'justify-start'
      }`}
    >
      <div
        className={`message-bubble ${
          isCurrentUser ? 'user' : 'bot'
        }`}
      >
        <p className="text-sm">{message.content}</p>
        <div className="flex items-center justify-end mt-1 text-xs text-gray-500">
          {format(new Date(message.created_at), 'HH:mm', { locale: es })}
        </div>
      </div>
    </div>
  )
}

export default memo(MessageItem, (prevProps, nextProps) => {
  return prevProps.message.id === nextProps.message.id &&
         prevProps.isCurrentUser === nextProps.isCurrentUser
}) 