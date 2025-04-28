import type { Metadata } from "next/types"
import MinimalChatInterface from "@/components/minimal-chat-interface"

export const metadata: Metadata = {
  title: "WhatsApp Business Dashboard",
  description: "Minimal WhatsApp Business Dashboard",
}

export default function DashboardPage() {
  return <MinimalChatInterface />
}

