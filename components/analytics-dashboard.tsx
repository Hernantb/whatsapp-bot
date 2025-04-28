"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts"
import { ArrowUpRight, ArrowDownRight, MessageSquare, Users, Clock, Home } from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TimeSavedCounter } from "./time-saved-counter"

// Mock data for charts
const messageData = [
  { name: "Lun", sent: 40, received: 24 },
  { name: "Mar", sent: 30, received: 28 },
  { name: "Mié", sent: 45, received: 32 },
  { name: "Jue", sent: 50, received: 37 },
  { name: "Vie", sent: 35, received: 30 },
  { name: "Sáb", sent: 25, received: 18 },
  { name: "Dom", sent: 20, received: 15 },
]

// Datos para diferentes períodos de tiempo
const dailyMessageData = messageData
const weeklyMessageData = [
  { name: "Sem 1", sent: 180, received: 120 },
  { name: "Sem 2", sent: 220, received: 150 },
  { name: "Sem 3", sent: 200, received: 140 },
  { name: "Sem 4", sent: 240, received: 160 },
]
const monthlyMessageData = [
  { name: "Ene", sent: 800, received: 500 },
  { name: "Feb", sent: 750, received: 480 },
  { name: "Mar", sent: 900, received: 600 },
  { name: "Abr", sent: 950, received: 650 },
  { name: "May", sent: 1000, received: 700 },
  { name: "Jun", sent: 1100, received: 750 },
]
const yearlyMessageData = [
  { name: "2021", sent: 8500, received: 5500 },
  { name: "2022", sent: 9800, received: 6500 },
  { name: "2023", sent: 12000, received: 8000 },
  { name: "2024", sent: 14500, received: 9500 },
]

export default function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState("daily")

  // Seleccionar datos según el rango de tiempo
  const getMessageData = () => {
    switch (timeRange) {
      case "daily":
        return dailyMessageData
      case "weekly":
        return weeklyMessageData
      case "monthly":
        return monthlyMessageData
      case "yearly":
        return yearlyMessageData
      default:
        return dailyMessageData
    }
  }

  // Actualizar los valores para que sean más realistas según cada período
  const getInitialTimeSaved = () => {
    switch (timeRange) {
      case "daily":
        return { hours: 3, minutes: 45 }
      case "weekly":
        return { hours: 24, minutes: 30 }
      case "monthly":
        return { hours: 98, minutes: 15 }
      case "yearly":
        return { hours: 1248, minutes: 30 }
      default:
        return { hours: 3, minutes: 45 }
    }
  }

  const messageChartData = getMessageData()
  const timeSaved = getInitialTimeSaved()

  return (
    <div className="p-6 space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard de Análisis</h1>
          <p className="text-muted-foreground">Monitorea el rendimiento de tus mensajes</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs defaultValue="daily" value={timeRange} onValueChange={setTimeRange}>
            <TabsList>
              <TabsTrigger value="daily">Diario</TabsTrigger>
              <TabsTrigger value="weekly">Semanal</TabsTrigger>
              <TabsTrigger value="monthly">Mensual</TabsTrigger>
              <TabsTrigger value="yearly">Anual</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="default"
            className="ml-2 flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white"
            onClick={() => (window.location.href = "/dashboard")}
          >
            <Home className="h-4 w-4" />
            Volver al Chat
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-3">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversaciones Activas</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,248</div>
            <p className="text-xs text-muted-foreground flex items-center">
              <span className="text-green-500 flex items-center mr-1">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                12%
              </span>
              vs período anterior
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiempo de Respuesta</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">14 min</div>
            <p className="text-xs text-muted-foreground flex items-center">
              <span className="text-red-500 flex items-center mr-1">
                <ArrowDownRight className="h-3 w-3 mr-1" />
                3%
              </span>
              vs período anterior
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Variación Mensual</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+18%</div>
            <p className="text-xs text-muted-foreground flex items-center">
              <span className="text-green-500 flex items-center mr-1">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                8%
              </span>
              vs período anterior
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Volumen de Mensajes</CardTitle>
            <CardDescription>Número de mensajes enviados y recibidos</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ChartContainer
              config={{
                sent: {
                  label: "Enviados",
                  color: "hsl(var(--chart-1))",
                },
                received: {
                  label: "Recibidos",
                  color: "hsl(var(--chart-2))",
                },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={messageChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="sent" fill="#332c40" name="Enviados" />
                  <Bar dataKey="received" fill="#7d728c" name="Recibidos" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Reemplazar la gráfica de tiempo ahorrado por el contador */}
        <TimeSavedCounter initialHours={timeSaved.hours} initialMinutes={timeSaved.minutes} />
      </div>
    </div>
  )
}

