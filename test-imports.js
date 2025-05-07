/**
 * Test script to verify imports between modules
 */

console.log('🧪 Testing imports between server.js and index.js...');

// Test importing from server.js
try {
  console.log('\n📋 Testing imports from server.js:');
  const serverModule = require('./server.js');
  
  console.log('✅ server.js module imported successfully');
  console.log('📋 Available exports:', Object.keys(serverModule).join(', '));
  
  if (serverModule.verifyConversationExists) {
    console.log('✅ verifyConversationExists function is available in server.js exports');
    console.log('🔍 Function type:', typeof serverModule.verifyConversationExists);
  } else {
    console.error('❌ verifyConversationExists function is NOT available in server.js exports');
  }
} catch (error) {
  console.error('❌ Error importing server.js:', error.message);
}

// Test importing from index.js with all module exports
try {
  console.log('\n📋 Testing imports from index.js:');
  const indexModule = require('./index.js');
  
  console.log('✅ index.js module imported successfully');
  console.log('📋 Available exports:', Object.keys(indexModule).join(', '));
  
  if (indexModule.verifyConversationExists) {
    console.log('✅ verifyConversationExists function is available in index.js exports');
  } else {
    console.error('❌ verifyConversationExists function is NOT available in index.js exports');
  }
} catch (error) {
  console.error('❌ Error importing index.js:', error.message);
}

console.log('\n🏁 Import tests completed'); 