import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Endpoint para obtener todos los mensajes de una conversación específica
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`🔍 Obteniendo mensajes para conversación: ${params.id}`);
    
    // Modificado para obtener los mensajes más recientes primero con límite de 50
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', params.id)
      .order('created_at', { ascending: false }) // Obtener los más recientes primero
      .limit(50); // Limitar a 50 mensajes recientes
    
    if (error) {
      console.error('❌ Error al obtener mensajes:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    console.log(`✅ Encontrados ${messages?.length || 0} mensajes para la conversación ${params.id}`);
    
    // Transformar los mensajes para la UI
    const transformedMessages = messages.map(msg => ({
      id: msg.id,
      conversationId: msg.conversation_id,
      content: msg.content || '',
      timestamp: msg.created_at,
      status: 'sent',
      sender: msg.sender_type === 'user' ? 'them' : 'me',
      type: 'text'
    }));
    
    // Invertir el orden para mostrarlos cronológicamente en el UI
    const sortedMessages = transformedMessages.reverse();
    
    console.log(`📤 Enviando ${sortedMessages.length} mensajes transformados`);
    return NextResponse.json(sortedMessages);
  } catch (error) {
    console.error('❌ Error en GET /api/messages/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
} 