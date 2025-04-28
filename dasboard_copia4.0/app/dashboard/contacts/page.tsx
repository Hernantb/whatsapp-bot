import type { Metadata } from "next"
import ContactsManagement from "@/components/contacts-management"

export const metadata: Metadata = {
  title: "Contacts | WhatsApp Business Dashboard",
  description: "Manage your WhatsApp Business contacts",
}

export default function ContactsPage() {
  return <ContactsManagement />
}

