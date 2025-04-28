"use client"

import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  X,
  Phone,
  Video,
  Star,
  Bell,
  Search,
  Image,
  File,
  Link,
  MessageSquare,
  UserPlus,
  Trash,
  BlocksIcon as Block,
  Plus,
} from "lucide-react"

interface ContactInfoProps {
  contact?: any
  onClose: () => void
}

export default function ContactInfo({ contact, onClose }: ContactInfoProps) {
  if (!contact) return null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
        <h3 className="font-medium">Contact Info</h3>
        <div className="w-9"></div> {/* Spacer for alignment */}
      </div>

      {/* Contact details */}
      <div className="overflow-y-auto flex-1">
        <div className="p-6 text-center border-b">
          <Avatar className="h-24 w-24 mx-auto mb-4">
            <span className="text-2xl font-semibold">
              {contact.name
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .toUpperCase()}
            </span>
          </Avatar>
          <h2 className="text-xl font-semibold">{contact.name}</h2>
          <p className="text-muted-foreground">{contact.phone}</p>

          {contact.isBusinessAccount && (
            <Badge className="mt-2 bg-whatsapp/10 text-whatsapp hover:bg-whatsapp/20 border-none">
              Business Account
            </Badge>
          )}

          <div className="flex justify-center mt-4 space-x-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-10 w-10 bg-whatsapp/10 text-whatsapp hover:bg-whatsapp/20"
            >
              <Phone className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-10 w-10 bg-whatsapp/10 text-whatsapp hover:bg-whatsapp/20"
            >
              <Video className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-10 w-10 bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              <Star className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="w-full grid grid-cols-3 bg-transparent border-b rounded-none h-auto py-0">
            <TabsTrigger
              value="info"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-whatsapp data-[state=active]:shadow-none rounded-none py-3"
            >
              Info
            </TabsTrigger>
            <TabsTrigger
              value="media"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-whatsapp data-[state=active]:shadow-none rounded-none py-3"
            >
              Media
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-whatsapp data-[state=active]:shadow-none rounded-none py-3"
            >
              Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-0">
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">About</h4>
                <p className="text-sm">{contact.about || "Hey there! I'm using WhatsApp."}</p>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Phone</h4>
                <p className="text-sm">{contact.phone}</p>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Labels</h4>
                <div className="flex flex-wrap gap-2">
                  {contact.labels.map((label: string, index: number) => (
                    <Badge key={index} variant="outline" className="bg-gray-100 hover:bg-gray-200 border-none">
                      {label}
                    </Badge>
                  ))}
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" />
                    Add Label
                  </Button>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center">
                    <Bell className="h-5 w-5 mr-3 text-gray-500" />
                    <span className="text-sm">Mute notifications</span>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center">
                    <MessageSquare className="h-5 w-5 mr-3 text-gray-500" />
                    <span className="text-sm">Bot auto-responses</span>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <Button variant="outline" className="w-full justify-start text-sm h-9">
                  <UserPlus className="h-4 w-4 mr-2 text-gray-500" />
                  Add to group
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start text-sm h-9 text-amber-600 border-amber-200 hover:bg-amber-50"
                >
                  <Star className="h-4 w-4 mr-2" />
                  Add to favorites
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start text-sm h-9 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Block className="h-4 w-4 mr-2" />
                  Block contact
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start text-sm h-9 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash className="h-4 w-4 mr-2" />
                  Delete chat
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="media" className="mt-0">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium">Media, Links and Docs</h4>
                <Button variant="ghost" size="sm" className="h-8 text-whatsapp">
                  <Search className="h-4 w-4 mr-1" />
                  Search
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-1 mb-4">
                <div className="aspect-square bg-gray-100 rounded-md flex items-center justify-center">
                  <Image className="h-6 w-6 text-gray-400" />
                </div>
                <div className="aspect-square bg-gray-100 rounded-md flex items-center justify-center">
                  <Image className="h-6 w-6 text-gray-400" />
                </div>
                <div className="aspect-square bg-gray-100 rounded-md flex items-center justify-center">
                  <Image className="h-6 w-6 text-gray-400" />
                </div>
              </div>

              <div className="space-y-2">
                <h5 className="text-sm font-medium">Documents</h5>
                <div className="p-3 bg-gray-50 rounded-md flex items-center">
                  <File className="h-8 w-8 text-gray-400 mr-3" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Product_Catalog.pdf</p>
                    <p className="text-xs text-gray-500">PDF • 2.4 MB</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <h5 className="text-sm font-medium">Links</h5>
                <div className="p-3 bg-gray-50 rounded-md flex items-center">
                  <Link className="h-8 w-8 text-gray-400 mr-3" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">company-website.com</p>
                    <p className="text-xs text-gray-500">Shared 3 days ago</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="mt-0">
            <div className="p-4 space-y-4">
              <div>
                <h4 className="font-medium mb-2">Activity Stats</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-gray-50 rounded-md">
                    <p className="text-xs text-gray-500">Total Messages</p>
                    <p className="text-lg font-semibold">247</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-md">
                    <p className="text-xs text-gray-500">Response Time</p>
                    <p className="text-lg font-semibold">14 min</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-md">
                    <p className="text-xs text-gray-500">First Contact</p>
                    <p className="text-lg font-semibold">Mar 12</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-md">
                    <p className="text-xs text-gray-500">Last Active</p>
                    <p className="text-lg font-semibold">Today</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Assigned Agent</h4>
                <div className="p-3 bg-gray-50 rounded-md flex items-center">
                  <Avatar className="h-8 w-8 mr-3">
                    <span className="text-xs">JD</span>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">John Doe</p>
                    <p className="text-xs text-gray-500">Assigned on Mar 15</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Interaction History</h4>
                <div className="space-y-2">
                  <div className="p-3 bg-gray-50 rounded-md">
                    <div className="flex justify-between">
                      <p className="text-sm font-medium">Chat started</p>
                      <p className="text-xs text-gray-500">Mar 12</p>
                    </div>
                    <p className="text-xs text-gray-500">Customer initiated conversation</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-md">
                    <div className="flex justify-between">
                      <p className="text-sm font-medium">Product inquiry</p>
                      <p className="text-xs text-gray-500">Mar 14</p>
                    </div>
                    <p className="text-xs text-gray-500">Asked about product pricing</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-md">
                    <div className="flex justify-between">
                      <p className="text-sm font-medium">Agent assigned</p>
                      <p className="text-xs text-gray-500">Mar 15</p>
                    </div>
                    <p className="text-xs text-gray-500">John Doe took over the conversation</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

