"use client"

import type React from "react"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface SidebarProps {
  items: {
    title: string
    href: string
    icon?: React.ReactNode
    active?: boolean
  }[]
  onClose?: () => void
}

export function Sidebar({ items, onClose }: SidebarProps) {
  return (
    <div className="flex h-full flex-col bg-background p-4">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl font-bold">Chat Control</h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden">
          <X className="h-5 w-5" />
        </Button>
      </div>
      <nav className="space-y-1 flex-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
              item.active ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
          >
            {item.icon}
            {item.title}
          </Link>
        ))}
      </nav>
      <div className="border-t pt-4 mt-auto">
        <div className="flex items-center gap-3 rounded-md px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">OP</span>
          </div>
          <div>
            <p className="text-sm font-medium">Operador</p>
            <p className="text-xs text-muted-foreground">En línea</p>
          </div>
        </div>
      </div>
    </div>
  )
}

