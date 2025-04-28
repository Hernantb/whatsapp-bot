import type { Metadata } from "next"
import LoginForm from "@/components/login-form"

export const metadata: Metadata = {
  title: "Login | AI CHATS",
  description: "Inicia sesión en tu panel de AI CHATS",
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary-50 to-white p-4">
      <div className="w-full max-w-md space-y-2 animate-fadeIn">
        <div className="text-center">
          <div className="flex justify-center">
            <div className="relative w-64 h-56 flex items-center justify-center">
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/BEXO%20%287%29-H61UjzCdi2GcToLPYPFDTVDvjNe97i.png"
                alt="BEXOR Logo"
                className="h-64 w-auto object-contain"
              />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 -mt-4">AI CHATS</h1>
          <p className="mt-2 mb-2 text-gray-600">Inicia sesión para acceder a tu panel de control</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}

