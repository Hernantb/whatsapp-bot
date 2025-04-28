import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { conversationId, content, businessId } = await req.json();

    if (!conversationId || !content) {
      return NextResponse.json(
        { error: "Se requiere conversationId y content" },
        { status: 400 }
      );
    }

    // Crear cliente Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );

    // Obtener el timestamp actual y usarlo consistentemente
    const currentTimestamp = new Date().toISOString();

    // Insertar mensaje
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert([
        {
          conversation_id: conversationId,
          content,
          sender_type: "system",
          created_at: currentTimestamp,
        },
      ])
      .select()
      .single();

    if (messageError) {
      console.error("Error al insertar mensaje:", messageError);
      return NextResponse.json(
        { error: "Error al insertar mensaje" },
        { status: 500 }
      );
    }

    // Actualizar última actividad en la conversación
    const { error: updateError } = await supabase
      .from("conversations")
      .update({
        last_message: content,
        last_message_time: currentTimestamp,
      })
      .eq("id", conversationId);

    if (updateError) {
      console.error("Error al actualizar conversación:", updateError);
      return NextResponse.json(
        { error: "Error al actualizar conversación" },
        { status: 500 }
      );
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error("Error en la API:", error);
    return NextResponse.json(
      { error: "Error del servidor" },
      { status: 500 }
    );
  }
} 