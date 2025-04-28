import { Avatar } from "@/components/ui/avatar"
import { User, Bot } from "lucide-react"
import { cn } from "@/lib/utils"

type UserAvatarProps = {
  initials?: string
  colorCategory?: "default" | "important" | "urgent" | "completed"
  size?: "sm" | "md" | "lg"
  className?: string
  showUserIcon?: boolean
  isBotActive?: boolean
}

export function UserAvatar({
  initials,
  colorCategory = "default",
  size = "md",
  className,
  showUserIcon = false,
  isBotActive = false,
}: UserAvatarProps) {
  // Define colors by category
  const colorMap = {
    default: "bg-[#332c40] text-white dark:bg-[#332c40] dark:text-white",
    important: "bg-[#4a3f5c] text-white dark:bg-[#4a3f5c] dark:text-white",
    urgent: "bg-[#5d4e73] text-white dark:bg-[#5d4e73] dark:text-white",
    completed: "bg-[#7d728c] text-white dark:bg-[#7d728c] dark:text-white",
  }

  // Define sizes
  const sizeMap = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  }

  // Define icon sizes
  const iconSizeMap = {
    sm: "h-5 w-5",
    md: "h-6 w-6",
    lg: "h-7 w-7",
  }

  return (
    <Avatar className={cn(sizeMap[size], colorMap[colorCategory], "flex items-center justify-center", className)}>
      {showUserIcon ? (
        isBotActive ? (
          <Bot className={cn(iconSizeMap[size], "flex-shrink-0")} />
        ) : (
          <User className={cn(iconSizeMap[size], "flex-shrink-0")} />
        )
      ) : initials ? (
        <span className="font-semibold text-base">{initials}</span>
      ) : (
        <User className={cn(iconSizeMap[size], "flex-shrink-0")} />
      )}
    </Avatar>
  )
}

