// Funciones de ayuda para el manejo de notificaciones

// Caché para evitar notificaciones duplicadas
const recentNotificationMessages = new Map();
const NOTIFICATION_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Verifica si un mensaje requiere notificación según patrones predefinidos
 * @param {string} message - El mensaje a verificar
 * @returns {boolean} - True si el mensaje requiere notificación
 */
function checkForNotificationPhrases(message) {
  console.log(`🔍 NOTIFICATIONHELPERS: Verificando si mensaje "${message}" requiere notificación...`);
  
  // Normalizar mensaje (quitar acentos, convertir a minúsculas)
  const normalizedMessage = message.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  console.log(`🔍 NOTIFICATIONHELPERS: Mensaje normalizado: "${normalizedMessage}"`);
  
  // Patrones que requieren notificación
  const patterns = [
    /perfecto.*cita ha sido confirmada/i,
    /perfecto.*un asesor te llamar/i,
    /perfecto.*un asesor te contactar/i,
    /perfecto.*una persona te contactar/i,
    /tu cita ha sido confirmada/i,  // Añadir sin el "para"
    /asesor te llamar/i,
    /adelante.*agendar.*cita/i,
    /te contactará un asesor/i
  ];
  
  // Verificar patrones
  for (const pattern of patterns) {
    if (pattern.test(normalizedMessage)) {
      console.log(`✅ NOTIFICATIONHELPERS: COINCIDENCIA CON PATRÓN: ${pattern}`);
      return true;
    }
  }
  
  // Verificar con patrones más agresivos
  const aggressivePatterns = [
    /cita.*confirmada/i,
    /perfecto.*cita/i,
    /tu cita/i
  ];
  
  // Verificar patrones agresivos
  for (const pattern of aggressivePatterns) {
    if (pattern.test(normalizedMessage)) {
      console.log(`✅ NOTIFICATIONHELPERS: COINCIDENCIA CON PATRÓN AGRESIVO: ${pattern}`);
      return true;
    }
  }
  
  // Palabras clave adicionales que podrían indicar necesidad de notificación
  const keywordPairs = [
    ['cita', 'confirm'],
    ['cita', 'agend'],
    ['horario', 'dispon'],
    ['asesor', 'llamar'],
    ['asesor', 'contact'],
    ['contactará', 'pronto'],
    ['perfecto', 'cita']  // Añadir este par
  ];
  
  // Verificar pares de palabras clave (ambas deben estar presentes)
  for (const [word1, word2] of keywordPairs) {
    if (normalizedMessage.includes(word1) && normalizedMessage.includes(word2)) {
      console.log(`✅ NOTIFICATIONHELPERS: COINCIDENCIA CON PALABRAS CLAVE: "${word1}" y "${word2}"`);
      return true;
    }
  }
  
  // Si no coincide con ningún patrón
  console.log('❌ NOTIFICATIONHELPERS: No se detectaron frases que requieran notificación');
  
  // Verificación final manual para casos específicos del bot
  if ((message.includes("Perfecto") || message.includes("¡Perfecto")) && message.includes("cita") && message.includes("confirmada")) {
    console.log(`✅ NOTIFICATIONHELPERS: Verificación final detectó combinación crítica de palabras`);
    return true;
  }
  
  return false;
}

/**
 * Limpia la caché de notificaciones, eliminando entradas antiguas
 */
function cleanupNotificationCache() {
  const now = Date.now();
  for (const [messageHash, timestamp] of recentNotificationMessages.entries()) {
    if (now - timestamp > NOTIFICATION_CACHE_TTL) {
      recentNotificationMessages.delete(messageHash);
    }
  }
  console.log(`🧹 Limpieza de caché completada. Mensajes en caché: ${recentNotificationMessages.size}`);
}

module.exports = {
  checkForNotificationPhrases
}; 