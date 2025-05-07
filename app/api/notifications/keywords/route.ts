import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Obtener todas las palabras clave
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    const businessId = url.searchParams.get('business_id');
    
    // Aquí se debería validar la autenticación del usuario
    
    let query = supabase
      .from('notification_keywords')
      .select('*');
    
    // Filtrar por usuario o negocio si se proporcionan
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    if (businessId) {
      query = query.eq('business_id', businessId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error al obtener palabras clave:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Error al obtener palabras clave',
          details: error.message 
        }, 
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      keywords: data
    });
  } catch (error: any) {
    console.error('Error inesperado:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor',
        details: error.message 
      }, 
      { status: 500 }
    );
  }
}

// Crear una nueva palabra clave
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { keyword, user_id, business_id, enabled = true } = body;
    
    if (!keyword) {
      return NextResponse.json(
        { success: false, error: 'La palabra clave es obligatoria' }, 
        { status: 400 }
      );
    }
    
    // Aquí se debería validar la autenticación del usuario
    
    const { data, error } = await supabase
      .from('notification_keywords')
      .insert([
        { 
          keyword, 
          user_id, 
          business_id,
          enabled 
        }
      ])
      .select()
      .single();
    
    if (error) {
      console.error('Error al crear palabra clave:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Error al crear la palabra clave',
          details: error.message 
        }, 
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      keyword: data
    });
  } catch (error: any) {
    console.error('Error inesperado:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor',
        details: error.message 
      }, 
      { status: 500 }
    );
  }
}

// Actualizar una palabra clave existente
export async function PATCH(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Se requiere el ID de la palabra clave' }, 
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { keyword, enabled } = body;
    
    // Verificar que al menos un campo para actualizar fue proporcionado
    if (keyword === undefined && enabled === undefined) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionaron datos para actualizar' }, 
        { status: 400 }
      );
    }
    
    // Aquí se debería validar la autenticación del usuario
    
    // Construir objeto de actualización con solo los campos proporcionados
    const updateData: {keyword?: string, enabled?: boolean} = {};
    if (keyword !== undefined) updateData.keyword = keyword;
    if (enabled !== undefined) updateData.enabled = enabled;
    
    const { data, error } = await supabase
      .from('notification_keywords')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error al actualizar palabra clave:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Error al actualizar la palabra clave',
          details: error.message 
        }, 
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      keyword: data
    });
  } catch (error: any) {
    console.error('Error inesperado:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor',
        details: error.message 
      }, 
      { status: 500 }
    );
  }
}

// Eliminar una palabra clave
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Se requiere el ID de la palabra clave' }, 
        { status: 400 }
      );
    }
    
    // Aquí se debería validar la autenticación del usuario
    
    const { error } = await supabase
      .from('notification_keywords')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error al eliminar palabra clave:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Error al eliminar la palabra clave',
          details: error.message 
        }, 
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true
    });
  } catch (error: any) {
    console.error('Error inesperado:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor',
        details: error.message 
      }, 
      { status: 500 }
    );
  }
} 