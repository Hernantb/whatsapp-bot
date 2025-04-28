import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializa el cliente de Supabase
const supabase = createClient(
  'https://wscijkxwevgxbgwhbqtm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI'
);

export async function POST(request: Request) {
  try {
    const data = await request.json();
    console.log('🤖 Registrando respuesta del bot:', JSON.stringify(data, null, 2));

    // Extraemos los datos necesarios
    const { conversationId, message, business_id, sender_type = 'agent', metadata } = data;

    if (!conversationId || !message) {
      console.error('❌ Faltan datos requeridos:', { conversationId, message });
      return NextResponse.json(
        { error: 'Faltan datos requeridos (conversationId, message)' },
        { status: 400 }
      );
    }

    // Mantener el valor de sender_type que llega desde el cliente
    // Ahora funciona porque se modificó la restricción en la base de datos
    const finalSenderType = sender_type || 'agent';
    
    // Registrar los metadatos recibidos pero no los usaremos en la inserción
    if (metadata) {
      console.log('📝 Metadatos adicionales recibidos (no se guardarán):', JSON.stringify(metadata));
    }

    // Buscamos la conversación
    console.log('🔍 Buscando conversación con ID de usuario:', conversationId);
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', conversationId)
      .eq('business_id', business_id)
      .single();

    if (convError) {
      console.error('❌ Error buscando conversación:', JSON.stringify(convError, null, 2));
      return NextResponse.json(
        { error: 'Error buscando conversación', details: convError },
        { status: 500 }
      );
    }

    if (!conversation) {
      console.error('❌ No se encontró la conversación para:', { conversationId, business_id });
      return NextResponse.json(
        { error: 'No se encontró la conversación' },
        { status: 404 }
      );
    }

    // Guardamos el mensaje con el tipo de remitente especificado PERO SIN metadatos
    console.log(`📝 Guardando mensaje con sender_type '${finalSenderType}' en conversación:`, conversation.id);
    
    // Creamos el objeto del mensaje sin incluir metadatos
    const messageData = {
      conversation_id: conversation.id,
      content: message,
      sender_type: finalSenderType,
      read: true,
      created_at: new Date().toISOString()
    };
    
    // Insertamos el mensaje en la base de datos
    const { data: savedMessage, error: messageError } = await supabase
      .from('messages')
      .insert([messageData])
      .select();

    if (messageError) {
      console.error('❌ Error guardando mensaje:', JSON.stringify(messageError, null, 2));
      return NextResponse.json(
        { error: 'Error guardando mensaje', details: messageError },
        { status: 500 }
      );
    }

    // Actualizamos la conversación con el último mensaje
    console.log('📝 Actualizando último mensaje de la conversación...');
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        last_message: message,
        last_message_time: new Date().toISOString()
      })
      .eq('id', conversation.id);

    if (updateError) {
      console.error('❌ Error actualizando conversación:', JSON.stringify(updateError, null, 2));
      // No devolvemos error, ya que el mensaje se guardó correctamente
      console.warn('⚠️ La conversación no pudo ser actualizada, pero el mensaje se guardó');
    }

    console.log('✅ Respuesta registrada correctamente');
    return NextResponse.json({ 
      success: true,
      message_id: savedMessage ? savedMessage[0]?.id : null,
      sender_type: finalSenderType
    });
  } catch (error) {
    console.error('Error en endpoint /api/register-bot-response:', error);
    return NextResponse.json(
      { error: 'Error procesando la solicitud' },
      { status: 500 }
    );
  }
} 