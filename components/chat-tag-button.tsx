"use client"

import { useState } from "react"
import { Tag } from "lucide-react"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface ChatTagButtonProps {
  currentTag?: string
  onTagChange: (tag: string) => void
  className?: string
}

export function ChatTagButton({ currentTag, onTagChange, className }: ChatTagButtonProps) {
  const [open, setOpen] = useState(false)

  const tags = [
    { id: "red", name: "Urgente", color: "bg-tag-red" },
    { id: "yellow", name: "Pendiente", color: "bg-tag-yellow" },
    { id: "green", name: "Completado", color: "bg-tag-green" },
    { id: "blue", name: "Seguimiento", color: "bg-tag-blue" },
    { id: "gray", name: "Sin etiquetar", color: "bg-tag-gray" },
  ]

  const currentTagColor = currentTag ? tags.find((tag) => tag.id === currentTag)?.color : "bg-transparent"

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center justify-center rounded-full w-5 h-5 transition-colors",
            currentTagColor || "bg-transparent border border-gray-300",
            className,
          )}
          onClick={(e) => {
            e.stopPropagation()
            setOpen(true)
          }}
        >
          <Tag className="h-3 w-3 text-white" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40" onClick={(e) => e.stopPropagation()}>
        {tags.map((tag) => (
          <DropdownMenuItem
            key={tag.id}
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => {
              onTagChange(tag.id)
              setOpen(false)
            }}
          >
            <div className={cn("w-3 h-3 rounded-full", tag.color)} />
            <span>{tag.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

