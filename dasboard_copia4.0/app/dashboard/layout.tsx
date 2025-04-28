import type React from "react"
import { ThemeProvider } from "@/components/theme-provider"

// Metadatos para el dashboard
export const metadata = {
  title: "WhatsApp Business Dashboard",
  description: "Minimal WhatsApp Business Dashboard",
}

// Componente cliente separado para usar ThemeProvider
function DashboardThemeProvider({ children }: { children: React.ReactNode }) {
  "use client"
  
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      {children}
    </ThemeProvider>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DashboardThemeProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Page content */}
          <div className="flex-1 overflow-hidden">{children}</div>
        </main>
      </div>
    </DashboardThemeProvider>
  )
}

