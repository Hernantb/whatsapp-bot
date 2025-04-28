"use client"

import React from "react"
import Link from "next/link"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      // Verificar si hay una sesión activa
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        // Si hay sesión, redirigir al dashboard
        router.push('/dashboard')
      } else {
        // Si no hay sesión, redirigir a login
        router.push('/login')
      }
    }
    
    checkSession()
  }, [router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary-50 to-white p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold">AI CHATS</h1>
        <p className="mt-4 text-xl">Cargando...</p>
        <div className="mt-8 animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
      </div>
    </div>
  )
}

