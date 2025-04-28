import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  
  try {
    console.log('[login-redirect] Verificando sesión...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('[login-redirect] Error obteniendo sesión:', sessionError);
      return NextResponse.json({ 
        authenticated: false,
        message: 'Error al obtener sesión',
        error: sessionError.message
      }, { status: 401 });
    }
    
    if (!session) {
      console.log('[login-redirect] No hay sesión activa');
      return NextResponse.json({ 
        authenticated: false,
        message: 'No session found, redirect to login'
      }, { status: 401 });
    }
    
    console.log(`[login-redirect] Sesión encontrada para usuario ${session.user.id}`);
    
    // Verificar si el usuario tiene acceso al negocio
    console.log(`[login-redirect] Verificando acceso a negocio para usuario ${session.user.id}...`);
    
    const { data, error } = await supabase
      .from('business_users')
      .select('business_id, role')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .maybeSingle();
    
    console.log('[login-redirect] Resultado de consulta business_users:', JSON.stringify({ data, error }));
      
    if (error) {
      console.error('[login-redirect] Error consultando business_users:', error);
      return NextResponse.json({ 
        authenticated: false,
        message: 'Error verificando acceso a negocio',
        error: error.message
      }, { status: 403 });
    }
    
    if (!data || !data.business_id) {
      console.error(`[login-redirect] No se encontró acceso a negocio para el usuario ${session.user.id}`);
      
      // Buscar si hay algún negocio disponible como fallback solo para diagnóstico
      const { data: allBusinesses, error: allBizError } = await supabase
        .from('businesses')
        .select('id, name')
        .limit(5);
        
      if (!allBizError && allBusinesses && allBusinesses.length > 0) {
        console.log('[login-redirect] Negocios disponibles en la base de datos:', 
          JSON.stringify(allBusinesses.map(b => ({ id: b.id, name: b.name })))
        );
      } else {
        console.log('[login-redirect] No hay negocios disponibles en la base de datos');
      }
      
      return NextResponse.json({ 
        authenticated: false,
        message: 'No business access found, redirect to login'
      }, { status: 403 });
    }
    
    console.log(`[login-redirect] Acceso verificado a negocio ${data.business_id} con rol ${data.role || 'sin rol'}`);
    
    return NextResponse.json({ 
      authenticated: true,
      userId: session.user.id,
      businessId: data.business_id,
      userRole: data.role || 'viewer',
      message: 'User is authenticated and has business access'
    }, { status: 200 });
    
  } catch (unexpectedError) {
    console.error('[login-redirect] Error inesperado:', unexpectedError);
    return NextResponse.json({ 
      authenticated: false,
      message: 'Error inesperado verificando sesión',
      error: unexpectedError instanceof Error ? unexpectedError.message : 'Unknown error'
    }, { status: 500 });
  }
} 