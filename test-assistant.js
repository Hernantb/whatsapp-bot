// Script para probar la integración con el asistente de OpenAI
require('dotenv').config();
const axios = require('axios');

// Configuración de OpenAI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID || "asst_bdJlX30wF1qQH3Lf8ZoiptVx";

// Función para probar el asistente
async function testAssistant(message) {
  try {
    console.log(`⚙️ Probando asistente con mensaje: "${message}"`);
    console.log(`🔑 Usando OpenAI API Key: ${OPENAI_API_KEY.substring(0, 7)}...`);
    console.log(`🤖 Usando Assistant ID: ${ASSISTANT_ID}`);
    
    // Paso 1: Crear un thread
    console.log('🧵 Creando thread...');
    const threadResponse = await axios.post('https://api.openai.com/v1/threads', {}, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    const threadId = threadResponse.data.id;
    console.log(`✅ Thread creado: ${threadId}`);
    
    // Paso 2: Añadir mensaje al thread
    console.log('📝 Añadiendo mensaje al thread...');
    await axios.post(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      role: 'user',
      content: message
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    console.log('✅ Mensaje añadido al thread');
    
    // Paso 3: Ejecutar el asistente
    console.log('🏃 Ejecutando asistente...');
    const runResponse = await axios.post(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      assistant_id: ASSISTANT_ID
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    const runId = runResponse.data.id;
    console.log(`✅ Run iniciado: ${runId}`);
    
    // Paso 4: Esperar a que el run termine
    console.log('⏳ Esperando a que el run termine...');
    
    let runStatus = 'queued';
    let attempts = 0;
    const maxAttempts = 30;
    
    while (runStatus !== 'completed' && runStatus !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await axios.get(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      
      runStatus = statusResponse.data.status;
      console.log(`🔄 Estado del run: ${runStatus} (intento ${attempts + 1})`);
      attempts++;
    }
    
    if (runStatus === 'completed') {
      // Paso 5: Obtener la respuesta
      console.log('📥 Obteniendo respuesta...');
      const messagesResponse = await axios.get(`https://api.openai.com/v1/threads/${threadId}/messages`, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      
      const assistantMessages = messagesResponse.data.data.filter(msg => msg.role === 'assistant');
      
      if (assistantMessages.length > 0) {
        const latestMessage = assistantMessages[0];
        
        let responseText = '';
        if (latestMessage.content && latestMessage.content.length > 0) {
          const textContent = latestMessage.content.filter(item => item.type === 'text');
          if (textContent.length > 0) {
            responseText = textContent[0].text.value;
          }
        }
        
        console.log('✅ Respuesta recibida:');
        console.log('=================================================');
        console.log(responseText);
        console.log('=================================================');
        
        return responseText;
      } else {
        console.error('❌ No se encontraron mensajes del asistente');
        return null;
      }
    } else {
      console.error(`❌ El run no se completó. Estado final: ${runStatus}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.response) {
      console.error('🔍 Respuesta de error:', 
                  error.response.status, 
                  JSON.stringify(error.response.data).substring(0, 500));
    }
    
    return null;
  }
}

// Obtener mensaje de la línea de comandos
const message = process.argv.slice(2).join(' ');

if (!message) {
  console.error('❌ Error: Debes proporcionar un mensaje');
  console.log('Uso: node test-assistant.js "Tu mensaje aquí"');
  process.exit(1);
}

// Probar el asistente
testAssistant(message)
  .then(response => {
    if (response) {
      process.exit(0);
    } else {
      console.error('❌ No se recibió respuesta');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Error inesperado:', error.message);
    process.exit(1);
  }); 