# Resumen de Solución: Error getContactName y checkForNotificationPhrases

## Problema Detectado
Al recibir mensajes de WhatsApp a través del webhook, el sistema mostraba errores como:
```
❌ Error crítico con la conversación: getContactName is not defined
```

Y también:
```
❌ Error procesando mensaje pendiente: checkForNotificationPhrases is not defined
```

## Causa del Problema
1. La función `getContactName` estaba definida en el archivo `whatsapp-bot-main/index.js` pero no en el archivo principal `index.js` que procesa los webhooks de WhatsApp.
2. La función `checkForNotificationPhrases` estaba definida en `server.js` pero no en `index.js`.
3. El código intentaba usar estas funciones sin verificar si estaban disponibles.

## Solución Implementada

### 1. Agregar función getContactName
Se agregó la función `getContactName` al archivo `index.js`:

```javascript
/**
 * Obtiene el nombre de un contacto a partir de su número de teléfono
 * Si no se encuentra, devuelve el número como valor predeterminado
 * @param {string} phoneNumber - Número de teléfono del contacto
 * @returns {string} - Nombre del contacto o número de teléfono
 */
function getContactName(phoneNumber) {
  try {
    console.log(`🔍 Buscando nombre para el contacto: ${phoneNumber}`);
    
    // Si no hay número, devolver un valor predeterminado
    if (!phoneNumber) return 'Usuario';
    
    // Si tenemos el contacto en caché local, usarlo
    if (contactCache && contactCache[phoneNumber]) {
      return contactCache[phoneNumber];
    }
    
    // Si no tenemos información, usar el número como nombre predeterminado
    return phoneNumber;
  } catch (error) {
    console.error(`❌ Error al obtener nombre de contacto: ${error.message}`);
    return phoneNumber; // Valor seguro por defecto
  }
}
```

### 2. Agregar la variable de caché necesaria
Se agregó la inicialización del objeto de caché para almacenar nombres de contactos:

```javascript
const contactCache = {}; // Cache para nombres de contactos
```

### 3. Agregar función checkForNotificationPhrases
Se agregó la función `checkForNotificationPhrases` que verifica si un mensaje contiene frases que requieren notificación:

```javascript
/**
 * Verifica si un mensaje contiene frases que requieren notificación
 * @param {string} message - Mensaje a verificar
 * @returns {boolean} - True si requiere notificación, false en caso contrario
 */
function checkForNotificationPhrases(message) {
  if (!message) return false;
  
  const lowerMsg = message.toLowerCase();
  
  // Common phrases that indicate a notification is needed
  const notificationPhrases = [
    "tu cita ha sido confirmada",
    "cita confirmada",
    "te llamará un asesor",
    "un asesor te llamará",
    "te contactará un asesor",
    "un asesor te contactará",
    "te esperamos en la agencia",
    "agendamos tu visita",
    "tu visita ha sido agendada"
  ];
  
  // Check if message contains any of the notification phrases
  for (const phrase of notificationPhrases) {
    if (lowerMsg.includes(phrase)) {
      console.log(`✅ Frase de notificación encontrada: "${phrase}" en el mensaje`);
      return true;
    }
  }
  
  return false;
}
```

### 4. Mejorar el manejo de errores
Se modificó el código para incluir mejor manejo de errores al llamar a `getContactName`:

```javascript
// Usar un nombre seguro para el remitente
let senderName = sender;
try {
  // Intentar obtener el nombre del contacto si la función está disponible
  if (typeof getContactName === 'function') {
    senderName = getContactName(sender) || sender;
  }
} catch (nameError) {
  console.log(`⚠️ No se pudo obtener nombre del contacto, usando número: ${sender}`);
}
```

### 5. Mejorar validación en la ruta webhook
Se agregó una validación adicional en la ruta del webhook para verificar la estructura del mensaje:

```javascript
// Validación adicional para verificar la estructura del mensaje
if (!body || !body.entry || !body.entry[0] || !body.entry[0].changes || !body.entry[0].changes[0]) {
    console.log(`⚠️ Estructura de mensaje webhook inválida: ${JSON.stringify(body)}`);
    return res.sendStatus(200); // Responder OK a pesar del error, para evitar reenvíos
}
```

## Beneficios de los Cambios

1. **Mayor robustez**: El sistema ahora maneja correctamente escenarios donde las funciones no están disponibles.
2. **Mejor manejo de errores**: Se añadieron bloques try/catch para capturar errores potenciales.
3. **Validación mejorada**: Se verifica la estructura de los mensajes recibidos.
4. **Independencia de módulos**: Las funciones críticas ahora están disponibles directamente en el archivo, sin depender de importaciones externas.

## Pruebas Realizadas
Se creó un script `test-fix.js` para probar el webhook con mensajes simulados y verificar que no ocurran errores. 