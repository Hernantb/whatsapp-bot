'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Error:', error)
  }, [error])

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div className="text-center">
        <h2>Algo salió mal!</h2>
        <button
          onClick={() => reset()}
        >
          Intentar de nuevo
        </button>
      </div>
    </div>
  )
} 