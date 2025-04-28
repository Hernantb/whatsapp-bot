import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversationId = params.id;
    console.log(`🔄 Recibida solicitud PATCH para conversación: ${conversationId}`);
    
    if (!conversationId) {
      console.error('❌ ID de conversación no proporcionado');
      return NextResponse.json(
        { error: 'ID de conversación no proporcionado' },
        { status: 400 }
      );
    }

    // Parsear el cuerpo de la solicitud
    const updates = await request.json();
    console.log(`📝 Actualizaciones solicitadas:`, updates);
    
    // Validar los campos actualizables
    const allowedFields = ['tag', 'user_category', 'is_bot_active', 'unread_count'];
    const filteredUpdates: Record<string, any> = {};
    
    // Solo permitir campos específicos para actualizar
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }
    
    if (Object.keys(filteredUpdates).length === 0) {
      console.error('❌ No se proporcionaron campos válidos para actualizar');
      return NextResponse.json(
        { error: 'No se proporcionaron campos válidos para actualizar' },
        { status: 400 }
      );
    }

    console.log(`📝 Campos filtrados para actualizar:`, filteredUpdates);

    // Actualizar la conversación en Supabase
    const { data, error } = await supabase
      .from('conversations')
      .update(filteredUpdates)
      .eq('id', conversationId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error al actualizar conversación en Supabase:', error);
      return NextResponse.json(
        { error: 'Error al actualizar la conversación', details: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ Conversación actualizada exitosamente:`, data);

    // Mensaje personalizado según la actualización realizada
    let successMessage = 'Conversación actualizada exitosamente';
    if (filteredUpdates.user_category !== undefined) {
      if (filteredUpdates.user_category === 'important') {
        successMessage = 'Conversación marcada como importante';
      } else if (filteredUpdates.user_category === 'default') {
        successMessage = 'Conversación movida a Todos';
      }
    }

    return NextResponse.json({ 
      message: successMessage, 
      conversation: data 
    });
  } catch (error: any) {
    console.error('❌ Error en el endpoint PATCH /api/conversations/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error?.message || 'Error desconocido' },
      { status: 500 }
    );
  }
} 