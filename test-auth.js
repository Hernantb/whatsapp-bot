// Script para probar diferentes opciones de autenticación con GupShup
require('dotenv').config();
const axios = require('axios');

// Obtener variables de entorno
const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
const GUPSHUP_NUMBER = process.env.GUPSHUP_NUMBER;
const GUPSHUP_USERID = process.env.GUPSHUP_USERID;
const TEST_NUMBER = '5212221192568';

// Mensaje de prueba
const MESSAGE = 'Prueba de autenticación';

// Método para generar las opciones de prueba
async function testAuthOptions() {
  console.log('🧪 Iniciando pruebas de autenticación con GupShup...');
  console.log(`🔑 API Key: ${GUPSHUP_API_KEY}`);
  console.log(`📱 Número: ${GUPSHUP_NUMBER}`);
  console.log(`👤 User ID: ${GUPSHUP_USERID}`);
  
  // Combinaciones de prueba
  const testOptions = [
    {
      name: 'Opción 1: apikey en headers',
      url: 'https://api.gupshup.io/wa/api/v1/msg',
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded',
        'apikey': GUPSHUP_API_KEY
      },
      data: {
        channel: 'whatsapp',
        source: GUPSHUP_NUMBER,
        destination: TEST_NUMBER,
        'src.name': GUPSHUP_NUMBER,
        message: JSON.stringify({
          type: 'text',
          text: MESSAGE
        })
      }
    },
    {
      name: 'Opción 2: token en headers',
      url: 'https://api.gupshup.io/wa/api/v1/msg',
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded',
        'token': GUPSHUP_API_KEY
      },
      data: {
        channel: 'whatsapp',
        source: GUPSHUP_NUMBER,
        destination: TEST_NUMBER,
        'src.name': GUPSHUP_NUMBER,
        message: JSON.stringify({
          type: 'text',
          text: MESSAGE
        })
      }
    },
    {
      name: 'Opción 3: api_key en query params',
      url: `https://api.gupshup.io/wa/api/v1/msg?api_key=${GUPSHUP_API_KEY}`,
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: {
        channel: 'whatsapp',
        source: GUPSHUP_NUMBER,
        destination: TEST_NUMBER,
        'src.name': GUPSHUP_NUMBER,
        message: JSON.stringify({
          type: 'text',
          text: MESSAGE
        })
      }
    },
    {
      name: 'Opción 4: apikey + userid',
      url: 'https://api.gupshup.io/wa/api/v1/msg',
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded',
        'apikey': GUPSHUP_API_KEY,
        'userid': GUPSHUP_USERID
      },
      data: {
        channel: 'whatsapp',
        source: GUPSHUP_NUMBER,
        destination: TEST_NUMBER,
        'src.name': GUPSHUP_NUMBER,
        message: JSON.stringify({
          type: 'text',
          text: MESSAGE
        })
      }
    },
    {
      name: 'Opción 5: apikey en datos',
      url: 'https://api.gupshup.io/wa/api/v1/msg',
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: {
        channel: 'whatsapp',
        source: GUPSHUP_NUMBER,
        destination: TEST_NUMBER,
        'src.name': GUPSHUP_NUMBER,
        apiKey: GUPSHUP_API_KEY,
        message: JSON.stringify({
          type: 'text',
          text: MESSAGE
        })
      }
    },
    {
      name: 'Opción 6: Authorization header (Bearer)',
      url: 'https://api.gupshup.io/wa/api/v1/msg',
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${GUPSHUP_API_KEY}`
      },
      data: {
        channel: 'whatsapp',
        source: GUPSHUP_NUMBER,
        destination: TEST_NUMBER,
        'src.name': GUPSHUP_NUMBER,
        message: JSON.stringify({
          type: 'text',
          text: MESSAGE
        })
      }
    }
  ];
  
  // Probar cada opción
  for (const option of testOptions) {
    console.log(`\n🔍 Probando ${option.name}...`);
    console.log(`📝 URL: ${option.url}`);
    console.log(`📝 Headers:`, option.headers);
    console.log(`📝 Datos:`, option.data);
    
    try {
      const formData = new URLSearchParams();
      for (const [key, value] of Object.entries(option.data)) {
        formData.append(key, value);
      }
      
      const response = await axios.post(option.url, formData, { headers: option.headers });
      
      console.log('✅ ÉXITO!');
      console.log('📡 Respuesta:', JSON.stringify(response.data, null, 2));
      console.log('📊 Código de estado:', response.status);
    } catch (error) {
      console.log('❌ ERROR!');
      if (error.response) {
        console.log('📡 Código de estado:', error.response.status);
        console.log('📡 Datos de respuesta:', JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        console.log('📡 No se recibió respuesta del servidor');
      } else {
        console.log('📡 Error en la configuración de la solicitud:', error.message);
      }
    }
  }
}

// Ejecutar las pruebas
testAuthOptions()
  .then(() => {
    console.log('\n🏁 Todas las pruebas completadas.');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error general:', err);
    process.exit(1);
  }); 