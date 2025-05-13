/**
 * Funciones extraídas de openai-processor.js para pruebas
 */

const axios = require('axios');

/**
 * Consulta la disponibilidad del calendario para una fecha o rango de fechas específico
 * @param {string} business_id ID del negocio
 * @param {Object} params Parámetros de consulta (date, start_date, end_date, timeMin, timeMax)
 * @returns {Promise<Object>} Resultado de la consulta
 */
async function checkCalendarAvailability(business_id, params) {
  try {
    console.log(`📅 Consultando disponibilidad de calendario para negocio ${business_id}`);
    
    // Usamos nuestro endpoint existente para consultar disponibilidad
    const apiUrl = process.env.API_BASE_URL || 'http://localhost:3001'; 
    const url = `${apiUrl}/api/calendar/availability`;
    
    const requestData = {
      business_id,
      ...params
    };
    
    console.log(`📤 Enviando solicitud a ${url}:`, requestData);
    
    const response = await axios.post(url, requestData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📥 Respuesta recibida:`, response.data);
    
    // Formatear la respuesta para que sea más fácil de procesar por el asistente
    if (response.data.success) {
      const events = response.data.events || [];
      
      // Obtener horas disponibles (ejemplo básico: considerar disponibles las horas de 9 AM a 6 PM que no tengan eventos)
      const availableSlots = calculateAvailableSlots(
        params.date || (params.timeMin ? new Date(params.timeMin).toISOString().split('T')[0] : null),
        events
      );
      
      return {
        success: true,
        date: params.date || new Date(params.timeMin || params.start_date).toISOString().split('T')[0],
        events_count: events.length,
        events: events.map(e => ({
          summary: e.summary,
          start: e.start.dateTime,
          end: e.end.dateTime
        })),
        available_slots: availableSlots,
        is_mock_data: response.data.is_mock_data || false
      };
    } else {
      return {
        success: false,
        error: response.data.error || "Error al consultar disponibilidad"
      };
    }
  } catch (error) {
    console.error(`❌ Error consultando disponibilidad:`, error);
    return {
      success: false,
      error: error.message || "Error desconocido al consultar disponibilidad"
    };
  }
}

/**
 * Calcula franjas horarias disponibles para un día específico
 * @param {string} date Fecha en formato YYYY-MM-DD
 * @param {Array} events Lista de eventos existentes
 * @returns {Array} Lista de franjas horarias disponibles
 */
function calculateAvailableSlots(date, events) {
  if (!date) return [];
  
  const workHourStart = 9; // 9 AM
  const workHourEnd = 18;  // 6 PM
  const slotDuration = 60; // 60 minutos (1 hora)
  
  // Crear un mapa de horas ocupadas
  const busySlots = new Set();
  
  // Filtrar eventos solo para esta fecha
  const dateStr = date.split('T')[0]; // Asegurar formato YYYY-MM-DD
  const dayEvents = events.filter(event => {
    const eventDate = new Date(event.start.dateTime).toISOString().split('T')[0];
    return eventDate === dateStr;
  });
  
  // Marcar horas ocupadas
  dayEvents.forEach(event => {
    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);
    
    // Redondear a la hora más cercana para simplificar
    const startHour = Math.max(workHourStart, start.getHours());
    const endHour = Math.min(workHourEnd, Math.ceil(end.getHours() + (end.getMinutes() > 0 ? 1 : 0)));
    
    // Marcar todas las horas de este evento como ocupadas
    for (let hour = startHour; hour < endHour; hour++) {
      busySlots.add(hour);
    }
  });
  
  // Generar horas disponibles
  const availableSlots = [];
  for (let hour = workHourStart; hour < workHourEnd; hour++) {
    if (!busySlots.has(hour)) {
      const startTime = `${hour.toString().padStart(2, '0')}:00`;
      const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;
      
      availableSlots.push({
        start: `${dateStr}T${startTime}:00`,
        end: `${dateStr}T${endTime}:00`,
        formatted: `${startTime} - ${endTime}`
      });
    }
  }
  
  return availableSlots;
}

/**
 * Crea un evento en el calendario
 * @param {string} business_id ID del negocio
 * @param {Object} eventData Datos del evento a crear
 * @returns {Promise<Object>} Resultado de la creación
 */
async function createCalendarEvent(business_id, eventData) {
  try {
    console.log(`📅 Creando evento en calendario para negocio ${business_id}`);
    
    // Usamos nuestro endpoint existente para crear eventos
    const apiUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    const url = `${apiUrl}/api/calendar/events`;
    
    // Preparar datos del evento
    const event = {
      title: eventData.title,
      description: eventData.description || `Cita programada vía WhatsApp`,
      start: eventData.start,
      end: eventData.end,
      location: eventData.location || "",
      attendees: eventData.attendees || []
    };
    
    // Si el evento no incluye la información del cliente, intentamos extraerla del título o descripción
    if (!event.attendees || event.attendees.length === 0) {
      // Intentar extraer un correo del texto (muy básico)
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const foundEmails = (event.description || "").match(emailRegex) || [];
      
      if (foundEmails.length > 0) {
        event.attendees = foundEmails.map(email => ({ email }));
      }
    }
    
    const requestData = {
      business_id,
      event
    };
    
    console.log(`📤 Enviando solicitud a ${url}:`, requestData);
    
    const response = await axios.post(url, requestData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📥 Respuesta recibida:`, response.data);
    
    if (response.data.success) {
      return {
        success: true,
        event_id: response.data.event.id,
        event_link: response.data.event.htmlLink,
        summary: response.data.event.summary,
        message: "Evento creado exitosamente"
      };
    } else {
      return {
        success: false,
        error: response.data.error || "Error al crear evento"
      };
    }
  } catch (error) {
    console.error(`❌ Error creando evento:`, error);
    return {
      success: false,
      error: error.message || "Error desconocido al crear evento"
    };
  }
}

module.exports = {
  checkCalendarAvailability,
  calculateAvailableSlots,
  createCalendarEvent
};
  