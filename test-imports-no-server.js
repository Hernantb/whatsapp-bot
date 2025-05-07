/**
 * Test script to verify exports from index.js without starting the server
 */

console.log('🧪 Testing exports from index.js...');

// Mock the server start to prevent it from actually starting
const originalListen = require('express').application.listen;
require('express').application.listen = function() {
  console.log('🛑 Express server start prevented by mock');
  return { 
    on: () => {}, 
    close: () => {} 
  };
};

try {
  // Disable console logs from index.js
  const originalConsoleLog = console.log;
  console.log = function(...args) {
    // Only log messages from this test script
    if (args[0] && typeof args[0] === 'string' && 
        (args[0].includes('🧪') || 
         args[0].includes('✅') || 
         args[0].includes('❌') || 
         args[0].includes('📋'))) {
      originalConsoleLog.apply(console, args);
    }
  };
  
  console.log('📋 Loading index.js with mocked server...');
  const indexModule = require('./index.js');
  
  // Restore console.log
  console.log = originalConsoleLog;
  
  console.log('📋 Available exports from index.js:', Object.keys(indexModule));
  
  if (indexModule.verifyConversationExists) {
    console.log('✅ verifyConversationExists function is available in index.js exports');
    console.log('🔍 Function type:', typeof indexModule.verifyConversationExists);
  } else {
    console.error('❌ verifyConversationExists function is NOT available in index.js exports');
  }
} catch (error) {
  console.error('❌ Error:', error);
} finally {
  // Restore the original listen function
  require('express').application.listen = originalListen;
}

console.log('🏁 Test completed'); 