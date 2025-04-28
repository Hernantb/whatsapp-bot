"use client"

import { useState, useEffect } from "react"
import { Bot } from "lucide-react"
import { cn } from "@/lib/utils"

export function TiredRobot() {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<"top-left" | "top-right" | "bottom-left" | "bottom-right">("bottom-right")

  useEffect(() => {
    // Función para mostrar el robot aleatoriamente
    const showRobot = () => {
      // Determinar una posición aleatoria
      const positions: ["top-left", "top-right", "bottom-left", "bottom-right"] = [
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
      ]
      const randomPosition = positions[Math.floor(Math.random() * positions.length)]

      setPosition(randomPosition)
      setVisible(true)

      // Ocultar después de 5 segundos
      setTimeout(() => {
        setVisible(false)
      }, 5000)
    }

    // Mostrar el robot cada 30-60 segundos
    const interval = setInterval(
      () => {
        // 50% de probabilidad de mostrar el robot
        if (Math.random() > 0.5) {
          showRobot()
        }
      },
      Math.random() * 30000 + 30000,
    ) // Entre 30 y 60 segundos

    // Mostrar el robot una vez al inicio después de 5 segundos
    const initialTimeout = setTimeout(showRobot, 5000)

    return () => {
      clearInterval(interval)
      clearTimeout(initialTimeout)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className={cn(
        "fixed z-50 flex items-center gap-2 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg animate-bounce",
        position === "top-left" && "top-4 left-4",
        position === "top-right" && "top-4 right-4",
        position === "bottom-left" && "bottom-4 left-4",
        position === "bottom-right" && "bottom-4 right-4",
      )}
    >
      <div className="relative">
        <Bot className="h-8 w-8 text-primary-600 animate-pulse" />
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
      </div>
      <div className="text-sm">
        <p className="font-medium dark:text-white">¡Estoy cansado!</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">Demasiados mensajes por procesar...</p>
      </div>
    </div>
  )
}

