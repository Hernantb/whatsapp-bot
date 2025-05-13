import type { Message, MessageType } from "../types/chat"
import { v4 as uuidv4 } from "uuid"

// Función para generar URLs de medios
const getMediaUrl = (type: string, id: string) => {
  switch (type) {
    case "image":
      return `/placeholder.svg?height=600&width=800&text=Image_${id}`
    case "document":
      return `/api/documents/${id}`
    case "audio":
      return `/api/audio/${id}`
    case "location":
      return `/placeholder.svg?height=400&width=400&text=Location_${id}`
    default:
      return ""
  }
}

// Generar mensajes para un contacto específico
export const getMessagesForContact = (contactNumber: string, businessId: string): Message[] => {
  const messages: Message[] = []
  const now = new Date()
  const messageCount = Math.floor(Math.random() * 15) + 10 // Entre 10 y 25 mensajes

  // Extraer el nombre del contacto del número (simulado)
  const contactName = contactNumber.replace("+549", "Contact_")

  for (let i = 0; i < messageCount; i++) {
    const id = uuidv4()
    const isReceived = i % 2 === 0 // Alternar entre mensajes recibidos y enviados
    const minutesAgo = (messageCount - i) * 15 // Espaciar los mensajes cada 15 minutos
    const timestamp = new Date(now.getTime() - minutesAgo * 60000).toISOString()

    // Determinar el tipo de mensaje (mayormente texto, pero algunos medios)
    let messageType: MessageType = "text"
    let mediaUrl = ""

    if (i % 7 === 0) {
      messageType = "image"
      mediaUrl = getMediaUrl("image", id)
    } else if (i % 11 === 0) {
      messageType = "document"
      mediaUrl = getMediaUrl("document", id)
    } else if (i % 13 === 0) {
      messageType = "audio"
      mediaUrl = getMediaUrl("audio", id)
    } else if (i % 17 === 0) {
      messageType = "location"
      mediaUrl = getMediaUrl("location", id)
    }

    // Crear el mensaje
    const message: Message = {
      id,
      user_id: isReceived ? contactNumber : "business-user-id",
      message: getMessageContent(messageType, i),
      message_type: messageType,
      status: isReceived ? "received" : "sent",
      last_message_time: timestamp,
      created_at: timestamp,
      business_id: isReceived ? null : businessId,
      is_bot_active: i % 5 === 0, // Algunos mensajes son del bot
      is_read: isReceived ? i < messageCount - 3 : true,
      media_url: mediaUrl,
      contact_name: isReceived ? contactName : "Business",
    }

    messages.push(message)
  }

  return messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
}

// Función para generar contenido de mensaje según el tipo
const getMessageContent = (type: MessageType, index: number): string => {
  switch (type) {
    case "text":
      return getTextMessage(index)
    case "image":
      return "Imagen adjunta"
    case "document":
      return "Documento adjunto: Presupuesto.pdf"
    case "audio":
      return "Mensaje de voz (0:32)"
    case "location":
      return "Ubicación compartida"
    case "contact":
      return "Contacto compartido"
    case "template":
      return "Mensaje de plantilla"
    default:
      return "Mensaje"
  }
}

// Mensajes de texto típicos de WhatsApp Business
const getTextMessage = (index: number): string => {
  const businessMessages = [
    "Hola, gracias por contactarnos. ¿En qué podemos ayudarte?",
    "Nuestro horario de atención es de lunes a viernes de 9 a 18 hs.",
    "Te envío el catálogo de servicios actualizado.",
    "Podemos agendar una reunión para discutir los detalles.",
    "El presupuesto tiene una validez de 15 días.",
    "Gracias por tu consulta. En breve te responderemos.",
    "Para más información, puedes visitar nuestra web: www.ejemplo.com",
    "Te confirmo que recibimos tu solicitud.",
    "¿Necesitas alguna información adicional?",
    "Lamentamos los inconvenientes. Estamos trabajando para solucionarlo.",
    "Tu pedido ha sido procesado correctamente.",
    "Te recordamos tu cita para mañana a las 10:00 hs.",
    "Hemos actualizado nuestras políticas de servicio.",
    "Felicitaciones por tu compra. Aquí están los detalles.",
    "Estamos procesando tu solicitud. Te mantendremos informado.",
  ]

  const customerMessages = [
    "Hola, quisiera información sobre sus servicios.",
    "¿Cuál es el precio del servicio de consultoría?",
    "Necesito agendar una reunión para la próxima semana.",
    "Gracias por la información. Lo revisaré.",
    "¿Tienen disponibilidad para el jueves?",
    "Confirmo asistencia a la reunión.",
    "¿Podrían enviarme un presupuesto detallado?",
    "Tengo una consulta sobre el último presupuesto.",
    "¿Aceptan transferencias bancarias?",
    "Necesito reprogramar nuestra reunión.",
    "¿Cuál es el tiempo estimado de entrega?",
    "Perfecto, muchas gracias por su atención.",
    "¿Me podrían dar más detalles sobre ese servicio?",
    "Disculpe la demora en responder.",
    "Estoy interesado en contratar sus servicios.",
  ]

  // Alternar entre mensajes de negocio y cliente
  const messageList = index % 2 === 0 ? customerMessages : businessMessages
  return messageList[index % messageList.length]
}

// Generar todos los mensajes para todas las conversaciones
export const mockMessages: Message[] = []

// Función para obtener mensajes de una conversación específica
export const getMessagesForConversation = (contactNumber: string, businessId: string): Message[] => {
  return getMessagesForContact(contactNumber, businessId)
}

