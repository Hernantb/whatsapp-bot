import type { Metadata } from "next"
import SettingsPanel from "@/components/settings-panel"

export const metadata: Metadata = {
  title: "Settings | WhatsApp Business Dashboard",
  description: "Configure your WhatsApp Business settings",
}

export default function SettingsPage() {
  return <SettingsPanel />
}

