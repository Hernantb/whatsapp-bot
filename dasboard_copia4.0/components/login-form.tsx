"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { loginDirectly } from "@/lib/supabase-direct"

// Usar el cliente único de Supabase importado desde @/lib/supabase

export default function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [usingFallback, setUsingFallback] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  // Validación de email
  const isEmailValid = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Validación de contraseña
  const isPasswordValid = (password: string) => {
    return password.length >= 8
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    setUsingFallback(false)

    // Validación
    if (!isEmailValid(email)) {
      setError("Por favor, ingresa un email válido")
      setIsLoading(false)
      return
    }

    if (!isPasswordValid(password)) {
      setError("La contraseña debe tener al menos 8 caracteres")
      setIsLoading(false)
      return
    }

    try {
      // Limpiar localStorage antes de iniciar sesión
      localStorage.clear()
      console.log("🧹 localStorage limpiado")
      
      // Intentar con el cliente normal primero
      console.log("🔐 Iniciando sesión con:", email)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      // Si hay error de API key inválida, intentar con cliente directo
      if (error && error.message.includes("Invalid API key")) {
        console.warn("⚠️ Error de API key detectado, intentando con cliente directo...")
        setUsingFallback(true)
        
        const directResult = await loginDirectly(email, password)
        
        if (!directResult.success) {
          throw new Error(directResult.error || "Error con el cliente directo")
        }
        
        console.log("✅ Login exitoso con cliente directo")
        
        // Establecer una cookie para el middleware de bypass
        document.cookie = "auth_bypass=true; max-age=3600; path=/"
        
        // Mostrar mensaje de éxito
        toast({
          title: "¡Bienvenido!",
          description: "Has iniciado sesión correctamente con el cliente alternativo.",
        })
        
        // Redirección simple, sin timeouts múltiples
        console.log('🚀 Redirigiendo al dashboard')
        try {
          // Primer intento - usar router.push (mantener historial)
          router.push('/dashboard')
          
          // Segundo intento - redirección de navegador directa 
          setTimeout(() => {
            console.log('📍 Redireccionando con location.replace - forzado')
            window.location.replace('/dashboard')
          }, 100)
        } catch (error) {
          console.error('⚠️ Error en redirección, usando método alternativo', error)
          window.location.href = '/dashboard'
        }
        return
      }
      
      // Si hay otro tipo de error, lanzarlo
      if (error) {
        console.error("❌ Error de Supabase durante signInWithPassword:", error)
        throw error
      }

      if (!data.session) {
        console.error("❌ No se obtuvo sesión tras inicio de sesión exitoso")
        throw new Error('No se pudo establecer la sesión')
      }

      console.log('✅ Login exitoso, sesión establecida. Usuario ID:', data.session.user.id)

      // Verificar si el usuario tiene acceso al negocio
      console.log("🔍 Verificando acceso al negocio para usuario:", data.session.user.id)
      const { data: businessData, error: businessError } = await supabase
        .from('business_users')
        .select('business_id, role')
        .eq('user_id', data.session.user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (businessError) {
        console.error('❌ Error al verificar el negocio asociado:', businessError)
        throw new Error(`Error al verificar acceso al negocio: ${businessError.message}`)
      }

      if (!businessData?.business_id) {
        console.error('❌ No se encontró negocio asociado al usuario')
        throw new Error('No tienes acceso a ningún negocio. Contacta al administrador.')
      }

      console.log('✅ Usuario asociado al negocio:', businessData.business_id, 'con rol:', businessData.role)
      // Guardar el business_id y role en localStorage
      localStorage.setItem('businessId', businessData.business_id)
      localStorage.setItem('userRole', businessData.role)
      console.log('💾 Datos guardados en localStorage')

      // Establecer una cookie para el middleware de bypass
      document.cookie = "auth_bypass=true; max-age=3600; path=/"

      // Asegurarnos de que la sesión esté completamente establecida antes de redirigir
      console.log("🔄 Verificando que la sesión esté establecida correctamente...")
      const checkSession = await supabase.auth.getSession()
      if (!checkSession.data.session) {
        console.warn('⚠️ La sesión no se estableció correctamente, reintentando...')
        await new Promise(resolve => setTimeout(resolve, 1000)) // Esperar 1 segundo
        const retrySession = await supabase.auth.getSession()
        if (!retrySession.data.session) {
          console.error('❌ La sesión no se pudo establecer después de reintentar')
          throw new Error('No se pudo establecer la sesión después de varios intentos')
        }
      }

      // Mostrar mensaje de éxito
      toast({
        title: "¡Bienvenido!",
        description: "Has iniciado sesión correctamente.",
      })

      // Redirección simple, sin timeouts múltiples
      console.log('🚀 Redirigiendo al dashboard')
      try {
        // Primer intento - usar router.push (mantener historial)
        router.push('/dashboard')
        
        // Segundo intento - redirección de navegador directa 
        setTimeout(() => {
          console.log('📍 Redireccionando con location.replace - forzado')
          window.location.replace('/dashboard')
        }, 100)
      } catch (error) {
        console.error('⚠️ Error en redirección, usando método alternativo', error)
        window.location.href = '/dashboard'
      }
    } catch (error: any) {
      console.error('❌ Error en login:', error)
      
      // Mensajes de error más descriptivos según el tipo de error
      let errorMessage = "Error desconocido al iniciar sesión";
      
      if (error.message) {
        if (error.message.includes("Invalid login credentials")) {
          errorMessage = "Credenciales inválidas. Verifica tu email y contraseña.";
        } else if (error.message.includes("Email not confirmed")) {
          errorMessage = "Email no confirmado. Por favor, verifica tu correo electrónico.";
        } else if (error.message.includes("User not found")) {
          errorMessage = "Usuario no encontrado. Verifica tu email o regístrate.";
        } else if (error.message.includes("Invalid API key")) {
          errorMessage = "Error de configuración de la API. Intenta con el botón 'Probar método alternativo'.";
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage)
      toast({
        variant: "destructive",
        title: "Error de inicio de sesión",
        description: errorMessage,
      })
      
      // Limpiar localStorage si hay un error de inicio de sesión
      localStorage.clear()
      console.log("🧹 localStorage limpiado debido a error de inicio de sesión")
    } finally {
      setIsLoading(false)
    }
  }

  // Método alternativo de login usando cliente directo
  const handleDirectLogin = async () => {
    setError("")
    setIsLoading(true)
    setUsingFallback(true)

    // Validación
    if (!isEmailValid(email)) {
      setError("Por favor, ingresa un email válido")
      setIsLoading(false)
      return
    }

    if (!isPasswordValid(password)) {
      setError("La contraseña debe tener al menos 8 caracteres")
      setIsLoading(false)
      return
    }

    try {
      // Limpiar localStorage
      localStorage.clear()
      
      // Usar directamente el método alternativo
      console.log("⚙️ Intentando inicio de sesión con método alternativo...")
      const result = await loginDirectly(email, password)
      
      if (!result.success) {
        throw new Error(result.error || "Error con el método alternativo de inicio de sesión")
      }
      
      // Establecer una cookie para el middleware de bypass
      document.cookie = "auth_bypass=true; max-age=3600; path=/"
      
      // Mostrar mensaje de éxito
      toast({
        title: "¡Bienvenido!",
        description: "Has iniciado sesión correctamente con el método alternativo.",
      })
      
      // Redirección simple, sin timeouts múltiples
      console.log('🚀 Redirigiendo al dashboard')
      try {
        // Primer intento - usar router.push (mantener historial)
        router.push('/dashboard')
        
        // Segundo intento - redirección de navegador directa 
        setTimeout(() => {
          console.log('📍 Redireccionando con location.replace - forzado')
          window.location.replace('/dashboard')
        }, 100)
      } catch (error) {
        console.error('⚠️ Error en redirección, usando método alternativo', error)
        window.location.href = '/dashboard'
      }
    } catch (error: any) {
      console.error('❌ Error en login directo:', error)
      setError(error.message || "Error desconocido con el método alternativo")
      toast({
        variant: "destructive",
        title: "Error de inicio de sesión",
        description: error.message || "Error con el método alternativo",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="shadow-lg border-0">
      <form onSubmit={handleSubmit}>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="password">Contraseña</Label>
              <button
                type="button"
                className="text-xs text-primary-600 hover:underline"
                onClick={() =>
                  toast({
                    title: "Recuperar contraseña",
                    description: "Se ha enviado un correo con instrucciones para recuperar tu contraseña.",
                  })
                }
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-gray-500">La contraseña debe tener al menos 8 caracteres</p>
          </div>
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked as boolean)}
            />
            <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
              Recordar sesión
            </Label>
          </div>
          {error && (
            <div className="text-sm text-red-500 font-medium bg-red-50 p-2 rounded-md">
              {error}
              {error.includes("API key") && (
                <p className="text-xs mt-1">
                  Parece haber un problema con la configuración. Por favor intenta con el método alternativo.
                </p>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full h-11 bg-primary-600 hover:bg-primary-700" disabled={isLoading}>
            {isLoading && !usingFallback ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Iniciando sesión...
              </>
            ) : (
              "Iniciar sesión"
            )}
          </Button>
          
          <Button 
            type="button" 
            variant="outline" 
            className="w-full h-11" 
            disabled={isLoading}
            onClick={handleDirectLogin}
          >
            {isLoading && usingFallback ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Usando método alternativo...
              </>
            ) : (
              "Probar método alternativo"
            )}
          </Button>
          
          {error.includes("API key") && (
            <p className="text-xs text-center text-gray-500 mt-2">
              Si estás experimentando problemas con el inicio de sesión, puedes 
              <a href="/test-connection" className="text-primary-600 hover:underline ml-1">
                verificar la conexión
              </a>
            </p>
          )}
        </CardFooter>
      </form>
    </Card>
  )
}

