#!/usr/bin/env node
/**
 * Script para probar el webhook con una petición POST simulada
 * 
 * Este script envía una petición al webhook con un formato similar al que 
 * recibiría de GupShup o cualquier otro proveedor de WhatsApp.
 */

const axios = require('axios');
require('dotenv').config();

// Configuración para la prueba
const WEBHOOK_URL = 'http://localhost:3095/webhook'; // Para pruebas locales
// const WEBHOOK_URL = 'https://whatsapp-bot-if6z.onrender.com/webhook'; // Para producción

const phoneNumber = process.argv[2] || '5491123456789';
const message = process.argv[3] || 'Hola, esto es un mensaje de prueba';

console.log(`🚀 Iniciando prueba de webhook con:`);
console.log(`- URL: ${WEBHOOK_URL}`);
console.log(`- Teléfono: ${phoneNumber}`);
console.log(`- Mensaje: "${message}"`);

// Crear una estructura simulando la petición real
const payload = {
  type: 'message',
  app: 'WhatsApp',
  timestamp: new Date().getTime(),
  messageId: `test_${Date.now()}`,
  payload: {
    id: `msg_${Date.now()}`,
    source: process.env.GUPSHUP_NUMBER || '15557033313',
    type: 'text',
    payload: {
      text: message
    },
    sender: {
      phone: phoneNumber,
      name: 'Usuario de Prueba'
    }
  }
};

// Enviar la petición POST
async function testWebhook() {
  try {
    console.log('📤 Enviando petición al webhook...');
    const response = await axios.post(WEBHOOK_URL, payload);
    
    console.log('✅ Respuesta recibida:');
    console.log(`- Código: ${response.status}`);
    console.log(`- Datos: ${JSON.stringify(response.data)}`);
    console.log('\n📱 Revisa los logs del servidor para ver si la respuesta fue enviada correctamente.');
  } catch (error) {
    console.error('❌ Error:');
    
    if (error.response) {
      console.error(`- Código: ${error.response.status}`);
      console.error(`- Datos: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`- Mensaje: ${error.message}`);
    }
  }
}

// Ejecutar la prueba
testWebhook(); 