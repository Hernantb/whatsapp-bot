/**
 * Módulo para procesar mensajes con OpenAI usando configuración por negocio
 */

const OpenAI = require('openai');
const axios = require('axios');
const { checkCalendarAvailability, createCalendarEvent } = require('./calendar-functions');

/**
 * Procesa un mensaje del usuario con OpenAI y envía la respuesta
 * @param {string} sender Número de teléfono del remitente
 * @param {string} message Mensaje del usuario
 * @param {string} conversationId ID de la conversación
 * @param {Object} businessConfig Configuración del negocio
 * @param {Function} sendWhatsAppResponse Función para enviar respuestas por WhatsApp
 * @param {Function} registerBotResponse Función para registrar respuestas del bot
 * @returns {Promise<Object>} Resultado de la operación
 */
async function processMessageWithOpenAI(
  sender,
  message,
  conversationId,
  businessConfig,
  sendWhatsAppResponse,
  registerBotResponse
) {
  try {
    console.log(`🧠 Procesando mensaje con OpenAI para negocio: ${businessConfig.business_name}`);
    
    // Usar configuración específica del negocio
    const OPENAI_API_KEY = businessConfig.openai_api_key;
    const ASSISTANT_ID = businessConfig.openai_assistant_id;
    const VECTOR_STORE_ID = businessConfig.vector_store_id;
    const SYSTEM_PROMPT = businessConfig.system_prompt;
    const BUSINESS_ID = businessConfig.id;
    
    console.log(`🔑 Usando asistente ID: ${ASSISTANT_ID}`);
    if (VECTOR_STORE_ID) {
      console.log(`📚 Usando Vector Store ID: ${VECTOR_STORE_ID}`);
    }
    
    // Inicializar OpenAI con la clave específica del negocio
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });
    
    // Verificar thread existente o crear uno nuevo para este usuario
    let threadId = null;
    
    // Si existe una caché global de threads, úsala
    if (global.userThreads && global.userThreads[sender]) {
      threadId = global.userThreads[sender];
      console.log(`📂 Usando thread existente: ${threadId}`);
    } else {
      // Crear un nuevo thread
      console.log(`📝 Creando nuevo thread para ${sender}`);
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
      
      // Guardar thread en caché global si existe
      if (global.userThreads) {
        global.userThreads[sender] = threadId;
        console.log(`📂 Thread guardado en caché: ${threadId}`);
      }
    }
    
    // Añadir el mensaje del usuario al thread
    console.log(`➕ Añadiendo mensaje del usuario: "${message}" al thread ${threadId}`);
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message
    });
    
    // Ejecutar el asistente
    console.log(`🏃‍♂️ Ejecutando asistente ${ASSISTANT_ID} para thread ${threadId}`);
    
    // Configurar opciones de ejecución
    const runOptions = {
      assistant_id: ASSISTANT_ID,
      instructions: SYSTEM_PROMPT
    };
    
    // Añadir referencia al Vector Store si está disponible
    if (VECTOR_STORE_ID) {
      runOptions.tools = runOptions.tools || [];
      runOptions.tools.push({
        type: "retrieval"
      });
      
      // Incluir el Vector Store específico
      runOptions.tool_resources = {
        retrieval: {
          vector_store_ids: [VECTOR_STORE_ID]
        }
      };
      
      console.log(`🔍 Habilitando herramienta de búsqueda en Vector Store: ${VECTOR_STORE_ID}`);
    }
    
    // Agregar herramientas para el manejo de calendario
    runOptions.tools = runOptions.tools || [];
    runOptions.tools.push({
      type: "function",
      function: {
        name: "check_calendar_availability",
        description: "Consulta la disponibilidad en el calendario para una fecha o rango de fechas específico",
        parameters: {
          type: "object",
          properties: {
            date: {
              type: "string",
              description: "Fecha específica en formato YYYY-MM-DD para consultar disponibilidad"
            },
            start_date: {
              type: "string",
              description: "Fecha de inicio en formato YYYY-MM-DD (opcional, para rango de fechas)"
            },
            end_date: {
              type: "string",
              description: "Fecha final en formato YYYY-MM-DD (opcional, para rango de fechas)"
            },
            timeMin: {
              type: "string",
              description: "Hora y fecha mínima en formato ISO (opcional, para rango específico)"
            },
            timeMax: {
              type: "string",
              description: "Hora y fecha máxima en formato ISO (opcional, para rango específico)"
            }
          },
          required: []
        }
      }
    });
    
    runOptions.tools.push({
      type: "function",
      function: {
        name: "create_calendar_event",
        description: "Crea un evento en el calendario del negocio",
        parameters: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Título o asunto del evento"
            },
            description: {
              type: "string",
              description: "Descripción detallada del evento"
            },
            start: {
              type: "string",
              description: "Fecha y hora de inicio en formato ISO 8601 (YYYY-MM-DDTHH:MM:SS)"
            },
            end: {
              type: "string",
              description: "Fecha y hora de fin en formato ISO 8601 (YYYY-MM-DDTHH:MM:SS)"
            },
            location: {
              type: "string",
              description: "Ubicación del evento (opcional)"
            },
            attendees: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  email: {
                    type: "string",
                    description: "Correo electrónico del asistente"
                  }
                }
              },
              description: "Lista de asistentes al evento (opcional)"
            }
          },
          required: ["title", "start", "end"]
        }
      }
    });
    
    console.log(`🔍 Habilitando herramientas de Google Calendar para el asistente`);
    
    const run = await openai.beta.threads.runs.create(threadId, runOptions);
    
    // Esperar a que el asistente termine
    console.log(`⏳ Esperando respuesta del asistente (run ${run.id})...`);
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    
    // Esperar hasta que el run esté completo, fallido o cancelado
    while (runStatus.status !== "completed" && 
           runStatus.status !== "failed" && 
           runStatus.status !== "cancelled") {
      
      // Esperar un segundo
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verificar el estado actual
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      console.log(`🔄 Estado actual: ${runStatus.status}`);
      
      // Si requiere acción, procesarla
      if (runStatus.status === "requires_action") {
        console.log("🔧 El asistente requiere acción - procesando llamadas a funciones");
        
        // Procesar las llamadas a funciones
        const toolCalls = runStatus.required_action.submit_tool_outputs.tool_calls;
        const toolOutputs = [];
        
        for (const toolCall of toolCalls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          
          console.log(`🔧 Llamada a función: ${functionName}`, functionArgs);
          
          let functionResult;
          try {
            // Ejecutar la función correspondiente
            if (functionName === "check_calendar_availability") {
              functionResult = await checkCalendarAvailability(BUSINESS_ID, functionArgs);
            } else if (functionName === "create_calendar_event") {
              functionResult = await createCalendarEvent(BUSINESS_ID, functionArgs);
            } else {
              console.warn(`⚠️ Función desconocida: ${functionName}`);
              functionResult = { error: "Función no implementada" };
            }
            
            console.log(`✅ Resultado de la función:`, functionResult);
          } catch (functionError) {
            console.error(`❌ Error en función ${functionName}:`, functionError);
            functionResult = { error: functionError.message };
          }
          
          // Añadir el resultado al array de salidas
          toolOutputs.push({
            tool_call_id: toolCall.id,
            output: JSON.stringify(functionResult)
          });
        }
        
        // Enviar los resultados de las funciones al asistente
        await openai.beta.threads.runs.submitToolOutputs(threadId, run.id, {
          tool_outputs: toolOutputs
        });
      }
    }
    
    // Verificar si el run fue exitoso
    if (runStatus.status !== "completed") {
      console.error(`❌ Ejecución fallida: ${runStatus.status}`);
      throw new Error(`Ejecución fallida: ${runStatus.status}`);
    }
    
    // Obtener los mensajes del thread (respuestas del asistente)
    const messages = await openai.beta.threads.messages.list(threadId);
    
    // Encontrar el mensaje más reciente del asistente
    const assistantMessages = messages.data
      .filter(msg => msg.role === "assistant")
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    if (assistantMessages.length === 0) {
      console.error("❌ No se encontraron respuestas del asistente");
      throw new Error("No se encontraron respuestas del asistente");
    }
    
    // Obtener el contenido del primer mensaje del asistente (el más reciente)
    const responseMessage = assistantMessages[0];
    
    // Extraer el texto de la respuesta
    let responseText = "";
    for (const content of responseMessage.content) {
      if (content.type === "text") {
        responseText += content.text.value;
      }
    }
    
    console.log(`✅ Respuesta obtenida: "${responseText.substring(0, 100)}..."`);
    
    // Enviar la respuesta por WhatsApp
    console.log(`📱 Enviando respuesta a ${sender}`);
    await sendWhatsAppResponse(sender, responseText, businessConfig);
    
    // Registrar la respuesta en la base de datos
    console.log(`💾 Registrando respuesta en base de datos...`);
    if (conversationId) {
      await registerBotResponse(conversationId, responseText, BUSINESS_ID);
      console.log(`✅ Respuesta registrada para conversación ${conversationId}`);
    } else {
      console.warn(`⚠️ No se pudo registrar la respuesta (conversationId no disponible)`);
    }
    
    return {
      success: true,
      response: responseText
    };
    
  } catch (error) {
    console.error(`❌ Error procesando mensaje con OpenAI: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = processMessageWithOpenAI; 