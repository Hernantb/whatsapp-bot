# Solución al problema de foreign key constraint en conversaciones eliminadas

## Problema Detectado
Cuando un cliente intentaba comunicarse con un negocio después de que la conversación había sido eliminada del dashboard, el sistema fallaba con el siguiente error:

```
❌ Error guardando mensaje: insert or update on table "messages" violates foreign key constraint "messages_conversation_id_fkey"
```

Esto ocurría porque el sistema tenía en caché el ID de la conversación eliminada y seguía intentando usarlo para guardar nuevos mensajes.

## Causas del Problema
1. El sistema mantenía en caché los mapeos entre números de teléfono y IDs de conversación en los objetos `phoneToConversationMap` y `conversationIdToPhoneMap`.
2. Cuando una conversación era eliminada desde el dashboard, estos mapeos no se actualizaban.
3. Al recibir un nuevo mensaje, el sistema intentaba usar el ID de conversación en caché, pero este ya no existía en la base de datos.
4. La inserción fallaba con un error de clave foránea porque la referencia a la conversación ya no era válida.

## Soluciones Implementadas

### 1. Verificación de Conversaciones en Caché
Se agregó una verificación de existencia para conversaciones en caché antes de intentar usarlas:

```javascript
// NUEVO: Verificar que la conversación cacheada realmente exista en la base de datos
try {
  console.log(`🔍 Verificando si la conversación en caché ${actualConversationId} todavía existe en la base de datos...`);
  const { data: existingConvCheck, error: checkError } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', actualConversationId)
    .single();
    
  if (checkError || !existingConvCheck) {
    console.log(`⚠️ La conversación en caché ${actualConversationId} ya no existe en la base de datos. Se creará una nueva.`);
    // Limpiar la entrada en caché si la conversación ya no existe
    delete phoneToConversationMap[sender];
    delete conversationIdToPhoneMap[actualConversationId];
    actualConversationId = null; // Forzar creación de una nueva conversación
  }
}
```

### 2. Mejora en la Actualización de Mapeos
Se mejoró la función `updateConversationMappings()` para detectar y limpiar mapeos inconsistentes:

```javascript
// Verificar mapeos inconsistentes para limpiarlos
const inconsistentNumbers = [];
const inconsistentIds = [];

// Verificar números de teléfono que apuntan a IDs que ya no existen
for (const [phone, convId] of Object.entries(phoneToConversationMap)) {
  if (!newConversationIdToPhoneMap[convId]) {
    inconsistentNumbers.push(phone);
    console.log(`⚠️ Limpiando mapeo inconsistente: el número ${phone} apunta a conversación inexistente ${convId}`);
  }
}
```

### 3. Actualización Periódica de Mapeos
Se agregó un sistema para actualizar los mapeos periódicamente:

```javascript
// NUEVO: Configurar actualización periódica de mapeos
const UPDATE_MAPPINGS_INTERVAL = 1000 * 60 * 10; // 10 minutos
console.log(`⏱️ Configurando actualización periódica de mapeos cada ${UPDATE_MAPPINGS_INTERVAL/1000/60} minutos`);

setInterval(async () => {
  console.log('⏰ Ejecutando actualización periódica de mapeos...');
  await updateConversationMappings();
}, UPDATE_MAPPINGS_INTERVAL);
```

### 4. Mejor Manejo de Errores de Clave Foránea
Se implementó un mecanismo de reintento cuando se detecta un error de clave foránea:

```javascript
// NUEVO: Si el error es por una clave foránea, intentar limpiar y recrear
if (saveResult?.error && saveResult.error.includes('foreign key constraint')) {
  console.log(`🔄 Error de clave foránea detectado, limpiando mapeo en caché para ${sender} y reintentando...`);
  
  // Limpiar mapeo en caché
  if (phoneToConversationMap[sender]) {
    const oldId = phoneToConversationMap[sender];
    delete phoneToConversationMap[sender];
    delete conversationIdToPhoneMap[oldId];
    
    // Reintentar con el mapeo limpio
    console.log('🔄 Reintentando guardar mensaje con nuevo mapeo...');
    const retryResult = await saveMessageToSupabase({/* ... */});
  }
}
```

### 5. Verificación Previa en el Webhook
Se agregó una verificación previa en el webhook para detectar inconsistencias antes de procesar mensajes:

```javascript
// NUEVO: Verificar si hay una conversación en caché y si todavía existe
let cachedConversationId = phoneToConversationMap[sender];
if (cachedConversationId) {
  console.log(`🔍 Verificando conversación en caché: ${cachedConversationId} para ${sender}`);
  const conversationStillExists = await verifyConversationExists(cachedConversationId);
  
  if (!conversationStillExists) {
    console.log(`⚠️ Conversación en caché ${cachedConversationId} ya no existe, limpiando caché.`);
    delete phoneToConversationMap[sender];
    delete conversationIdToPhoneMap[cachedConversationId];
    // ...
  }
}
```

## Beneficios de los Cambios
1. **Mayor Robustez**: El sistema ahora maneja correctamente escenarios donde las conversaciones son eliminadas.
2. **Recuperación Automática**: Si se detecta una inconsistencia, el sistema limpia automáticamente los mapeos incorrectos.
3. **Mantenimiento Proactivo**: La actualización periódica de mapeos evita problemas a largo plazo.
4. **Mejor Experiencia de Usuario**: Los clientes pueden seguir comunicándose incluso después de que su conversación anterior fue eliminada.

## Pruebas Realizadas
Los cambios fueron probados con un escenario donde:
1. Se eliminó una conversación existente desde el dashboard
2. El mismo cliente envió un nuevo mensaje
3. El sistema detectó que la conversación ya no existía y creó una nueva automáticamente
4. El mensaje se procesó correctamente sin errores 