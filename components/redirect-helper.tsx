"use client"

import { useEffect, useState } from "react"

interface RedirectHelperProps {
  to: string
  delay?: number
}

/**
 * Componente de redirección forzada
 * Este componente intenta redireccionar usando múltiples métodos para garantizar
 * que la redirección ocurra incluso si hay problemas con router.push
 */
export default function RedirectHelper({ to, delay = 500 }: RedirectHelperProps) {
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    console.log(`🔀 RedirectHelper: Iniciando redirección a ${to} en ${delay}ms...`)
    
    // Primer método: setTimeout + window.location.href
    const timeoutId = setTimeout(() => {
      console.log(`🔀 RedirectHelper: Redirigiendo a ${to} con window.location.href`)
      window.location.href = to
    }, delay)
    
    // Segundo método: usar un contador y window.location.replace
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        const newValue = prev - 1
        if (newValue <= 0) {
          console.log(`🔀 RedirectHelper: Redirigiendo a ${to} con window.location.replace`)
          window.location.replace(to)
          clearInterval(countdownInterval)
        }
        return newValue
      })
    }, 1000)
    
    return () => {
      clearTimeout(timeoutId)
      clearInterval(countdownInterval)
    }
  }, [to, delay])
  
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-90 z-50">
      <div className="text-center p-6 bg-white rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-2">Redireccionando...</h2>
        <p className="mb-4">
          Serás redirigido al panel de control en <span className="font-bold">{countdown}</span> segundos.
        </p>
        <div className="w-full h-2 bg-gray-200 rounded-full">
          <div 
            className="h-full bg-primary rounded-full" 
            style={{
              width: `${Math.max(0, (3 - countdown) / 3 * 100)}%`,
              transition: 'width 1s linear'
            }}
          />
        </div>
        <button 
          onClick={() => window.location.href = to} 
          className="mt-4 px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
        >
          Ir ahora
        </button>
      </div>
    </div>
  )
} 