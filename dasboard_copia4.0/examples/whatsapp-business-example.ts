import {
  getFilteredConversations,
  getConversationMessages,
  sendMessage,
  receiveMessage,
  markConversationAsRead,
  getMessageStats,
  getBusinessById,
  toggleBotStatus,
} from "../utils/chat-utils"

// ID del negocio de Hernán
const BUSINESS_ID = "2d385aa5-40e0-4ec9-9360-19281bc605e4"

// Ejemplo de uso de los datos mock
const exampleUsage = () => {
  // Obtener información del negocio
  const business = getBusinessById(BUSINESS_ID)
  console.log(`Negocio: ${business?.name}`)

  // Obtener todas las conversaciones
  const conversations = getFilteredConversations(BUSINESS_ID)
  console.log(`Total conversaciones: ${conversations.length}`)

  // Obtener conversaciones no leídas
  const unreadConversations = getFilteredConversations(BUSINESS_ID, "", "unread")
  console.log(`Conversaciones no leídas: ${unreadConversations.length}`)

  // Obtener la primera conversación
  const firstConversation = conversations[0]
  console.log(`Conversación seleccionada: ${firstConversation.contact_name}`)

  // Marcar como leída
  markConversationAsRead(firstConversation.contact_number, BUSINESS_ID)
  console.log(`Conversación marcada como leída`)

  // Obtener mensajes de la conversación
  const messages = getConversationMessages(firstConversation.contact_number, BUSINESS_ID)
  console.log(`Total mensajes: ${messages.length}`)

  // Enviar un nuevo mensaje
  const newMessage = sendMessage(
    firstConversation.contact_number,
    BUSINESS_ID,
    "Gracias por contactarnos. ¿En qué podemos ayudarte?",
  )
  console.log(`Nuevo mensaje enviado: ${newMessage.id}`)

  // Recibir un nuevo mensaje
  const receivedMessage = receiveMessage(
    firstConversation.contact_number,
    BUSINESS_ID,
    "Quisiera agendar una reunión para la próxima semana",
  )
  console.log(`Mensaje recibido: ${receivedMessage.id}`)

  // Activar el bot para el negocio
  toggleBotStatus(BUSINESS_ID, true)
  console.log(`Bot activado para el negocio`)

  // Obtener estadísticas de mensajes
  const stats = getMessageStats(BUSINESS_ID)
  console.log(`Estadísticas: ${JSON.stringify(stats)}`)

  return {
    business,
    conversations,
    selectedConversation: firstConversation,
    messages,
    newMessage,
    receivedMessage,
    stats,
  }
}

export default exampleUsage

