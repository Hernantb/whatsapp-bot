/**
 * Configuración global para la aplicación
 */

// Configuraciones principales para la aplicación

// URLs base para APIs
export const API_BASE_URL = 'http://localhost:3095'; // URL para el API del bot de WhatsApp
export const WHATSAPP_BOT_URL = 'http://localhost:3095'; // URL para el bot de WhatsApp

// Configuración para modo de datos
export const USE_MOCK_DATA = false; // Usar datos reales

// Configuración específica para WhatsApp
export const DISABLE_WHATSAPP_SIMULATION = true; // Deshabilitar simulación de envío a WhatsApp
export const SHOW_SIMULATION_WARNINGS = true; // Mostrar advertencias claras cuando los mensajes son simulados

// ID de negocio por defecto (usado como fallback)
export const DEFAULT_BUSINESS_ID = '2d385aa5-40e0-4ec9-9360-19281bc605e4';

// Exportar como configuración predeterminada
export default {
  // URLs
  API_BASE_URL,
  WHATSAPP_BOT_URL,
  
  // Otras configuraciones
  APP_NAME: 'Dashboard WhatsApp',
  VERSION: '1.0.0',
  USE_MOCK_DATA,
  DISABLE_WHATSAPP_SIMULATION,
  SHOW_SIMULATION_WARNINGS,
  DEFAULT_BUSINESS_ID
}; 