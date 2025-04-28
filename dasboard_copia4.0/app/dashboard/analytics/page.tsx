import type { Metadata } from "next"
import AnalyticsDashboard from "@/components/analytics-dashboard"

export const metadata: Metadata = {
  title: "Analytics | WhatsApp Business Dashboard",
  description: "View your WhatsApp Business analytics and metrics",
}

export default function AnalyticsPage() {
  return <AnalyticsDashboard />
}

