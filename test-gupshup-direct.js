require('dotenv').config();
const axios = require('axios');

// Configuración y credenciales (obtenidas de .env)
const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
const GUPSHUP_NUMBER = process.env.GUPSHUP_NUMBER;
const GUPSHUP_USERID = process.env.GUPSHUP_USERID;

// Número de teléfono de destino para la prueba
const TEST_PHONE = '5212221192568'; // Reemplaza con el número que estás usando para pruebas

// Función para enviar un mensaje de texto usando formato simple
async function sendSimpleTextMessage() {
  console.log('🔄 Intentando enviar mensaje de texto simple...');
  
  // URL para la API de GupShup en el formato antiguo
  const url = 'https://api.gupshup.io/sm/api/v1/msg';
  
  // Crear los datos del formulario
  const formData = new URLSearchParams();
  formData.append('channel', 'whatsapp');
  formData.append('source', GUPSHUP_NUMBER);
  formData.append('destination', TEST_PHONE);
  formData.append('message', 'Prueba de mensaje directo desde script test-gupshup-direct.js - ' + new Date().toISOString());
  formData.append('disablePreview', 'false');
  
  // Configuración de la solicitud
  const config = {
    headers: {
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/x-www-form-urlencoded',
      'apikey': GUPSHUP_API_KEY,
      'userid': GUPSHUP_USERID,
      'Accept': 'application/json'
    }
  };
  
  try {
    console.log('📡 Enviando solicitud a URL:', url);
    console.log('📱 Número de destino:', TEST_PHONE);
    console.log('🔑 Usando apikey:', GUPSHUP_API_KEY.substring(0, 8) + '...');
    console.log('👤 Usando userid:', GUPSHUP_USERID);
    
    const response = await axios.post(url, formData, config);
    
    console.log('✅ Respuesta:', response.status);
    console.log('📄 Datos:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('❌ Error al enviar mensaje simple:', error.message);
    if (error.response) {
      console.error('📄 Datos de error:', JSON.stringify(error.response.data, null, 2));
    }
    return { success: false, error: error.message };
  }
}

// Función para enviar un mensaje de texto usando formato JSON (v2)
async function sendJsonTextMessage() {
  console.log('\n🔄 Intentando enviar mensaje de texto con formato JSON...');
  
  // URL para la API de GupShup en el formato v2
  const url = 'https://api.gupshup.io/wa/api/v1/msg';
  
  // Crear el cuerpo del mensaje en formato JSON
  const messageBody = JSON.stringify({
    type: 'text',
    text: 'Prueba de mensaje JSON desde script test-gupshup-direct.js - ' + new Date().toISOString()
  });
  
  // Crear los datos del formulario
  const formData = new URLSearchParams();
  formData.append('channel', 'whatsapp');
  formData.append('source', GUPSHUP_NUMBER);
  formData.append('destination', TEST_PHONE);
  formData.append('message', messageBody);
  formData.append('src.name', 'SeatManager');
  
  // Configuración de la solicitud
  const config = {
    headers: {
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/x-www-form-urlencoded',
      'apikey': GUPSHUP_API_KEY,
      'userid': GUPSHUP_USERID,
      'Accept': 'application/json'
    }
  };
  
  try {
    console.log('📡 Enviando solicitud a URL:', url);
    console.log('📱 Número de destino:', TEST_PHONE);
    console.log('🔑 Usando apikey:', GUPSHUP_API_KEY.substring(0, 8) + '...');
    console.log('👤 Usando userid:', GUPSHUP_USERID);
    
    const response = await axios.post(url, formData, config);
    
    console.log('✅ Respuesta:', response.status);
    console.log('📄 Datos:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('❌ Error al enviar mensaje JSON:', error.message);
    if (error.response) {
      console.error('📄 Datos de error:', JSON.stringify(error.response.data, null, 2));
    }
    return { success: false, error: error.message };
  }
}

// Ejecutar ambas funciones de prueba en secuencia
async function runTests() {
  console.log('🚀 Iniciando pruebas de envío de mensajes a GupShup...');
  console.log('📋 Verificando credenciales:');
  console.log('  - API Key:', GUPSHUP_API_KEY ? '✅ Configurada' : '❌ No configurada');
  console.log('  - Number:', GUPSHUP_NUMBER ? '✅ Configurado' : '❌ No configurado');
  console.log('  - User ID:', GUPSHUP_USERID ? '✅ Configurado' : '❌ No configurado');
  
  if (!GUPSHUP_API_KEY || !GUPSHUP_NUMBER || !GUPSHUP_USERID) {
    console.error('❌ Faltan credenciales. Verifica tu archivo .env');
    return;
  }
  
  try {
    // Prueba 1: Mensaje simple
    const result1 = await sendSimpleTextMessage();
    
    // Prueba 2: Mensaje JSON
    const result2 = await sendJsonTextMessage();
    
    console.log('\n📊 Resultados de las pruebas:');
    console.log('1. Mensaje simple:', result1.status || 'Error');
    console.log('2. Mensaje JSON:', result2.status || 'Error');
    
    console.log('\n🏁 Pruebas completadas.');
  } catch (error) {
    console.error('❌ Error general durante las pruebas:', error.message);
  }
}

// Ejecutar las pruebas
runTests(); 