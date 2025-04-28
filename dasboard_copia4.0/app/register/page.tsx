import type { Metadata } from "next"
import RegisterForm from "@/components/register-form"
import { getServerSession } from "@/lib/auth"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Registro | Chat Control Panel",
  description: "Regístrate para acceder al panel de chat",
}

export default async function RegisterPage() {
  const session = await getServerSession()

  // Si el usuario ya está autenticado, redirigir al dashboard
  if (session) {
    redirect("/dashboard")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Chat Control Panel</h1>
          <p className="mt-2 text-muted-foreground">Crea una cuenta para acceder a tus conversaciones</p>
        </div>
        <RegisterForm />
      </div>
    </div>
  )
}

