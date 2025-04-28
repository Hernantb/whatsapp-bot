import { getAllConversations, getConversationMessages, sendMessage, markConversationAsRead } from "../utils/chat-utils"

// Ejemplo de uso de los datos mock
const exampleUsage = () => {
  // Obtener todas las conversaciones
  const conversations = getAllConversations()
  console.log(`Total conversations: ${conversations.length}`)

  // Obtener la primera conversación
  const firstConversation = conversations[0]
  console.log(`Selected conversation: ${firstConversation.contactName}`)

  // Marcar como leída
  markConversationAsRead(firstConversation.id)
  console.log(`Marked conversation as read`)

  // Obtener mensajes de la conversación
  const messages = getConversationMessages(firstConversation.id)
  console.log(`Total messages: ${messages.length}`)

  // Enviar un nuevo mensaje
  const newMessage = sendMessage(firstConversation.id, "This is a test message")
  console.log(`New message sent: ${newMessage.id}`)

  // Enviar un mensaje con imagen
  const imageMessage = sendMessage(firstConversation.id, "Check out this photo!", "image", [
    {
      id: "att-new-1",
      type: "image",
      url: "/placeholder.svg?height=800&width=600&text=New_Image",
      name: "new_image.jpg",
      size: 1500000,
      mimeType: "image/jpeg",
      thumbnailUrl: "/placeholder.svg?height=200&width=150&text=New_Image",
      width: 800,
      height: 600,
    },
  ])
  console.log(`Image message sent: ${imageMessage.id}`)

  return {
    conversations,
    selectedConversation: firstConversation,
    messages,
    newMessage,
    imageMessage,
  }
}

export default exampleUsage

