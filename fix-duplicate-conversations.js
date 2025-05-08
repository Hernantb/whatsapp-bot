const fs = require('fs');
const path = require('path');

// Ruta al archivo server.js
const serverFilePath = path.join(__dirname, 'server.js');

// Función para aplicar el parche
async function applyFix() {
  try {
    console.log(`\n🔧 === INICIANDO PARCHE PARA CORREGIR CONVERSACIONES DUPLICADAS ===`);
    
    // Leer el contenido del archivo
    console.log(`📄 Leyendo archivo server.js...`);
    let content = fs.readFileSync(serverFilePath, 'utf8');
    
    // Identificar la sección de código que maneja la búsqueda y creación de conversaciones
    const webhookEndpointPosition = content.indexOf('app.post(\'/webhook\'');
    
    if (webhookEndpointPosition === -1) {
      console.error(`❌ No se encontró el endpoint de webhook en server.js`);
      return;
    }
    
    console.log(`✅ Endpoint de webhook localizado en server.js`);
    
    // Obtener el fragmento de código a reemplazar
    const startSearchMarker = '// Primero buscamos si ya existe una conversación';
    const endSearchMarker = 'let conversationId;';
    
    const startPos = content.indexOf(startSearchMarker, webhookEndpointPosition);
    const endPos = content.indexOf(endSearchMarker, startPos);
    
    if (startPos === -1 || endPos === -1) {
      console.error(`❌ No se encontró el fragmento de código a reemplazar`);
      return;
    }
    
    // Código corregido para búsqueda de conversaciones, garantizando unicidad por número de teléfono
    const fixedCode = `// Primero buscamos si ya existe una conversación con este número
      console.log('🔍 Buscando conversación existente para el número:', processedData.phoneNumber);
      const { data: existingConv, error: convError } = await supabase
        .from('conversations')
        .select('id, user_id, sender_name')
        .eq('user_id', processedData.phoneNumber)
        .eq('business_id', businessId)
        .order('last_message_time', { ascending: false })
        .limit(1);

      if (convError) {
        console.error('❌ Error buscando conversación:', JSON.stringify(convError, null, 2));
        return res.status(500).json({ error: 'Error buscando conversación', details: convError });
      }

      let conversationId;
      let originalSenderName = '';`;
    
    // Reemplazar el código antiguo con el corregido
    const contentBefore = content.substring(0, startPos);
    const contentAfter = content.substring(endPos);
    
    const newContent = contentBefore + fixedCode + contentAfter;
    
    // También necesitamos corregir la lógica para actualizar el nombre del remitente
    const updateSectionMarker = 'const { error: updateError } = await supabase';
    const updateSectionPos = newContent.indexOf(updateSectionMarker, webhookEndpointPosition);
    
    if (updateSectionPos === -1) {
      console.error(`❌ No se encontró la sección de actualización de conversación`);
      return;
    }
    
    // Buscar el bloque donde se hace el update de la conversación
    const updateStartMarker = '// Actualizamos el último mensaje de la conversación';
    const updateEndMarker = '// Guardamos el mensaje con timestamp';
    
    const updateStart = newContent.indexOf(updateStartMarker, webhookEndpointPosition);
    const updateEnd = newContent.indexOf(updateEndMarker, updateStart);
    
    if (updateStart === -1 || updateEnd === -1) {
      console.error(`❌ No se encontró el bloque de actualización completo`);
      return;
    }
    
    // Obtener el fragmento a reemplazar
    const updateBlock = newContent.substring(updateStart, updateEnd);
    
    // Versión corregida del bloque de actualización
    const fixedUpdateBlock = `// Actualizamos el último mensaje de la conversación con timestamp actualizado
        console.log('📝 Actualizando último mensaje de la conversación...');
        const currentTimestamp = new Date().toISOString();
        
        // Obtener el nombre del remitente actual antes de actualizar
        originalSenderName = existingConv[0].sender_name || 'Usuario';
        
        // Solo actualizamos el nombre si el actual es genérico y recibimos uno más específico
        const senderNameToUse = (originalSenderName === 'Usuario' && processedData.senderName) 
          ? processedData.senderName 
          : originalSenderName;
          
        const { error: updateError } = await supabase
          .from('conversations')
          .update({
            last_message: processedData.messageText,
            last_message_time: currentTimestamp,
            sender_name: senderNameToUse
          })
          .eq('id', conversationId);

        if (updateError) {
          console.error('❌ Error actualizando conversación:', JSON.stringify(updateError, null, 2));
          return res.status(500).json({ error: 'Error actualizando conversación', details: updateError });
        }
        console.log('✅ Conversación actualizada con timestamp:', currentTimestamp);`;
    
    // Crear la nueva versión del contenido del archivo
    const finalContent = newContent.substring(0, updateStart) + fixedUpdateBlock + newContent.substring(updateEnd);
    
    // Escribir el archivo corregido
    console.log(`✏️ Escribiendo cambios en server.js...`);
    fs.writeFileSync(serverFilePath, finalContent, 'utf8');
    
    console.log(`\n✅ Parche aplicado correctamente`);
    console.log(`🔍 Cambios realizados:`);
    console.log(`1. Modificada la búsqueda de conversaciones para garantizar unicidad por número de teléfono`);
    console.log(`2. Mejorada la lógica de actualización del nombre del remitente`);
    console.log(`\n📝 Ahora el sistema no creará conversaciones duplicadas para el mismo número`);
    
  } catch (error) {
    console.error(`❌ Error al aplicar el parche:`, error);
  }
}

// Ejecutar la función
applyFix()
  .then(() => {
    console.log(`\n🏁 Proceso de corrección completado`);
  })
  .catch(err => {
    console.error(`❌ Error fatal:`, err);
  }); 