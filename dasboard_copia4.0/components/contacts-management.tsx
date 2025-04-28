"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Search,
  Plus,
  Filter,
  MoreVertical,
  Download,
  Upload,
  Tag,
  MessageSquare,
  UserPlus,
  Trash,
  Edit,
  X,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { mockConversations } from "@/lib/mock-data"

export default function ContactsManagement() {
  const [contacts, setContacts] = useState(mockConversations)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState("all")

  // Filter contacts based on search query and active tab
  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch =
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) || contact.phone.includes(searchQuery)

    if (activeTab === "business") return matchesSearch && contact.isBusinessAccount
    if (activeTab === "personal") return matchesSearch && !contact.isBusinessAccount
    return matchesSearch
  })

  // Toggle contact selection
  const toggleContactSelection = (id: string) => {
    setSelectedContacts((prev) => (prev.includes(id) ? prev.filter((contactId) => contactId !== id) : [...prev, id]))
  }

  // Select all contacts
  const selectAllContacts = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([])
    } else {
      setSelectedContacts(filteredContacts.map((contact) => contact.id))
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contacts Management</h1>
          <p className="text-muted-foreground">Manage and organize your WhatsApp Business contacts</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Contact</DialogTitle>
                <DialogDescription>Add a new contact to your WhatsApp Business account</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input id="name" placeholder="Enter contact name" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="phone" className="text-right">
                    Phone
                  </Label>
                  <Input id="phone" placeholder="+1 (555) 000-0000" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="business" className="text-right">
                    Business
                  </Label>
                  <div className="col-span-3 flex items-center space-x-2">
                    <Checkbox id="business" />
                    <label
                      htmlFor="business"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      This is a business account
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="labels" className="text-right">
                    Labels
                  </Label>
                  <Input id="labels" placeholder="Customer, Lead, VIP (comma separated)" className="col-span-3" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Add Contact</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Contacts management */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Contacts</CardTitle>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" className="h-8 text-xs">
                <Filter className="h-3.5 w-3.5 mr-1" />
                Filter
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs">
                <Tag className="h-3.5 w-3.5 mr-1" />
                Labels
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 text-xs">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Sort by name</DropdownMenuItem>
                  <DropdownMenuItem>Sort by recent</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Merge contacts</DropdownMenuItem>
                  <DropdownMenuItem>Delete selected</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Contacts</TabsTrigger>
              <TabsTrigger value="business">Business</TabsTrigger>
              <TabsTrigger value="personal">Personal</TabsTrigger>
            </TabsList>

            <div className="border rounded-md">
              <div className="flex items-center justify-between p-3 border-b bg-muted/50">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                    onCheckedChange={selectAllContacts}
                  />
                  <label htmlFor="select-all" className="text-sm font-medium">
                    {selectedContacts.length > 0 ? `${selectedContacts.length} selected` : "Select all"}
                  </label>
                </div>
                {selectedContacts.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm" className="h-8 text-xs">
                      <MessageSquare className="h-3.5 w-3.5 mr-1" />
                      Message
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-xs">
                      <Tag className="h-3.5 w-3.5 mr-1" />
                      Label
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash className="h-3.5 w-3.5 mr-1" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>

              <div className="divide-y">
                {filteredContacts.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-muted-foreground">No contacts found</p>
                  </div>
                ) : (
                  filteredContacts.map((contact) => (
                    <div key={contact.id} className="flex items-center p-3 hover:bg-muted/50">
                      <Checkbox
                        id={`contact-${contact.id}`}
                        checked={selectedContacts.includes(contact.id)}
                        onCheckedChange={() => toggleContactSelection(contact.id)}
                        className="mr-3"
                      />
                      <div className="flex items-center flex-1 min-w-0">
                        <Avatar className="h-10 w-10 mr-3">
                          {contact.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()}
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center">
                            <p className="font-medium truncate">{contact.name}</p>
                            {contact.isBusinessAccount && (
                              <Badge
                                variant="outline"
                                className="ml-2 text-xs bg-whatsapp/10 text-whatsapp border-none"
                              >
                                Business
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{contact.phone}</p>
                        </div>
                        <div className="flex items-center ml-4">
                          {contact.labels.map((label, index) => (
                            <Badge key={index} variant="outline" className="mr-1 text-xs bg-gray-100 border-none">
                              {label}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center ml-4 space-x-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MessageSquare className="h-4 w-4 text-gray-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Edit className="h-4 w-4 text-gray-500" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4 text-gray-500" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Send message
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <UserPlus className="h-4 w-4 mr-2" />
                                Add to group
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Tag className="h-4 w-4 mr-2" />
                                Manage labels
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-500">
                                <Trash className="h-4 w-4 mr-2" />
                                Delete contact
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Labels management */}
      <Card>
        <CardHeader>
          <CardTitle>Labels</CardTitle>
          <CardDescription>Organize your contacts with custom labels</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-none">
              Customer
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-1 text-green-800 hover:bg-green-200 hover:text-green-900"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-none">
              Lead
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-1 text-blue-800 hover:bg-blue-200 hover:text-blue-900"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
            <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 border-none">
              VIP
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-1 text-purple-800 hover:bg-purple-200 hover:text-purple-900"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-none">
              Support
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-1 text-amber-800 hover:bg-amber-200 hover:text-amber-900"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
            <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-none">
              Urgent
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-1 text-red-800 hover:bg-red-200 hover:text-red-900"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-6">
                  <Plus className="h-3 w-3 mr-1" />
                  Add Label
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Create New Label</DialogTitle>
                  <DialogDescription>Add a new label to organize your contacts</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="label-name" className="text-right">
                      Name
                    </Label>
                    <Input id="label-name" placeholder="Enter label name" className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="label-color" className="text-right">
                      Color
                    </Label>
                    <div className="col-span-3 flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-green-500" />
                      <div className="w-6 h-6 rounded-full bg-blue-500" />
                      <div className="w-6 h-6 rounded-full bg-purple-500" />
                      <div className="w-6 h-6 rounded-full bg-amber-500" />
                      <div className="w-6 h-6 rounded-full bg-red-500" />
                      <div className="w-6 h-6 rounded-full bg-gray-500" />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Create Label</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Badge className="bg-green-100 text-green-800 border-none mr-2">Customer</Badge>
                <span className="text-sm">12 contacts</span>
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  <Edit className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash className="h-3.5 w-3.5 mr-1" />
                  Delete
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Badge className="bg-blue-100 text-blue-800 border-none mr-2">Lead</Badge>
                <span className="text-sm">8 contacts</span>
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  <Edit className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash className="h-3.5 w-3.5 mr-1" />
                  Delete
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Badge className="bg-purple-100 text-purple-800 border-none mr-2">VIP</Badge>
                <span className="text-sm">3 contacts</span>
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  <Edit className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash className="h-3.5 w-3.5 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

