// Script para corregir manualmente el código del bot de WhatsApp
const fs = require('fs');
const path = require('path');

// Función principal de corrección
async function fixWhatsAppBot() {
  console.log('🔧 Iniciando corrección manual del bot WhatsApp...');
  
  // 1. Primero, asegurarse de que el módulo sendTextMessageGupShup.js está correcto
  const moduleContent = `// Función para enviar mensajes de texto usando GupShup
const axios = require('axios');
require('dotenv').config();

async function sendTextMessageGupShup(phoneNumber, message) {
  try {
    const apiKey = process.env.GUPSHUP_API_KEY;
    const source = process.env.GUPSHUP_SOURCE_PHONE;
    
    if (!apiKey || !source) {
      throw new Error('Faltan credenciales de GupShup en variables de entorno');
    }
    
    const url = 'https://api.gupshup.io/sm/api/v1/msg';
    
    const data = new URLSearchParams();
    data.append('channel', 'whatsapp');
    data.append('source', source);
    data.append('destination', phoneNumber);
    data.append('message', JSON.stringify({
      type: 'text',
      text: message
    }));
    data.append('src.name', process.env.GUPSHUP_APP_NAME || 'WhatsBotApp');
    
    const config = {
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded',
        'apikey': apiKey
      }
    };
    
    const response = await axios.post(url, data, config);
    console.log(\`✅ Mensaje enviado a \${phoneNumber}: \${message.substring(0, 30)}...\`);
    return response.data;
  } catch (error) {
    console.error(\`❌ Error enviando mensaje a \${phoneNumber}:\`, error.message);
    throw error;
  }
}

module.exports = { sendTextMessageGupShup };`;

  fs.writeFileSync(path.join(__dirname, 'sendTextMessageGupShup.js'), moduleContent);
  console.log('✅ Archivo sendTextMessageGupShup.js creado/actualizado correctamente');
  
  // 2. Crear un endpoint para enviar mensajes manuales que no dependa del código con errores
  const manualEndpointContent = `// Endpoint para envío manual de mensajes a WhatsApp
const express = require('express');
const cors = require('cors');
const { sendTextMessageGupShup } = require('./sendTextMessageGupShup');

// Crear la aplicación Express
const app = express();
const PORT = process.env.PORT || 3095;

// Middleware
app.use(cors());
app.use(express.json());

// Ruta de health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'WhatsApp service is running' });
});

// Endpoint para enviar mensajes manualmente
app.post('/api/send-manual-message', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere phoneNumber' 
      });
    }
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere message' 
      });
    }
    
    console.log(\`📨 Solicitud para enviar mensaje manual a \${phoneNumber}: "\${message.substring(0, 30)}\${message.length > 30 ? '...' : ''}"\`);
    
    // Usar la función corregida para enviar el mensaje
    const response = await sendTextMessageGupShup(phoneNumber, message);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Mensaje enviado correctamente',
      data: response
    });
  } catch (error) {
    console.error('❌ Error al enviar mensaje manual:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Error al enviar mensaje'
    });
  }
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(\`🚀 Servidor de WhatsApp corriendo en puerto \${PORT}\`);
});`;

  fs.writeFileSync(path.join(__dirname, 'manual-endpoint.js'), manualEndpointContent);
  console.log('✅ Archivo manual-endpoint.js creado correctamente');
  
  console.log('\n✅ Corrección manual completada.');
  console.log('Para usar este servidor corregido en lugar del original, ejecuta:');
  console.log('PORT=3095 node manual-endpoint.js');
  console.log('\nEste servidor implementa los mismos endpoints que el original pero sin los errores.');
}

// Ejecutar la función principal
fixWhatsAppBot().catch(error => {
  console.error('❌ Error al corregir el bot de WhatsApp:', error);
  process.exit(1);
}); 