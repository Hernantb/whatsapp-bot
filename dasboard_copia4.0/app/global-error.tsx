'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div className="flex h-screen w-screen items-center justify-center">
          <div className="text-center">
            <h2>Algo salió mal!</h2>
            <button onClick={() => reset()}>
              Intentar de nuevo
            </button>
          </div>
        </div>
      </body>
    </html>
  )
} 