/**
 * Configuración global para la aplicación
 */

// Configuraciones principales para la aplicación

// URL base para las APIs del servidor principal
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:7777';

// URL del servicio de WhatsApp 
export const WHATSAPP_BOT_URL = process.env.NEXT_PUBLIC_WHATSAPP_BOT_URL || 'http://localhost:3095';

// URL base para las APIs del servidor donde está el bot (podría ser el mismo que API_BASE_URL)
export const BOT_API_BASE_URL = WHATSAPP_BOT_URL;

// ID del negocio por defecto (solo para desarrollo)
export const DEFAULT_BUSINESS_ID = "2d385aa5-40e0-4ec9-9360-19281bc605e4";

// Exportar como configuración predeterminada
export default {
  // URLs
  API_BASE_URL,
  WHATSAPP_BOT_URL,
  BOT_API_BASE_URL,
  
  // Otras configuraciones
  APP_NAME: 'Dashboard WhatsApp',
  VERSION: '1.0.0',
  DEFAULT_BUSINESS_ID,
}; 