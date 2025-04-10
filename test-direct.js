// Script para probar directamente las funciones de notificación
require('dotenv').config();
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

// Configuración
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
const BUSINESS_ID = process.env.BUSINESS_ID || '2d385aa5-40e0-4ec9-9360-19281bc605e4';
const TEST_PHONE = process.env.TEST_PHONE || '5212221192568';

// Inicializar Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('🚀 Iniciando prueba directa de notificaciones por correo');
console.log(`📱 Teléfono de prueba: ${TEST_PHONE}`);

// Mensajes de prueba
const testMessages = [
  {
    message: "Gracias por tu consulta, te ayudaré con información sobre nuestros modelos.",
    shouldNotify: false,
    description: "Mensaje regular que NO debería generar notificación"
  },
  {
    message: "¡Perfecto! Tu cita ha sido confirmada para hoy a las 10. Estoy aquí si requieres algo más.",
    shouldNotify: true,
    description: "Mensaje con 'Perfecto! Tu cita ha sido confirmada' que DEBERÍA generar notificación"
  },
  {
    message: "Lamento que no hayas podido venir hoy, podemos reagendar tu cita si lo deseas.",
    shouldNotify: false,
    description: "Mensaje con 'cita' pero sin frases de confirmación, NO debería notificar"
  },
  {
    message: "¡Perfecto! Un asesor te contactará pronto para resolver tus dudas sobre el Cupra León.",
    shouldNotify: true,
    description: "Mensaje con 'Perfecto! Un asesor te contactará' que DEBERÍA generar notificación"
  }
];

// Función que verifica si un mensaje requiere notificación
function checkForNotificationPhrases(message) {
  console.log(`🔍 === VERIFICANDO FRASES PARA NOTIFICACIÓN ===`);
  console.log(`🔍 Mensaje a verificar: "${message}"`);
  
  // Asegurarse de que el mensaje es una cadena
  if (!message || typeof message !== 'string') {
    console.error(`❌ El mensaje no es válido: ${message}`);
    return false;
  }
  
  // Normalizar mensaje (quitar acentos, convertir a minúsculas)
  const normalizedMessage = message.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Lista ampliada de frases que requieren notificación
  const notificationPhrases = [
    "perfecto! un asesor te llamara", 
    "perfecto! un asesor te llamará",
    "¡perfecto! un asesor te llamará",
    "¡perfecto! un asesor te llamara",
    "perfecto un asesor te",
    "perfecto! tu cita ha sido confirmada",
    "¡perfecto! tu cita ha sido confirmada",
    "perfecto! tu cita ha sido registrada",
    "¡perfecto! tu cita ha sido registrada",
    "hemos registrado tu cita",
    "tu cita ha sido",
    "se ha creado la cita",
    "asesor te contactara",
    "asesor te contactará",
    "te contactará",
    "te contactara"
  ];
  
  // Lista ampliada de palabras clave para verificación adicional
  const keyWords = [
    "cita", 
    "asesor", 
    "llamará", 
    "llamara",
    "contactará", 
    "contactara",
    "confirmada", 
    "registrada", 
    "perfecto",
    "reservada",
    "agendada"
  ];
  
  // Verificar si el mensaje contiene alguna de las frases de notificación
  for (const phrase of notificationPhrases) {
    if (normalizedMessage.includes(phrase)) {
      console.log(`✅ COINCIDENCIA EXACTA detectada con frase: "${phrase}"`);
      return true;
    }
  }
  
  // Verificar coincidencia parcial (al menos 2 palabras clave)
  let keyWordCount = 0;
  const matchedKeywords = [];
  for (const word of keyWords) {
    if (normalizedMessage.includes(word)) {
      keyWordCount++;
      matchedKeywords.push(word);
      console.log(`🔑 Palabra clave "${word}" encontrada (${keyWordCount} de ${keyWords.length})`);
    }
  }
  
  if (keyWordCount >= 2) {
    console.log(`✅ COINCIDENCIA PARCIAL: ${keyWordCount} palabras clave encontradas: [${matchedKeywords.join(', ')}]`);
    return true;
  }
  
  // Verificar patrones específicos
  if (
    (normalizedMessage.includes("perfecto") && normalizedMessage.includes("asesor")) ||
    (normalizedMessage.includes("cita") && normalizedMessage.includes("confirmada")) ||
    (normalizedMessage.includes("cita") && normalizedMessage.includes("registrada")) ||
    (normalizedMessage.includes("perfecto") && normalizedMessage.includes("cita"))
  ) {
    console.log(`✅ PATRÓN ESPECÍFICO detectado: combinación de palabras clave`);
    return true;
  }
  
  console.log(`❌ No se detectaron frases que requieran notificación`);
  return false;
}

// Función simplificada para enviar correo electrónico
async function sendEmailNotification(message, phoneNumber, conversationId) {
  try {
    console.log(`\n📧 ENVIANDO NOTIFICACIÓN POR CORREO`);
    console.log(`📧 Mensaje: "${message}"`);
    console.log(`📧 Número: ${phoneNumber}`);
    console.log(`📧 Conversación ID: ${conversationId}`);
    
    // Crear transporter con Gmail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'bexorai@gmail.com',
        pass: process.env.EMAIL_PASSWORD || 'gqwi aker jgrn kylf'
      }
    });
    
    // HTML del correo
    const emailHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0;">🧪 PRUEBA DE NOTIFICACIÓN</h2>
        </div>
        
        <div style="padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #3498db;">
            <h3 style="margin-top: 0; color: #34495e; margin-bottom: 10px;">Datos de Prueba</h3>
            <p style="margin: 0;"><strong>Teléfono:</strong> ${phoneNumber}</p>
            <p style="margin: 0;"><strong>ID Conversación:</strong> ${conversationId}</p>
            <p style="margin: 0;"><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
          </div>
        
          <div style="margin-bottom: 20px;">
            <h3 style="color: #34495e; margin-bottom: 10px;">Mensaje de Prueba</h3>
            <div style="background-color: #e6f7ff; padding: 15px; border-radius: 5px; border-left: 4px solid #2196f3;">
              ${message}
            </div>
          </div>
        
          <div style="text-align: center; margin-top: 30px;">
            <p>Este es un correo de prueba enviado desde el script test-direct.js</p>
            <p>Script ejecutado a las ${new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </div>
    `;
    
    // Opciones del correo
    const mailOptions = {
      from: `"Bot WhatsApp (PRUEBA DIRECTA) 🤖" <${process.env.EMAIL_USER || 'bexorai@gmail.com'}>`,
      to: process.env.NOTIFICATION_EMAIL || 'joaquinisaza@hotmail.com',
      subject: `🧪 PRUEBA: Notificación de Cliente - ${phoneNumber}`,
      html: emailHTML
    };
    
    console.log(`📧 Enviando a: ${mailOptions.to}`);
    
    // Enviar correo
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ CORREO ENVIADO EXITOSAMENTE`);
    console.log(`✅ ID del mensaje: ${info.messageId}`);
    
    return true;
  } catch (error) {
    console.error(`❌ ERROR ENVIANDO CORREO: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

// Función para probar los mensajes
async function runTests() {
  try {
    // 1. Buscar o crear una conversación para la prueba
    console.log('🔍 Buscando conversación existente...');
    let conversationId;
    
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', TEST_PHONE)
        .eq('business_id', BUSINESS_ID)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (data && data.length > 0) {
        conversationId = data[0].id;
        console.log(`✅ Conversación existente encontrada: ${conversationId}`);
      } else {
        console.log('ℹ️ No se encontró conversación existente, creando una nueva...');
        const { data: newConv, error: createError } = await supabase
          .from('conversations')
          .insert([{
            user_id: TEST_PHONE,
            business_id: BUSINESS_ID,
            created_at: new Date().toISOString()
          }])
          .select();
        
        if (createError) {
          throw new Error(`Error creando conversación: ${createError.message}`);
        }
        
        conversationId = newConv[0].id;
        console.log(`✅ Nueva conversación creada: ${conversationId}`);
      }
    } catch (error) {
      console.error(`❌ Error al gestionar conversación: ${error.message}`);
      return;
    }
    
    // 2. Probar cada mensaje
    console.log('\n===== INICIANDO PRUEBAS DE MENSAJES =====');
    
    let successCount = 0;
    let failCount = 0;
    
    for (const [index, test] of testMessages.entries()) {
      console.log(`\n🧪 PRUEBA ${index + 1}: ${test.description}`);
      console.log(`💬 Mensaje: "${test.message}"`);
      
      // Verificar detección
      const detectResult = checkForNotificationPhrases(test.message);
      
      // Evaluar resultado de detección
      if ((detectResult && test.shouldNotify) || (!detectResult && !test.shouldNotify)) {
        console.log(`✅ DETECCIÓN CORRECTA: ${detectResult ? 'Requiere notificación' : 'No requiere notificación'}`);
        successCount++;
      } else {
        console.log(`❌ DETECCIÓN INCORRECTA: ${detectResult ? 'Detectó' : 'No detectó'} pero ${test.shouldNotify ? 'debería' : 'no debería'} notificar`);
        failCount++;
      }
      
      // Si requiere notificación (según detección real), enviar correo
      if (detectResult) {
        const emailResult = await sendEmailNotification(test.message, TEST_PHONE, conversationId);
        console.log(`📧 Envío de correo: ${emailResult ? 'EXITOSO ✅' : 'FALLIDO ❌'}`);
      }
      
      // Breve pausa entre pruebas
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Resumen de pruebas
    console.log('\n===== RESUMEN DE PRUEBAS =====');
    console.log(`✅ Pruebas exitosas: ${successCount} de ${testMessages.length}`);
    console.log(`❌ Pruebas fallidas: ${failCount} de ${testMessages.length}`);
    
    if (failCount === 0) {
      console.log('🎉 TODAS LAS PRUEBAS PASARON EXITOSAMENTE');
    } else {
      console.log('⚠️ ALGUNAS PRUEBAS FALLARON, REVISA LOS LOGS');
    }
    
    console.log(`\n🔍 Verifica tu correo (${process.env.NOTIFICATION_EMAIL || 'joaquinisaza@hotmail.com'}) para las notificaciones enviadas`);
    
  } catch (error) {
    console.error('❌ ERROR GENERAL:', error);
    console.error(error.stack);
  }
}

// Ejecutar las pruebas
runTests(); 