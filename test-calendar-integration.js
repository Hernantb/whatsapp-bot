/**
 * Script para probar la integración con Google Calendar
 * 
 * Este script prueba las funciones de consulta de disponibilidad y creación de eventos
 * directamente, sin pasar por el flujo completo de OpenAI.
 */

require('dotenv').config();
const { checkCalendarAvailability, createCalendarEvent } = require('./calendar-functions');

// ID del negocio para pruebas
const BUSINESS_ID = process.env.TEST_BUSINESS_ID || '2d385aa5-40e0-4ec9-9360-19281bc605e4';

// Obtener la fecha de hoy y mañana en formato ISO
const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

const todayStr = today.toISOString().split('T')[0];
const tomorrowStr = tomorrow.toISOString().split('T')[0];

// Función principal de prueba
async function runCalendarTests() {
  console.log('🧪 Iniciando pruebas de integración con Google Calendar...');
  console.log('📅 Fecha de hoy:', todayStr);
  console.log('📅 Fecha de mañana:', tomorrowStr);
  console.log('🏢 ID de negocio para pruebas:', BUSINESS_ID);

  try {
    // 1. Probar consulta de disponibilidad para hoy
    console.log('\n📋 PRUEBA 1: Consultar disponibilidad para hoy');
    const availabilityToday = await checkCalendarAvailability(BUSINESS_ID, { date: todayStr });
    console.log('Resultado:', JSON.stringify(availabilityToday, null, 2));

    // 2. Probar consulta de disponibilidad para mañana
    console.log('\n📋 PRUEBA 2: Consultar disponibilidad para mañana');
    const availabilityTomorrow = await checkCalendarAvailability(BUSINESS_ID, { date: tomorrowStr });
    console.log('Resultado:', JSON.stringify(availabilityTomorrow, null, 2));

    // 3. Probar creación de evento (solo si hay horarios disponibles)
    if (availabilityTomorrow.success && availabilityTomorrow.available_slots.length > 0) {
      const slot = availabilityTomorrow.available_slots[0];
      console.log('\n📋 PRUEBA 3: Crear evento para mañana en horario:', slot.formatted);
      
      const eventData = {
        title: 'Cita de prueba desde API',
        description: 'Esta es una cita creada desde el script de prueba',
        start: slot.start,
        end: slot.end,
        attendees: [{ email: 'test@example.com' }]
      };
      
      const createResult = await createCalendarEvent(BUSINESS_ID, eventData);
      console.log('Resultado:', JSON.stringify(createResult, null, 2));
    } else {
      console.log('\n❌ PRUEBA 3: No se pudo realizar porque no hay horarios disponibles para mañana');
    }

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error);
  }
}

// Ejecutar pruebas
console.log('✅ Funciones de calendario extraídas para pruebas');
runCalendarTests().catch(err => {
  console.error('❌ Error en el script de prueba:', err);
}); 