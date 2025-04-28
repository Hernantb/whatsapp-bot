"use client"

import { useState, useEffect } from "react"

// Tipos de actividades que puede realizar el robot
type RobotActivity = "walking" | "waving" | "messaging" | "exercising" | "tired"
// Posiciones desde donde puede aparecer
type EntryPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right"

export function AnimatedRobot() {
  const [visible, setVisible] = useState(false)
  const [activity, setActivity] = useState<RobotActivity>("walking")
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [direction, setDirection] = useState<"left" | "right">("right")
  const [entryPosition, setEntryPosition] = useState<EntryPosition>("bottom-right")
  const [activitySequence, setActivitySequence] = useState<RobotActivity[]>([])
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0)

  // Función para generar una secuencia aleatoria de actividades
  const generateActivitySequence = (): RobotActivity[] => {
    const activities: RobotActivity[] = ["walking", "waving", "messaging", "exercising", "tired"]

    // Barajar el array de actividades
    for (let i = activities.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[activities[i], activities[j]] = [activities[j], activities[i]]
    }

    // Asegurar que "walking" aparezca al menos una vez para moverse
    if (!activities.includes("walking")) {
      activities[0] = "walking"
    }

    return activities
  }

  // Función para determinar una posición inicial aleatoria
  const getRandomEntryPosition = (): EntryPosition => {
    const positions: EntryPosition[] = ["top-left", "top-right", "bottom-left", "bottom-right"]
    return positions[Math.floor(Math.random() * positions.length)]
  }

  // Función para calcular la posición inicial basada en la esquina de entrada
  const calculateInitialPosition = (entry: EntryPosition, windowWidth: number, windowHeight: number) => {
    switch (entry) {
      case "top-left":
        return { x: -100, y: -100, targetX: 100, targetY: 100, newDirection: "right" }
      case "top-right":
        return { x: windowWidth + 100, y: -100, targetX: windowWidth - 200, targetY: 100, newDirection: "left" }
      case "bottom-left":
        return { x: -100, y: windowHeight + 100, targetX: 100, targetY: windowHeight - 200, newDirection: "right" }
      case "bottom-right":
        return {
          x: windowWidth + 100,
          y: windowHeight + 100,
          targetX: windowWidth - 200,
          targetY: windowHeight - 200,
          newDirection: "left",
        }
      default:
        return { x: -100, y: windowHeight - 150, targetX: 100, targetY: windowHeight - 150, newDirection: "right" }
    }
  }

  // Función para mover el robot a través de una secuencia de actividades
  const animateRobot = () => {
    // Generar nueva secuencia de actividades
    const newSequence = generateActivitySequence()
    setActivitySequence(newSequence)
    setCurrentActivityIndex(0)

    // Determinar posición de entrada aleatoria
    const newEntryPosition = getRandomEntryPosition()
    setEntryPosition(newEntryPosition)

    // Calcular posición inicial y objetivo
    const { x, y, targetX, targetY, newDirection } = calculateInitialPosition(
      newEntryPosition,
      window.innerWidth,
      window.innerHeight,
    )

    // Configurar posición inicial y dirección
    setPosition({ x, y })
    setDirection(newDirection as "left" | "right")
    setActivity("walking")
    setVisible(true)

    // Programar la secuencia de actividades
    const totalDuration = 0
    const activityDurations = {
      walking: 3000,
      waving: 2000,
      messaging: 2500,
      exercising: 3000,
      tired: 2500,
    }

    // Función para ejecutar la siguiente actividad en la secuencia
    const executeNextActivity = (index: number) => {
      if (index >= newSequence.length) {
        // Fin de la secuencia, ocultar el robot
        setVisible(false)
        return
      }

      const currentActivity = newSequence[index]
      setActivity(currentActivity)

      // Si es caminar, mover a una nueva posición
      if (currentActivity === "walking") {
        // Calcular una nueva posición aleatoria dentro de los límites visibles
        const newX = Math.random() * (window.innerWidth - 200) + 100
        const newY = Math.random() * (window.innerHeight - 200) + 100

        // Determinar la dirección basada en la nueva posición
        const newDirection = newX > position.x ? "right" : "left"
        setDirection(newDirection)

        // Animar el movimiento
        setTimeout(() => {
          setPosition({ x: newX, y: newY })
        }, 100)
      }

      // Programar la siguiente actividad
      setTimeout(() => {
        executeNextActivity(index + 1)
      }, activityDurations[currentActivity])
    }

    // Iniciar la secuencia de actividades
    setTimeout(() => {
      executeNextActivity(0)
    }, 500)

    // Ocultar el robot después de completar todas las actividades (más un margen)
    const totalSequenceDuration = newSequence.reduce((total, act) => total + activityDurations[act], 0) + 1000
    setTimeout(() => {
      setVisible(false)
    }, totalSequenceDuration)
  }

  useEffect(() => {
    // Mostrar el robot inmediatamente al cargar
    animateRobot()

    // Mostrar el robot cada 20-40 segundos
    const interval = setInterval(
      () => {
        animateRobot()
      },
      Math.random() * 20000 + 20000,
    ) // Entre 20 y 40 segundos

    return () => clearInterval(interval)
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transition: "all 3s ease-in-out",
      }}
    >
      <div className={`cartoon-robot ${activity}`}>
        <div className={`robot-container ${direction}`}>
          {/* Cabeza con antena y orejas */}
          <div className="head">
            <div className="antenna"></div>
            <div className="ear left-ear"></div>
            <div className="ear right-ear"></div>
            <div className="eyes">
              <div className="eye left"></div>
              <div className="eye right"></div>
            </div>
            {/* La boca ha sido eliminada */}
          </div>

          {/* Cuerpo */}
          <div className="body">
            {/* Brazos */}
            <div className="arm left-arm"></div>
            <div className="arm right-arm"></div>

            {/* Piernas */}
            <div className="leg left-leg"></div>
            <div className="leg right-leg"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

