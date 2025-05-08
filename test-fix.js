// Test script for verifying the fix to getContactName and checkForNotificationPhrases
const axios = require('axios');

async function testWebhook() {
  try {
    console.log('🔍 Starting test for WebHook...');
    
    // Create test message
    const testMessage = {
      "entry": [{
        "changes": [{
          "field": "messages",
          "value": {
            "contacts": [{
              "profile": {"name": "Test User"},
              "wa_id": "5212213647963"
            }],
            "messages": [{
              "from": "5212213647963",
              "id": `wamid.test${Date.now()}`,
              "text": {"body": "Hola me gustaría agendar una cita para conocer más detalles"},
              "timestamp": Math.floor(Date.now() / 1000).toString(),
              "type": "text"
            }],
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "15557033313",
              "phone_number_id": "627906933732008"
            }
          }
        }],
        "id": "558266346528553"
      }],
      "object": "whatsapp_business_account"
    };
    
    console.log('📤 Sending test message to webhook...');
    
    // Try to determine the server port (either 7777 or 7778)
    let serverPort = 7778;
    try {
      // First try port 7777
      const statusResponse = await axios.get('http://localhost:7777/api/status', { timeout: 1000 });
      if (statusResponse.status === 200) {
        serverPort = 7777;
        console.log('📊 Found server running on port 7777');
      }
    } catch (err) {
      console.log('📊 Server not found on port 7777, trying 7778...');
      try {
        // Then try port 7778
        const statusResponse = await axios.get('http://localhost:7778/api/status', { timeout: 1000 });
        if (statusResponse.status === 200) {
          serverPort = 7778;
          console.log('📊 Found server running on port 7778');
        }
      } catch (err) {
        console.log('⚠️ Warning: Could not find running server on ports 7777 or 7778');
        // Continue anyway with default port 7778
      }
    }
    
    // Send the message to our webhook
    console.log(`📤 Sending message to http://localhost:${serverPort}/webhook`);
    const response = await axios.post(`http://localhost:${serverPort}/webhook`, testMessage, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log(`✅ Test completed with status: ${response.status}`);
    console.log(`📊 Response data: ${response.data}`);
    
    console.log('🔍 Test completed. Check server logs to verify there are no getContactName errors.');
  } catch (error) {
    console.error('❌ Error in test:', error.message);
  }
}

// Run the test
testWebhook(); 