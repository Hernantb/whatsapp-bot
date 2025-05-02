/**
 * Configuración global para la aplicación
 */

// Importar librería de configuración
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Configuraciones principales para la aplicación

// URLs base para APIs
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7777';
export const WHATSAPP_BOT_URL = 'https://whatsapp-bot-if6z.onrender.com'; // Cambiado a URL de producción
export const DEFAULT_BUSINESS_ID = process.env.NEXT_PUBLIC_DEFAULT_BUSINESS_ID || '2d385aa5-40e0-4ec9-9360-19281bc605e4';
export const BOT_API_BASE_URL = WHATSAPP_BOT_URL;

// Configuración para modo de datos
export const USE_MOCK_DATA = false; // Usar datos reales

// Configuración específica para WhatsApp
export const DISABLE_WHATSAPP_SIMULATION = true; // Deshabilitar simulación de envío a WhatsApp
export const SHOW_SIMULATION_WARNINGS = true; // Mostrar advertencias claras cuando los mensajes son simulados

// Exportar como objeto por defecto para facilitar importación
export default {
  API_BASE_URL,
  BOT_API_BASE_URL,
  DEFAULT_BUSINESS_ID,
  WHATSAPP_BOT_URL,
  
  // Configuraciones para análisis
  shouldCaptureAnalytics: true,
  
  // Configuraciones para el panel
  defaultDashboardTab: 'all',
  
  // Otras configuraciones
  APP_NAME: 'Dashboard WhatsApp',
  VERSION: '1.0.0',
  USE_MOCK_DATA,
  DISABLE_WHATSAPP_SIMULATION,
  SHOW_SIMULATION_WARNINGS
}; 