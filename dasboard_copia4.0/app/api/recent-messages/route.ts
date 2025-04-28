import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const conversationId = url.searchParams.get('id');
    
    if (!conversationId) {
      return NextResponse.json({ error: 'Se requiere un ID de conversación' }, { status: 400 });
    }
    
    console.log(`🔍 [RECIENTES] Obteniendo mensajes recientes para: ${conversationId}`);
    
    // Obtener solo los 50 mensajes más recientes
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('❌ [RECIENTES] Error al obtener mensajes:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    console.log(`✅ [RECIENTES] Encontrados ${messages?.length || 0} mensajes recientes`);
    
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
    
    // Invertir para mantener el orden cronológico
    const sortedMessages = transformedMessages.reverse();
    
    console.log(`📤 [RECIENTES] Enviando ${sortedMessages.length} mensajes transformados`);
    return NextResponse.json(sortedMessages);
  } catch (error) {
    console.error('❌ [RECIENTES] Error interno:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
} 