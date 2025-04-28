"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface TimeSavedCounterProps {
  initialHours: number
  initialMinutes: number
  className?: string
}

export function TimeSavedCounter({ initialHours = 0, initialMinutes = 0, className }: TimeSavedCounterProps) {
  const [hours, setHours] = useState(initialHours)
  const [minutes, setMinutes] = useState(initialMinutes)
  const [isIncrementing, setIsIncrementing] = useState(false)

  // Simular incrementos cuando el bot responde
  useEffect(() => {
    // Función para simular cuando el bot responde a un mensaje
    const simulateBotResponse = () => {
      // Incrementar entre 2-5 minutos por respuesta del bot
      const minutesToAdd = Math.floor(Math.random() * 4) + 2

      setIsIncrementing(true)

      // Actualizar minutos
      setMinutes((prev) => {
        const newMinutes = prev + minutesToAdd
        if (newMinutes >= 60) {
          // Si los minutos superan 60, incrementar las horas
          setTimeout(() => {
            setHours((h) => h + Math.floor(newMinutes / 60))
          }, 300)
          return newMinutes % 60
        }
        return newMinutes
      })

      // Restablecer el estado de incremento después de la animación
      setTimeout(() => {
        setIsIncrementing(false)
      }, 2000)
    }

    // Ajustar la frecuencia según la magnitud de las horas iniciales
    const baseInterval =
      initialHours < 10
        ? 8000
        : // Diario: cada ~10 segundos
          initialHours < 50
          ? 15000
          : // Semanal: cada ~18 segundos
            initialHours < 200
            ? 25000
            : // Mensual: cada ~28 segundos
              40000 // Anual: cada ~45 segundos

    const randomVariation = Math.floor(Math.random() * (baseInterval * 0.3))
    const interval = setInterval(simulateBotResponse, baseInterval + randomVariation)

    // Limpiar intervalo al desmontar
    return () => clearInterval(interval)
  }, [initialHours])

  // Agregar este useEffect después del useEffect existente
  useEffect(() => {
    // Actualizar los valores cuando cambien las props
    setHours(initialHours)
    setMinutes(initialMinutes)

    // Mostrar una animación de incremento al cambiar
    setIsIncrementing(true)
    setTimeout(() => {
      setIsIncrementing(false)
    }, 1000)
  }, [initialHours, initialMinutes])

  // Formatear horas y minutos para mostrar
  const formattedHours = hours.toString().padStart(2, "0")
  const formattedMinutes = minutes.toString().padStart(2, "0")

  return (
    <Card className={cn("border-0 shadow-sm", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Tiempo Ahorrado</CardTitle>
          <Clock className="h-5 w-5 text-muted-foreground" />
        </div>
        <CardDescription>Horas ahorradas por automatización</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-6">
          <div className="flex items-center">
            <div className="flex">
              {/* Horas */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div
                    className={cn(
                      "text-5xl font-bold tabular-nums bg-primary-50 dark:bg-primary-900/30 px-4 py-2 rounded-lg transition-all duration-300",
                      isIncrementing && "scale-110",
                    )}
                  >
                    {formattedHours}
                  </div>
                  {isIncrementing && (
                    <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                      +
                    </div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground mt-1">HORAS</span>
              </div>

              <div className="text-4xl font-bold mx-2 self-start mt-2">:</div>

              {/* Minutos */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div
                    className={cn(
                      "text-5xl font-bold tabular-nums bg-primary-50 dark:bg-primary-900/30 px-4 py-2 rounded-lg transition-all duration-300",
                      isIncrementing && "scale-110",
                    )}
                  >
                    {formattedMinutes}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground mt-1">MINUTOS</span>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mt-6 text-center max-w-xs">
            Tiempo estimado ahorrado gracias a respuestas automáticas del bot en este período
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

