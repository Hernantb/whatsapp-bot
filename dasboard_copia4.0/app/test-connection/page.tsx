'use client'

import { useState, useEffect } from 'react'
import { supabase, testSupabaseConnection } from '@/lib/supabase'
import { testDirectLogin } from '@/lib/supabase-direct'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function TestConnection() {
  const [connectionStatus, setConnectionStatus] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginResult, setLoginResult] = useState<any>(null)
  const [directLoginResult, setDirectLoginResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [directLoading, setDirectLoading] = useState(false)

  useEffect(() => {
    // Al cargar la página, probar la conexión
    testConnection()
    
    // Mostrar información de las variables de entorno
    console.log('Variables de entorno cargadas:')
    console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY (primeros 10 caracteres):', 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 10) + '...' : 
      'No disponible')
    console.log('NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL)
  }, [])

  const testConnection = async () => {
    setLoading(true)
    const result = await testSupabaseConnection()
    setConnectionStatus(result)
    setLoading(false)
  }

  const testLogin = async () => {
    try {
      setLoading(true)
      setLoginResult(null)
      
      // Limpiar localStorage antes
      localStorage.clear()
      
      // Intentar iniciar sesión
      console.log('Probando inicio de sesión con:', email)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        setLoginResult({ 
          success: false, 
          error: error.message, 
          details: error 
        })
        return
      }
      
      // Verificar si hay sesión
      if (!data.session) {
        setLoginResult({ 
          success: false, 
          error: 'No se pudo establecer la sesión' 
        })
        return
      }
      
      // Verificar business_id
      const { data: businessData, error: businessError } = await supabase
        .from('business_users')
        .select('business_id, role')
        .eq('user_id', data.session.user.id)
        .eq('is_active', true)
        .maybeSingle()
      
      setLoginResult({ 
        success: true, 
        session: { 
          id: data.session.user.id,
          email: data.session.user.email,
          expires_at: data.session.expires_at
        },
        business: businessData || null,
        businessError: businessError || null
      })
      
    } catch (error: any) {
      setLoginResult({ 
        success: false, 
        error: error.message || 'Error desconocido',
        details: error
      })
    } finally {
      setLoading(false)
    }
  }
  
  const testDirectLoginMethod = async () => {
    setDirectLoading(true)
    setDirectLoginResult(null)
    
    // Limpiar localStorage antes
    localStorage.clear()
    
    const result = await testDirectLogin(email, password)
    setDirectLoginResult(result)
    setDirectLoading(false)
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Prueba de Conexión Supabase</h1>
      
      <div className="mb-8 p-4 border rounded-md">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-semibold">Estado de Conexión</h2>
          <Button onClick={testConnection} disabled={loading}>
            {loading ? 'Probando...' : 'Probar conexión'}
          </Button>
        </div>
        
        {connectionStatus && (
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-48">
            {JSON.stringify(connectionStatus, null, 2)}
          </pre>
        )}
      </div>
      
      <div className="p-4 border rounded-md mb-8">
        <h2 className="text-lg font-semibold mb-4">Prueba de Inicio de Sesión</h2>
        
        <div className="space-y-4 mb-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="correo@ejemplo.com"
            />
          </div>
          
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input 
              id="password" 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="******"
            />
          </div>
          
          <div className="flex space-x-4">
            <Button onClick={testLogin} disabled={loading || !email || !password}>
              {loading ? 'Probando...' : 'Probar con env'}
            </Button>
            
            <Button 
              onClick={testDirectLoginMethod} 
              disabled={directLoading || !email || !password} 
              variant="outline"
            >
              {directLoading ? 'Probando...' : 'Probar con claves directas'}
            </Button>
          </div>
        </div>
        
        {loginResult && (
          <div className="mt-6">
            <h3 className="font-medium mb-2">
              {loginResult.success ? '✅ Inicio de sesión exitoso (env)' : '❌ Error de inicio de sesión (env)'}
            </h3>
            <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-64">
              {JSON.stringify(loginResult, null, 2)}
            </pre>
          </div>
        )}
        
        {directLoginResult && (
          <div className="mt-6">
            <h3 className="font-medium mb-2">
              {directLoginResult.success ? '✅ Inicio de sesión directo exitoso' : '❌ Error de inicio de sesión directo'}
            </h3>
            <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-64">
              {JSON.stringify(directLoginResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
} 