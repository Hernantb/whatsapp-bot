"use client"

import type React from "react"

import { useState } from "react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sidebar } from "@/components/sidebar"
import { MessageSquare, Bell, Users, Settings, Menu } from "lucide-react"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isDesktop = useMediaQuery("(min-width: 1024px)")

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile sidebar toggle */}
      <div className="fixed top-0 left-0 z-40 w-full border-b bg-background p-4 lg:hidden">
        <Button variant="outline" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="mr-4">
          <Menu className="h-3.5 w-3.5" />
        </Button>
        <span className="font-semibold">Panel de Control</span>
      </div>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform border-r bg-background transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Sidebar
          items={[
            {
              title: "Conversaciones",
              icon: <MessageSquare className="h-3.5 w-3.5" />,
              href: "/",
              active: true,
            },
            {
              title: "Agentes",
              icon: <Users className="h-3.5 w-3.5" />,
              href: "/agents",
            },
            {
              title: "Notificaciones",
              icon: <Bell className="h-3.5 w-3.5" />,
              href: "/notifications",
            },
            {
              title: "Configuración",
              icon: <Settings className="h-3.5 w-3.5" />,
              href: "/settings",
            },
          ]}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Backdrop for mobile */}
      {sidebarOpen && !isDesktop && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <main className={cn("flex-1 overflow-auto p-4 pt-20 lg:p-8 lg:pt-8", sidebarOpen && !isDesktop ? "blur-sm" : "")}>
        {children}
      </main>
    </div>
  )
}

