import React, { useEffect } from 'react'

interface MinimalChatInterfaceProps {
  businessId?: string;
}

const MinimalChatInterface = ({ businessId }: MinimalChatInterfaceProps) => {
  // Este componente es un placeholder y redirecciona al usuario al componente principal
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // El componente real está en la carpeta components/ del proyecto
      console.log('Redireccionando al componente principal')
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <div className="text-center p-4">
        <h1 className="text-2xl font-bold">Panel de Control WhatsApp</h1>
        <p>Cargando...</p>
      </div>
    </div>
  )
}

export default MinimalChatInterface 