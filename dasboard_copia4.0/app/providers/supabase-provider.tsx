'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface SupabaseContextType {
  user: User | null
  loading: boolean
}

export const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined)

// Este proveedor utiliza la misma instancia de Supabase que el resto de la aplicación
// para evitar el error "Multiple GoTrueClient instances"
export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verificar sesión inicial
    const getSession = async () => {
      try {
        console.log("🔄 Provider: verificando sesión inicial...")
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        setUser(session?.user ?? null)
        if (session?.user) {
          console.log("🔄 Provider: sesión encontrada para usuario:", session.user.id)
        } else {
          console.log("🔄 Provider: no se encontró sesión activa")
        }
      } catch (error) {
        console.error('Session check failed:', error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getSession()

    // Suscribirse a cambios de autenticación
    console.log("🔄 Provider: configurando suscripción a cambios de autenticación...")
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
      console.log("🔄 Provider: estado de autenticación actualizado", _event, !!session)
    })

    return () => {
      console.log("🔄 Provider: cancelando suscripción...")
      subscription.unsubscribe()
    }
  }, [])

  return (
    <SupabaseContext.Provider value={{ user, loading }}>
      {children}
    </SupabaseContext.Provider>
  )
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext)
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider')
  }
  return context
} 