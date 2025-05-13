import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export function useSupabase() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState<Error | null>(null)

  // Función memoizada para verificar la sesión
  const verifySession = useCallback(async () => {
    try {
      setLoading(true)
      console.log('👤 Verificando sesión en useSupabase...')
      
      // Obtener la sesión actual
      const { data: { session }, error } = await supabase.auth.getSession()
      
      // Si hay un error, lanzarlo
      if (error) {
        console.error('❌ Error al obtener la sesión:', error)
        setSessionError(error)
        setUser(null)
        
        // Limpiar localStorage si hay error de sesión
        if (typeof window !== 'undefined') {
          localStorage.removeItem('businessId')
          localStorage.removeItem('userRole')
        }
        
        setLoading(false)
        return null
      }

      // Si no hay sesión, limpiar usuario
      if (!session) {
        console.log('⚠️ No hay sesión activa en useSupabase')
        setUser(null)
        
        // Limpiar localStorage si no hay sesión
        if (typeof window !== 'undefined') {
          localStorage.removeItem('businessId')
          localStorage.removeItem('userRole')
        }
        
        setLoading(false)
        return null
      }

      // Si hay sesión, establecer usuario
      console.log('✅ Sesión encontrada en useSupabase:', session.user.id)
      setUser(session.user)
      
      return session.user
    } catch (error) {
      console.error('❌ Error en verifySession:', error)
      setSessionError(error instanceof Error ? error : new Error('Unknown error'))
      setUser(null)
      
      // Limpiar localStorage si hay error
      if (typeof window !== 'undefined') {
        localStorage.removeItem('businessId')
        localStorage.removeItem('userRole')
      }
      
      setLoading(false)
      return null
    }
  }, [])

  // Efecto para verificar la sesión al inicio
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('🚀 Inicializando autenticación...');
        const user = await verifySession();
        
        if (!user) {
          console.log('⚠️ No se pudo obtener el usuario en initializeAuth');
          setLoading(false);
          
          // Mostrar en consola un mensaje claro para depuración
          console.error('NECESITA INICIAR SESIÓN: Para acceder al dashboard, inicie sesión con un usuario válido');
          return;
        }
        
        // Si hay usuario, verificar business ID en localStorage
        const businessId = await verifyBusinessId(user.id);
        
        if (!businessId) {
          console.error('❌ No se encontró un business ID válido para el usuario:', user.id);
          console.error('ASOCIACIÓN REQUERIDA: El usuario actual no está asociado a ningún negocio en la tabla business_users');
          
          // Limpiar localStorage para evitar usar un ID inválido
          if (typeof window !== 'undefined') {
            localStorage.removeItem('businessId');
            localStorage.removeItem('userRole');
          }
        } else {
          console.log('✅ Todo en orden, usuario autenticado:', user.id, 'con business:', businessId);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('❌ Error en initializeAuth:', error);
        setLoading(false);
      }
    };
    
    // Función para verificar y actualizar business ID
    const verifyBusinessId = async (userId: string) => {
      if (!userId) {
        console.error('❌ verifyBusinessId llamado sin userId');
        return null;
      }
      
      try {
        if (typeof window === 'undefined') return null;
        
        const storedBusinessId = localStorage.getItem('businessId')
        
        if (storedBusinessId) {
          console.log('🔍 Business ID encontrado en localStorage:', storedBusinessId)
          
          // Verificar que el business ID en localStorage sea válido para este usuario
          const { data, error } = await supabase
            .from('business_users')
            .select('business_id, role')
            .eq('user_id', userId)
            .eq('business_id', storedBusinessId)
            .eq('is_active', true)
            .maybeSingle()
            
          if (error) {
            console.error('❌ Error verificando businessId en Supabase:', error)
            await fetchAndStoreBusinessId(userId)
            return null;
          }
          
          if (!data?.business_id) {
            console.warn('⚠️ Business ID en localStorage no es válido para este usuario, obteniendo nuevamente')
            await fetchAndStoreBusinessId(userId)
            return null;
          }
          
          return storedBusinessId;
        } else {
          console.log('⚠️ No hay business ID en localStorage, obteniendo de Supabase')
          return await fetchAndStoreBusinessId(userId)
        }
      } catch (error) {
        console.error('❌ Error en verifyBusinessId:', error)
        return null;
      }
    }
    
    // Función para obtener y guardar business ID
    const fetchAndStoreBusinessId = async (userId: string): Promise<string | null> => {
      if (!userId) {
        console.error('❌ fetchAndStoreBusinessId llamado sin userId');
        return null;
      }
      
      try {
        console.log('🔍 Buscando business_id para usuario:', userId);
        
        const { data, error } = await supabase
          .from('business_users')
          .select('business_id, role')
          .eq('user_id', userId)
          .eq('is_active', true)
          .maybeSingle()
          
        if (error) {
          console.error('❌ Error al obtener business ID:', error)
          return null;
        }
        
        if (data?.business_id) {
          console.log('✅ Business ID obtenido de Supabase:', data.business_id)
          localStorage.setItem('businessId', data.business_id)
          localStorage.setItem('userRole', data.role || 'viewer')
          return data.business_id;
        } else {
          console.error('❌ No se encontró business ID para el usuario:', userId)
          return null;
        }
      } catch (error) {
        console.error('❌ Error en fetchAndStoreBusinessId:', error)
        return null;
      }
    }

    initializeAuth()

    // Suscribirse a cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Cambio en estado de autenticación:', event)
      
      if (event === 'SIGNED_OUT') {
        console.log('Usuario cerró sesión')
        setUser(null)
        
        // Limpiar localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('businessId')
          localStorage.removeItem('userRole')
        }
        setLoading(false)
        return
      }
      
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('Usuario inició sesión:', session.user.id)
        setUser(session.user)
        
        // Obtener business ID
        await fetchAndStoreBusinessId(session.user.id)
        setLoading(false)
        return
      }
      
      // Para otros eventos
      if (session?.user) {
        console.log('Actualizando usuario con sesión:', session.user.id)
        setUser(session.user)
      } else {
        console.log('No hay sesión en cambio de autenticación')
        setUser(null)
      }
      
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [verifySession])

  return { user, loading, sessionError }
} 