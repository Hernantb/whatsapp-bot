import type { Business, Conversation } from "../types/chat"
import { getMessagesForContact } from "./messages"

// Negocio de Hernán
export const mockBusinesses: Business[] = [
  {
    id: "2d385aa5-40e0-4ec9-9360-19281bc605e4",
    name: "Hernán Consulting",
    whatsapp_number: "+5491123456789",
    profile_image: "/placeholder.svg?height=200&width=200&text=HC",
    description: "Servicios de consultoría empresarial",
    industry: "Consultoría",
    created_at: "2023-01-15T10:30:00Z",
  },
  {
    id: "7a9e8d6c-5b4f-3e2d-1c0b-9a8b7c6d5e4f",
    name: "Marketing Digital Pro",
    whatsapp_number: "+5491187654321",
    profile_image: "/placeholder.svg?height=200&width=200&text=MDP",
    description: "Servicios de marketing digital",
    industry: "Marketing",
    created_at: "2023-03-20T14:45:00Z",
  },
]

// Función para generar URLs de avatar aleatorios pero consistentes
const getAvatarUrl = (name: string, size = 200) => {
  // Usamos una URL de placeholder que genera avatares basados en iniciales
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  return `/placeholder.svg?height=${size}&width=${size}&text=${initials}`
}

// Conversaciones para el negocio de Hernán
export const mockConversations: Conversation[] = [
  {
    contact_name: "Carlos Rodríguez",
    contact_number: "+5491145678901",
    last_message: "¿Podemos agendar una reunión para el jueves?",
    last_message_time: new Date(Date.now() - 15 * 60000).toISOString(), // 15 minutos atrás
    unread_count: 3,
    business_id: "2d385aa5-40e0-4ec9-9360-19281bc605e4",
    profile_picture: getAvatarUrl("Carlos Rodríguez"),
    messages: [],
  },
  {
    contact_name: "María González",
    contact_number: "+5491156789012",
    last_message: "Gracias por la información. Lo revisaré y te contacto.",
    last_message_time: new Date(Date.now() - 2 * 3600000).toISOString(), // 2 horas atrás
    unread_count: 0,
    business_id: "2d385aa5-40e0-4ec9-9360-19281bc605e4",
    profile_picture: getAvatarUrl("María González"),
    messages: [],
  },
  {
    contact_name: "Juan Pérez",
    contact_number: "+5491167890123",
    last_message: "Te envío el presupuesto actualizado",
    last_message_time: new Date(Date.now() - 1 * 86400000).toISOString(), // 1 día atrás
    unread_count: 0,
    business_id: "2d385aa5-40e0-4ec9-9360-19281bc605e4",
    profile_picture: getAvatarUrl("Juan Pérez"),
    messages: [],
  },
  {
    contact_name: "Laura Martínez",
    contact_number: "+5491178901234",
    last_message: "¿Tienen disponibilidad para la próxima semana?",
    last_message_time: new Date(Date.now() - 5 * 3600000).toISOString(), // 5 horas atrás
    unread_count: 2,
    business_id: "2d385aa5-40e0-4ec9-9360-19281bc605e4",
    profile_picture: getAvatarUrl("Laura Martínez"),
    messages: [],
  },
  {
    contact_name: "Alejandro Gómez",
    contact_number: "+5491189012345",
    last_message: "Hola, quisiera información sobre sus servicios",
    last_message_time: new Date(Date.now() - 12 * 3600000).toISOString(), // 12 horas atrás
    unread_count: 1,
    business_id: "2d385aa5-40e0-4ec9-9360-19281bc605e4",
    profile_picture: getAvatarUrl("Alejandro Gómez"),
    messages: [],
  },
  {
    contact_name: "Sofía López",
    contact_number: "+5491190123456",
    last_message: "Perfecto, muchas gracias por su atención",
    last_message_time: new Date(Date.now() - 3 * 86400000).toISOString(), // 3 días atrás
    unread_count: 0,
    business_id: "2d385aa5-40e0-4ec9-9360-19281bc605e4",
    profile_picture: getAvatarUrl("Sofía López"),
    messages: [],
  },
  {
    contact_name: "Diego Fernández",
    contact_number: "+5491101234567",
    last_message: "Necesito reprogramar nuestra reunión",
    last_message_time: new Date(Date.now() - 4 * 86400000).toISOString(), // 4 días atrás
    unread_count: 0,
    business_id: "2d385aa5-40e0-4ec9-9360-19281bc605e4",
    profile_picture: getAvatarUrl("Diego Fernández"),
    messages: [],
  },
  {
    contact_name: "Valentina Torres",
    contact_number: "+5491112345678",
    last_message: "¿Cuál es el horario de atención?",
    last_message_time: new Date(Date.now() - 6 * 3600000).toISOString(), // 6 horas atrás
    unread_count: 0,
    business_id: "2d385aa5-40e0-4ec9-9360-19281bc605e4",
    profile_picture: getAvatarUrl("Valentina Torres"),
    messages: [],
  },
  {
    contact_name: "Martín Sánchez",
    contact_number: "+5491123456789",
    last_message: "Confirmo asistencia a la reunión del lunes",
    last_message_time: new Date(Date.now() - 1 * 86400000).toISOString(), // 1 día atrás
    unread_count: 0,
    business_id: "2d385aa5-40e0-4ec9-9360-19281bc605e4",
    profile_picture: getAvatarUrl("Martín Sánchez"),
    messages: [],
  },
  {
    contact_name: "Lucía Ramírez",
    contact_number: "+5491134567890",
    last_message: "Hola, ¿podrían enviarme más información?",
    last_message_time: new Date(Date.now() - 7 * 86400000).toISOString(), // 7 días atrás
    unread_count: 0,
    business_id: "2d385aa5-40e0-4ec9-9360-19281bc605e4",
    profile_picture: getAvatarUrl("Lucía Ramírez"),
    messages: [],
  },
]

// Inicializar las conversaciones con sus mensajes
export const initializeConversations = () => {
  mockConversations.forEach((conversation) => {
    conversation.messages = getMessagesForContact(conversation.contact_number, conversation.business_id)
  })
  return mockConversations
}

// Obtener una conversación por número de contacto
export const getConversationByContactNumber = (contactNumber: string): Conversation | undefined => {
  return mockConversations.find((conv) => conv.contact_number === contactNumber)
}

// Obtener conversaciones por business_id
export const getConversationsByBusinessId = (businessId: string): Conversation[] => {
  return mockConversations.filter((conv) => conv.business_id === businessId)
}

