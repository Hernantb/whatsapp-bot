#!/usr/bin/env node
/**
 * Script para probar el webhook con una petición POST simulada
 * 
 * Este script envía una petición al webhook con un formato similar al que 
 * recibiría de GupShup o la API oficial de WhatsApp Business.
 */

const axios = require('axios');
require('dotenv').config();

// Configuración para la prueba
const WEBHOOK_URL = 'http://localhost:3095/webhook'; // Para pruebas locales
// const WEBHOOK_URL = 'https://whatsapp-bot-if6z.onrender.com/webhook'; // Para producción

const phoneNumber = process.argv[2] || '5491123456789';
const message = process.argv[3] || 'Hola, esto es un mensaje de prueba';
const format = process.argv[4] || 'whatsapp'; // Opciones: 'gupshup' o 'whatsapp'

console.log(`🚀 Iniciando prueba de webhook con:`);
console.log(`- URL: ${WEBHOOK_URL}`);
console.log(`- Teléfono: ${phoneNumber}`);
console.log(`- Mensaje: "${message}"`);
console.log(`- Formato: ${format}`);

// Crear payload según el formato solicitado
let payload;

if (format === 'gupshup') {
  // Formato GupShup
  payload = {
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
} else {
  // Formato WhatsApp Business API oficial
  payload = {
    "object": "whatsapp_business_account",
    "entry": [
      {
        "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
        "changes": [
          {
            "field": "messages",
            "value": {
              "messaging_product": "whatsapp",
              "metadata": {
                "display_phone_number": process.env.GUPSHUP_NUMBER || "15557033313",
                "phone_number_id": "PHONE_NUMBER_ID"
              },
              "contacts": [
                {
                  "profile": {
                    "name": "Usuario de Prueba"
                  },
                  "wa_id": phoneNumber
                }
              ],
              "messages": [
                {
                  "from": phoneNumber,
                  "id": `wamid.${Date.now()}`,
                  "timestamp": Math.floor(Date.now() / 1000).toString(),
                  "type": "text",
                  "text": {
                    "body": message
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  };
}

// Enviar la petición POST
async function testWebhook() {
  try {
    console.log('📤 Enviando petición al webhook...');
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
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