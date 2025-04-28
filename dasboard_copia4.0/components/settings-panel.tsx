"use client"

import { Checkbox } from "@/components/ui/checkbox"

import { Badge } from "@/components/ui/badge"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Avatar } from "@/components/ui/avatar"
import { Save, Upload, Clock, Bot, Bell, Key, Smartphone, MessageSquare, Trash, Plus, Edit } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function SettingsPanel() {
  const [businessHours, setBusinessHours] = useState({
    monday: { enabled: true, start: "09:00", end: "17:00" },
    tuesday: { enabled: true, start: "09:00", end: "17:00" },
    wednesday: { enabled: true, start: "09:00", end: "17:00" },
    thursday: { enabled: true, start: "09:00", end: "17:00" },
    friday: { enabled: true, start: "09:00", end: "17:00" },
    saturday: { enabled: false, start: "10:00", end: "15:00" },
    sunday: { enabled: false, start: "10:00", end: "15:00" },
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Configure your WhatsApp Business dashboard settings</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="bot">Bot Settings</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Business Profile</CardTitle>
              <CardDescription>Update your business information and profile settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <Avatar className="h-20 w-20">
                  <span className="text-2xl font-semibold">WB</span>
                </Avatar>
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Logo
                </Button>
              </div>

              <div className="grid gap-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="business-name" className="text-right">
                    Business Name
                  </Label>
                  <Input id="business-name" defaultValue="WhatsApp Business" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="business-description" className="text-right">
                    Description
                  </Label>
                  <Textarea
                    id="business-description"
                    defaultValue="Official WhatsApp Business account for customer support and inquiries."
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="business-category" className="text-right">
                    Category
                  </Label>
                  <Select defaultValue="technology">
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="healthcare">Healthcare</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="business-email" className="text-right">
                    Email
                  </Label>
                  <Input id="business-email" type="email" defaultValue="contact@example.com" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="business-phone" className="text-right">
                    Phone
                  </Label>
                  <Input id="business-phone" defaultValue="+1 (555) 123-4567" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="business-website" className="text-right">
                    Website
                  </Label>
                  <Input id="business-website" defaultValue="https://example.com" className="col-span-3" />
                </div>
              </div>

              <div className="flex justify-end">
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Business Hours</CardTitle>
              <CardDescription>Set your business hours for automated responses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select defaultValue="america-new_york">
                    <SelectTrigger className="w-[240px]">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="america-new_york">America/New York (UTC-5)</SelectItem>
                      <SelectItem value="america-los_angeles">America/Los Angeles (UTC-8)</SelectItem>
                      <SelectItem value="europe-london">Europe/London (UTC+0)</SelectItem>
                      <SelectItem value="asia-tokyo">Asia/Tokyo (UTC+9)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Day</TableHead>
                      <TableHead className="w-[80px]">Active</TableHead>
                      <TableHead>Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(businessHours).map(([day, hours]) => (
                      <TableRow key={day}>
                        <TableCell className="font-medium capitalize">{day}</TableCell>
                        <TableCell>
                          <Switch
                            checked={hours.enabled}
                            onCheckedChange={(checked) =>
                              setBusinessHours((prev) => ({
                                ...prev,
                                [day]: { ...prev[day as keyof typeof businessHours], enabled: checked },
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Input
                              type="time"
                              value={hours.start}
                              onChange={(e) =>
                                setBusinessHours((prev) => ({
                                  ...prev,
                                  [day]: { ...prev[day as keyof typeof businessHours], start: e.target.value },
                                }))
                              }
                              disabled={!hours.enabled}
                              className="w-[120px]"
                            />
                            <span>to</span>
                            <Input
                              type="time"
                              value={hours.end}
                              onChange={(e) =>
                                setBusinessHours((prev) => ({
                                  ...prev,
                                  [day]: { ...prev[day as keyof typeof businessHours], end: e.target.value },
                                }))
                              }
                              disabled={!hours.enabled}
                              className="w-[120px]"
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex justify-end">
                  <Button>
                    <Clock className="h-4 w-4 mr-2" />
                    Update Hours
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bot Settings */}
        <TabsContent value="bot" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bot Configuration</CardTitle>
              <CardDescription>Configure your automated response bot settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Bot Status</h4>
                  <p className="text-sm text-muted-foreground">Enable or disable automated responses</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="space-y-2">
                <Label htmlFor="welcome-message">Welcome Message</Label>
                <Textarea
                  id="welcome-message"
                  defaultValue="👋 Hello! Thanks for contacting us. How can we help you today?"
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="away-message">Away Message (Outside Business Hours)</Label>
                <Textarea
                  id="away-message"
                  defaultValue="Thank you for your message. Our team is currently away and will respond during our business hours. For urgent matters, please call our support line."
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Response Delay</Label>
                  <Select defaultValue="10">
                    <SelectTrigger className="w-[100px]">
                      <SelectValue placeholder="Delay" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">None</SelectItem>
                      <SelectItem value="5">5 sec</SelectItem>
                      <SelectItem value="10">10 sec</SelectItem>
                      <SelectItem value="30">30 sec</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add a delay before the bot responds to make conversations feel more natural
                </p>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Quick Responses</h4>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <div>
                      <p className="font-medium">#pricing</p>
                      <p className="text-sm text-muted-foreground">
                        Our pricing starts at $29/month for the basic plan...
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-500">
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <div>
                      <p className="font-medium">#hours</p>
                      <p className="text-sm text-muted-foreground">
                        Our business hours are Monday-Friday, 9am-5pm EST...
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-500">
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <Button variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Quick Response
                </Button>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">AI Integration</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">AI-powered responses</p>
                      <p className="text-sm text-muted-foreground">Use AI to generate dynamic responses</p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai-model">AI Model</Label>
                    <Select defaultValue="gpt-4">
                      <SelectTrigger>
                        <SelectValue placeholder="Select AI model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4">GPT-4</SelectItem>
                        <SelectItem value="gpt-3.5">GPT-3.5</SelectItem>
                        <SelectItem value="custom">Custom Model</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai-instructions">AI Instructions</Label>
                    <Textarea
                      id="ai-instructions"
                      defaultValue="You are a helpful customer service assistant for our company. Be polite, concise, and helpful. If you don't know the answer, offer to connect the customer with a human agent."
                      className="min-h-[100px]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button>
                  <Bot className="h-4 w-4 mr-2" />
                  Save Bot Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Settings */}
        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Management</CardTitle>
              <CardDescription>Manage your team members and their access permissions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">Team Members</h4>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Member
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <Avatar className="h-8 w-8 mr-2">
                          <span className="text-xs">JD</span>
                        </Avatar>
                        <span>John Doe</span>
                      </div>
                    </TableCell>
                    <TableCell>john.doe@example.com</TableCell>
                    <TableCell>Admin</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <div className="h-2 w-2 rounded-full bg-green-500 mr-2" />
                        Active
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500">
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <Avatar className="h-8 w-8 mr-2">
                          <span className="text-xs">AS</span>
                        </Avatar>
                        <span>Alice Smith</span>
                      </div>
                    </TableCell>
                    <TableCell>alice.smith@example.com</TableCell>
                    <TableCell>Agent</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <div className="h-2 w-2 rounded-full bg-green-500 mr-2" />
                        Active
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500">
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <Avatar className="h-8 w-8 mr-2">
                          <span className="text-xs">RJ</span>
                        </Avatar>
                        <span>Robert Johnson</span>
                      </div>
                    </TableCell>
                    <TableCell>robert.johnson@example.com</TableCell>
                    <TableCell>Agent</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <div className="h-2 w-2 rounded-full bg-gray-300 mr-2" />
                        Inactive
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500">
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Roles & Permissions</h4>
                <div className="space-y-4">
                  <div className="p-3 border rounded-md">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium">Admin</h5>
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Full access to all features and settings</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline">Manage Team</Badge>
                      <Badge variant="outline">Manage Settings</Badge>
                      <Badge variant="outline">View Analytics</Badge>
                      <Badge variant="outline">Manage Contacts</Badge>
                      <Badge variant="outline">Manage Chats</Badge>
                    </div>
                  </div>

                  <div className="p-3 border rounded-md">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium">Agent</h5>
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Can manage conversations and contacts</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline">View Analytics</Badge>
                      <Badge variant="outline">Manage Contacts</Badge>
                      <Badge variant="outline">Manage Chats</Badge>
                    </div>
                  </div>

                  <div className="p-3 border rounded-md">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium">Viewer</h5>
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Read-only access to conversations and analytics
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline">View Analytics</Badge>
                      <Badge variant="outline">View Chats</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Configure how and when you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Email Notifications</h4>
                    <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Desktop Notifications</h4>
                    <p className="text-sm text-muted-foreground">Receive notifications in your browser</p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Mobile Push Notifications</h4>
                    <p className="text-sm text-muted-foreground">Receive notifications on your mobile device</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Notification Events</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="new-message">New message</Label>
                    <Switch id="new-message" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="new-contact">New contact</Label>
                    <Switch id="new-contact" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="mention">Mention</Label>
                    <Switch id="mention" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="assignment">Chat assignment</Label>
                    <Switch id="assignment" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="status-change">Status change</Label>
                    <Switch id="status-change" />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Quiet Hours</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium">Enable Quiet Hours</h5>
                      <p className="text-sm text-muted-foreground">Pause notifications during specific hours</p>
                    </div>
                    <Switch />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quiet-start">Start Time</Label>
                      <Input id="quiet-start" type="time" defaultValue="22:00" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quiet-end">End Time</Label>
                      <Input id="quiet-end" type="time" defaultValue="08:00" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button>
                  <Bell className="h-4 w-4 mr-2" />
                  Save Notification Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Settings */}
        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>Manage your API keys and webhook settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="api-key">API Key</Label>
                  <Button variant="outline" size="sm">
                    <Key className="h-4 w-4 mr-2" />
                    Generate New Key
                  </Button>
                </div>
                <div className="flex">
                  <Input
                    id="api-key"
                    value="sk_live_51NzQRtKLksdUJFhd7JDKSjdkfjLKJDSLKJFDSLKJlkjdsf"
                    readOnly
                    className="rounded-r-none font-mono text-sm"
                  />
                  <Button variant="secondary" className="rounded-l-none">
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your API key provides full access to your account. Keep it secure and never share it publicly.
                </p>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Webhook Settings</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium">Enable Webhooks</h5>
                      <p className="text-sm text-muted-foreground">Receive real-time updates via webhooks</p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="webhook-url">Webhook URL</Label>
                    <Input id="webhook-url" defaultValue="https://example.com/api/webhooks/whatsapp" />
                  </div>

                  <div className="space-y-2">
                    <Label>Webhook Events</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="event-message" defaultChecked />
                        <label
                          htmlFor="event-message"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Message Received
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="event-status" defaultChecked />
                        <label
                          htmlFor="event-status"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Message Status
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="event-contact" defaultChecked />
                        <label
                          htmlFor="event-contact"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Contact Update
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="event-group" />
                        <label
                          htmlFor="event-group"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Group Update
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Integrations</h4>
                <div className="space-y-4">
                  <div className="p-3 border rounded-md flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded bg-blue-100 flex items-center justify-center mr-3">
                        <Smartphone className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h5 className="font-medium">WhatsApp Business API</h5>
                        <p className="text-sm text-muted-foreground">Connected</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Configure
                    </Button>
                  </div>

                  <div className="p-3 border rounded-md flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded bg-green-100 flex items-center justify-center mr-3">
                        <MessageSquare className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h5 className="font-medium">CRM Integration</h5>
                        <p className="text-sm text-muted-foreground">Not connected</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Connect
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Save API Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

