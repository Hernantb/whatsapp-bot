require('dotenv').config();
const axios = require('axios');

// Obtener variables de entorno
const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
const GUPSHUP_NUMBER = process.env.GUPSHUP_NUMBER;
const TEST_NUMBER = '5212221192568'; // Número al que enviaremos la prueba

async function testMessageFormats() {
  console.log('🧪 Iniciando pruebas de formatos de mensaje para GupShup...');
  console.log(`🔑 API Key: ${GUPSHUP_API_KEY}`);
  console.log(`📱 Número de origen: ${GUPSHUP_NUMBER}`);
  console.log(`📱 Número de destino: ${TEST_NUMBER}`);
  
  const apiUrl = 'https://api.gupshup.io/wa/api/v1/msg';
  
  // Configuración base común para todas las pruebas
  const headers = {
    'Cache-Control': 'no-cache',
    'Content-Type': 'application/x-www-form-urlencoded',
    'apikey': GUPSHUP_API_KEY
  };
  
  // Lista de formatos a probar
  const testFormats = [
    {
      name: 'Formato 1: JSON como string',
      getData: () => {
        const formData = new URLSearchParams();
        formData.append('channel', 'whatsapp');
        formData.append('source', GUPSHUP_NUMBER);
        formData.append('destination', TEST_NUMBER);
        formData.append('src.name', GUPSHUP_NUMBER);
        formData.append('message', JSON.stringify({
          type: 'text',
          text: 'Prueba formato 1: JSON como string'
        }));
        return formData;
      }
    },
    {
      name: 'Formato 2: Texto plano',
      getData: () => {
        const formData = new URLSearchParams();
        formData.append('channel', 'whatsapp');
        formData.append('source', GUPSHUP_NUMBER);
        formData.append('destination', TEST_NUMBER);
        formData.append('src.name', GUPSHUP_NUMBER);
        formData.append('message', 'Prueba formato 2: Texto plano');
        return formData;
      }
    },
    {
      name: 'Formato 3: JSON con campos separados',
      getData: () => {
        const formData = new URLSearchParams();
        formData.append('channel', 'whatsapp');
        formData.append('source', GUPSHUP_NUMBER);
        formData.append('destination', TEST_NUMBER);
        formData.append('src.name', GUPSHUP_NUMBER);
        formData.append('message.type', 'text');
        formData.append('message.text', 'Prueba formato 3: JSON con campos separados');
        return formData;
      }
    },
    {
      name: 'Formato 4: JSON sin src.name',
      getData: () => {
        const formData = new URLSearchParams();
        formData.append('channel', 'whatsapp');
        formData.append('source', GUPSHUP_NUMBER);
        formData.append('destination', TEST_NUMBER);
        formData.append('message', JSON.stringify({
          type: 'text',
          text: 'Prueba formato 4: JSON sin src.name'
        }));
        return formData;
      }
    },
    {
      name: 'Formato 5: Sin comillas en JSON',
      getData: () => {
        const formData = new URLSearchParams();
        formData.append('channel', 'whatsapp');
        formData.append('source', GUPSHUP_NUMBER);
        formData.append('destination', TEST_NUMBER);
        formData.append('src.name', GUPSHUP_NUMBER);
        formData.append('message', '{"type":"text","text":"Prueba formato 5: Sin comillas en JSON"}');
        return formData;
      }
    }
  ];
  
  // Probar cada formato
  for (const format of testFormats) {
    console.log(`\n🔍 Probando ${format.name}...`);
    
    try {
      const response = await axios.post(apiUrl, format.getData(), { headers });
      console.log('✅ ÉXITO!');
      console.log('📡 Respuesta:', JSON.stringify(response.data));
    } catch (error) {
      console.log('❌ ERROR!');
      if (error.response) {
        console.log('📡 Detalles:', error.response.status, JSON.stringify(error.response.data));
      } else {
        console.log('📡 Error:', error.message);
      }
    }
  }
}

// Ejecutar las pruebas
testMessageFormats().catch(err => console.error('Error general:', err)); 