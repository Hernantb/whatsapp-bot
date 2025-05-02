"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { getBusinessId } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { 
  ResponseTimeMetrics,
  ConversationMetrics,
  LeadsQualifiedMetrics,
  MessageVolumeMetrics,
  MessageVolumeDataPoint,
  TimeSavedMetrics,
  formatResponseTime,
  TimeRange
} from "@/lib/analytics"
import { UIConversation, UIMessage } from "@/types"

// Extender la definición de jsPDF para incluir autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: typeof autoTable;
    lastAutoTable: {
      finalY: number;
    };
  }
}

interface PdfReportGeneratorProps {
  timeRange: TimeRange
  responseTimeMetrics: ResponseTimeMetrics
  conversationMetrics: ConversationMetrics
  leadsQualifiedMetrics: LeadsQualifiedMetrics
  messageVolumeMetrics: MessageVolumeMetrics
  timeSavedMetrics: TimeSavedMetrics
}

export function PdfReportGenerator({
  timeRange,
  responseTimeMetrics,
  conversationMetrics,
  leadsQualifiedMetrics,
  messageVolumeMetrics,
  timeSavedMetrics
}: PdfReportGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const { toast } = useToast()

  // Función para generar y descargar el PDF
  const generateDetailedPDF = async () => {
    try {
      setIsGenerating(true)
      toast({
        title: "Generando reporte PDF",
        description: "Por favor espere mientras se recopilan y formatean los datos...",
      })

      // Obtener el business_id del usuario actual
      const session = await supabase.auth.getSession()
      if (!session?.data?.session?.user?.id) {
        throw new Error('No hay sesión de usuario')
      }
      
      const userId = session.data.session.user.id
      const businessData = await getBusinessId(userId)
      const businessId = businessData?.businessId
      
      if (!businessId) {
        throw new Error('No se pudo obtener el business_id')
      }

      // Obtener fechas para el rango de tiempo seleccionado
      const dateRange = getDateRangeForReport(timeRange)

      // 1. Obtener conversaciones
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id, created_at, user_id, sender_name, user_category, last_message, is_bot_active')
        .eq('business_id', businessId)
        .gte('created_at', dateRange.startDate.toISOString())
        .lte('created_at', dateRange.endDate.toISOString())
        .order('created_at', { ascending: false })

      if (convError) {
        throw new Error(`Error al obtener conversaciones: ${convError.message}`)
      }

      // 2. Obtener mensajes por categorías
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('id, created_at, content, sender_type, conversation_id')
        .gte('created_at', dateRange.startDate.toISOString())
        .lte('created_at', dateRange.endDate.toISOString())
        .order('created_at', { ascending: false })

      if (msgError) {
        throw new Error(`Error al obtener mensajes: ${msgError.message}`)
      }

      // Filtrar mensajes que pertenecen a conversaciones del business_id
      const conversationIds = (conversations as any[]).map((conv) => conv.id)
      const filteredMessages = (messages as any[]).filter((msg) => 
        conversationIds.includes(msg.conversation_id)
      )

      // Crear el documento PDF
      const pdf = new jsPDF('p', 'mm', 'a4')
      
      // Configurar colores personalizados
      const primaryColor = "#0b1e32" // Color primario oscuro
      const secondaryColor = "#2188f3" // Color secundario azul
      
      // Agregar portada al informe
      // Logo en la portada
      const logoImgPath = "/logo%20longin/BEXO%20(8).png"
      pdf.addImage(logoImgPath, 'PNG', 65, 50, 80, 80)
      
      // Título del reporte en la portada
      pdf.setFontSize(28)
      pdf.setTextColor(primaryColor)
      pdf.text('REPORTE ANALÍTICO', 105, 150, { align: 'center' })
      
      // Nombre de empresa correcto
      pdf.setFontSize(22)
      pdf.setTextColor(secondaryColor)
      pdf.text('BEXOR', 105, 170, { align: 'center' })
      
      // Fecha del reporte
      pdf.setFontSize(12)
      pdf.setTextColor(100, 100, 100)
      pdf.text(`Período: ${formatDate(dateRange.startDate.toISOString())} - ${formatDate(dateRange.endDate.toISOString())}`, 105, 180, { align: 'center' })
      
      // Agregar nueva página para el contenido
      pdf.addPage()
      
      // Función para agregar encabezado a todas las páginas excepto la portada
      const addHeaderToAllPages = () => {
        const totalPages = pdf.getNumberOfPages()
        
        for (let i = 2; i <= totalPages; i++) {
          pdf.setPage(i)
          
          // Línea horizontal debajo del encabezado
          pdf.setDrawColor(parseInt(secondaryColor.substr(1,2), 16), parseInt(secondaryColor.substr(3,2), 16), parseInt(secondaryColor.substr(5,2), 16))
          pdf.setLineWidth(0.5)
          pdf.line(10, 28, 200, 28)
          
          // Logo más pequeño en la esquina superior derecha
          pdf.addImage(logoImgPath, 'PNG', 180, 5, 20, 20)
        }
      }
      
      // Título del reporte en la primera página de contenido
      pdf.setFontSize(22)
      pdf.setTextColor(primaryColor)
      pdf.text('REPORTE ANALÍTICO', 105, 40, { align: 'center' })
      
      // Información del período
      pdf.setFontSize(14)
      pdf.setTextColor(secondaryColor)
      let periodoTexto = "Diario"
      if (timeRange === "weekly") periodoTexto = "Semanal"
      if (timeRange === "monthly") periodoTexto = "Mensual"
      if (timeRange === "yearly") periodoTexto = "Anual"
      pdf.text(`Período: ${periodoTexto}`, 105, 50, { align: 'center' })

      // Fecha de generación
      pdf.setFontSize(10)
      pdf.setTextColor(100, 100, 100)
      const date = new Date().toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
      pdf.text(`Generado el: ${date}`, 105, 57, { align: 'center' })
      
      // Resumen de datos
      pdf.setFontSize(16)
      pdf.setTextColor(primaryColor)
      pdf.text('Resumen', 14, 70)

      // Crear tabla de resumen con los datos principales
      autoTable(pdf, {
        startY: 75,
        head: [['Métrica', 'Valor', 'Comparativa']],
        body: [
          ['Conversaciones Creadas', `${conversationMetrics.totalCount}`, `${conversationMetrics.percentageChange}% vs período anterior`],
          ['Tiempo de Respuesta', `${formatResponseTime(responseTimeMetrics.averageResponseTime)}`, `${responseTimeMetrics.count} respuestas analizadas`],
          ['Leads Calificados', `${leadsQualifiedMetrics.totalCount}`, `${leadsQualifiedMetrics.percentageChange}% vs período anterior`],
          ['Mensajes Enviados', `${messageVolumeMetrics.totalSent}`, `${messageVolumeMetrics.sentPercentageChange}% vs período anterior`],
          ['Mensajes Recibidos', `${messageVolumeMetrics.totalReceived}`, `${messageVolumeMetrics.receivedPercentageChange}% vs período anterior`],
          ['Tiempo Ahorrado', `${timeSavedMetrics.hours} horas y ${timeSavedMetrics.minutes} minutos`, `Con ${timeSavedMetrics.messageCount} respuestas automáticas`],
        ],
        theme: 'grid',
        headStyles: { 
          fillColor: [11, 30, 50], // primaryColor
          textColor: [255, 255, 255]
        },
        alternateRowStyles: {
          fillColor: [240, 240, 240]
        },
        styles: {
          cellPadding: 4
        }
      })

      // Datos detallados por secciones
      pdf.addPage()
      
      // Sección 1: Conversaciones
      pdf.setFontSize(18)
      pdf.setTextColor(primaryColor)
      pdf.text('Análisis Detallado de Conversaciones', 14, 40)
      
      pdf.setFontSize(10)
      pdf.setTextColor(100, 100, 100)
      pdf.text(`Período analizado: ${dateRange.startDate.toLocaleDateString('es-ES')} - ${dateRange.endDate.toLocaleDateString('es-ES')}`, 14, 47)
      
      pdf.setFontSize(12)
      pdf.setTextColor(secondaryColor)
      pdf.text(`Total de conversaciones: ${conversations.length}`, 14, 53)
      
      // Clasificación de conversaciones por categoría
      const importantConvs = (conversations as any[]).filter(c => c.user_category === 'important').length;
      const urgentConvs = (conversations as any[]).filter(c => c.user_category === 'urgent').length;
      const completedConvs = (conversations as any[]).filter(c => c.user_category === 'completed').length;
      const defaultConvs = (conversations as any[]).filter(c => c.user_category === 'default' || !c.user_category).length;
      
      // Crear un array para las categorías de conversaciones que se mostrarán en la tabla
      const categoryRows = [];
      
      if (importantConvs > 0 || conversations.length === 0) {
        categoryRows.push(['Importantes', `${importantConvs}`, conversations.length > 0 ? `${((importantConvs / conversations.length) * 100).toFixed(2)}%` : '0.00%']);
      }
      
      if (urgentConvs > 0 || conversations.length === 0) {
        categoryRows.push(['Urgentes', `${urgentConvs}`, conversations.length > 0 ? `${((urgentConvs / conversations.length) * 100).toFixed(2)}%` : '0.00%']);
      }
      
      if (completedConvs > 0 || conversations.length === 0) {
        categoryRows.push(['Completadas', `${completedConvs}`, conversations.length > 0 ? `${((completedConvs / conversations.length) * 100).toFixed(2)}%` : '0.00%']);
      }
      
      if (defaultConvs > 0 || conversations.length === 0) {
        categoryRows.push(['Regulares', `${defaultConvs}`, conversations.length > 0 ? `${((defaultConvs / conversations.length) * 100).toFixed(2)}%` : '0.00%']);
      }
      
      // Si no hay categorías con conversaciones, mostrar todas las categorías con 0
      if (categoryRows.length === 0) {
        categoryRows.push(
          ['Importantes', '0', '0.00%'],
          ['Urgentes', '0', '0.00%'],
          ['Completadas', '0', '0.00%'],
          ['Regulares', '0', '0.00%']
        );
      }
      
      // Tabla de categorías
      autoTable(pdf, {
        startY: 57,
        head: [['Categoría', 'Cantidad', 'Porcentaje']],
        body: categoryRows,
        theme: 'grid',
        headStyles: { 
          fillColor: [33, 136, 243], // secondaryColor
          textColor: [255, 255, 255]
        }
      })
      
      // Conversaciones detalladas (las 15 más recientes)
      pdf.setFontSize(14)
      pdf.setTextColor(primaryColor)
      pdf.text('Conversaciones Recientes', 14, getFinalY(pdf) + 15)
      
      // Preparar datos para tabla de conversaciones
      const conversationsRows = (conversations as any[])
        .slice(0, 15) // Limitar a 15 conversaciones
        .map(conv => [
          conv.sender_name || conv.user_id,
          conv.user_id,
          formatDate(conv.created_at),
          conv.user_category || 'default',
          truncateText(conv.last_message || '-', 30)
        ])
      
      autoTable(pdf, {
        startY: getFinalY(pdf) + 20,
        head: [['Nombre', 'Teléfono', 'Fecha', 'Categoría', 'Último mensaje']],
        body: conversationsRows,
        theme: 'grid',
        headStyles: { 
          fillColor: [11, 30, 50], // primaryColor
          textColor: [255, 255, 255]
        },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 30 },
          2: { cellWidth: 25 },
          3: { cellWidth: 25 },
          4: { cellWidth: 70 }
        },
        styles: {
          overflow: 'ellipsize',
          cellPadding: 3,
          fontSize: 8
        }
      })
      
      // Sección 2: Análisis de Mensajes
      pdf.addPage()
      pdf.setFontSize(18)
      pdf.setTextColor(primaryColor)
      pdf.text('Análisis Detallado de Mensajes', 14, 40)
      
      // Estadísticas de mensajes
      const botMessages = filteredMessages?.filter(msg => msg.sender_type === 'bot')?.length || 0;
      const userMessages = filteredMessages?.filter(msg => msg.sender_type === 'user')?.length || 0;
      const agentMessages = filteredMessages?.filter(msg => msg.sender_type === 'agent')?.length || 0;
      
      // Tabla de tipos de mensajes
      autoTable(pdf, {
        startY: 50,
        head: [['Tipo de Mensaje', 'Cantidad', 'Porcentaje']],
        body: [
          ['Mensajes de Bot', `${botMessages}`, filteredMessages.length > 0 ? `${((botMessages / filteredMessages.length) * 100).toFixed(2)}%` : '0%'],
          ['Mensajes de Usuario', `${userMessages}`, filteredMessages.length > 0 ? `${((userMessages / filteredMessages.length) * 100).toFixed(2)}%` : '0%'],
          ['Mensajes de Agente', `${agentMessages}`, filteredMessages.length > 0 ? `${((agentMessages / filteredMessages.length) * 100).toFixed(2)}%` : '0%'],
        ],
        theme: 'grid',
        headStyles: { 
          fillColor: [33, 136, 243], // secondaryColor
          textColor: [255, 255, 255]
        }
      })
      
      // Volumen de mensajes por día/semana
      pdf.setFontSize(14)
      pdf.setTextColor(primaryColor)
      pdf.text('Volumen de Mensajes por Período', 14, getFinalY(pdf) + 15)
      
      // Preparar datos para tabla de volumen
      const volumeRows = messageVolumeMetrics.data.map((point: MessageVolumeDataPoint) => [
        point.name,
        point.sent.toString(),
        point.received.toString(),
        (point.sent + point.received).toString()
      ])
      
      autoTable(pdf, {
        startY: getFinalY(pdf) + 20,
        head: [['Período', 'Enviados', 'Recibidos', 'Total']],
        body: volumeRows,
        theme: 'grid',
        headStyles: { 
          fillColor: [11, 30, 50], // primaryColor
          textColor: [255, 255, 255]
        }
      })
      
      // Sección 3: Leads Calificados
      pdf.addPage()
      pdf.setFontSize(18)
      pdf.setTextColor(primaryColor)
      pdf.text('Leads Calificados', 14, 40)
      
      // Mostrar conversaciones importantes y urgentes
      const qualifiedLeads = (conversations as any[]).filter(
        c => c.user_category === 'important' || c.user_category === 'urgent'
      )
      
      pdf.setFontSize(12)
      pdf.setTextColor(100, 100, 100)
      pdf.text(`Total de leads calificados: ${qualifiedLeads.length}`, 14, 50)
      
      // Tabla de leads calificados
      const leadsRows = qualifiedLeads.map(lead => [
        lead.sender_name || lead.user_id,
        lead.user_id,
        formatDate(lead.created_at),
        lead.user_category,
        truncateText(lead.last_message || '-', 40)
      ])
      
      if (leadsRows.length > 0) {
        autoTable(pdf, {
          startY: 55,
          head: [['Nombre', 'Teléfono', 'Fecha', 'Categoría', 'Último mensaje']],
          body: leadsRows,
          theme: 'grid',
          headStyles: { 
            fillColor: [33, 136, 243], // secondaryColor
            textColor: [255, 255, 255]
          },
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 30 },
            2: { cellWidth: 25 },
            3: { cellWidth: 25 },
            4: { cellWidth: 70 }
          },
          styles: {
            overflow: 'ellipsize',
            cellPadding: 3,
            fontSize: 8
          }
        })
      } else {
        pdf.setFontSize(12)
        pdf.text('No se encontraron leads calificados en el período seleccionado.', 14, 35)
      }
      
      // Sección 4: Eficiencia y Tiempo Ahorrado
      pdf.addPage()
      pdf.setFontSize(18)
      pdf.setTextColor(primaryColor)
      pdf.text('Eficiencia y Tiempo Ahorrado', 14, 40)
      
      // Resumen de eficiencia
      pdf.setFontSize(12)
      pdf.setTextColor(100, 100, 100)
      pdf.text(`Tiempo de respuesta promedio: ${formatResponseTime(responseTimeMetrics.averageResponseTime)}`, 14, 50)
      pdf.text(`Total de respuestas automáticas: ${timeSavedMetrics.messageCount}`, 14, 57)
      pdf.text(`Tiempo ahorrado: ${timeSavedMetrics.hours} horas y ${timeSavedMetrics.minutes} minutos`, 14, 64)
      
      pdf.setFontSize(14)
      pdf.setTextColor(secondaryColor)
      pdf.text('Impacto en la Eficiencia Operativa', 14, 75)
      
      // Calcular horas laborales ahorradas (considerando 8 horas por día laboral)
      const totalMinutes = timeSavedMetrics.hours * 60 + timeSavedMetrics.minutes
      const laborDays = (totalMinutes / 60 / 8).toFixed(2)
      
      // Tabla de impacto
      autoTable(pdf, {
        startY: 80,
        head: [['Métrica', 'Valor', 'Impacto']],
        body: [
          ['Tiempo Total Ahorrado', `${timeSavedMetrics.hours}h ${timeSavedMetrics.minutes}m`, `Equivalente a ${laborDays} días laborales`],
          ['Mensajes Automatizados', `${timeSavedMetrics.messageCount}`, filteredMessages.length > 0 ? `${((botMessages / filteredMessages.length) * 100).toFixed(2)}% del total de mensajes` : '0% del total de mensajes'],
          ['Tiempo Promedio por Respuesta', '1m 35s', 'Tiempo estimado de respuesta manual'],
          ['Tiempo de Respuesta', `${formatResponseTime(responseTimeMetrics.averageResponseTime)}`, `${responseTimeMetrics.count} mensajes analizados`]
        ],
        theme: 'grid',
        headStyles: { 
          fillColor: [11, 30, 50], // primaryColor
          textColor: [255, 255, 255]
        }
      })
      
      // Conclusiones
      pdf.setFontSize(16)
      pdf.setTextColor(primaryColor)
      pdf.text('Conclusiones', 14, getFinalY(pdf) + 20)
      
      pdf.setFontSize(11)
      pdf.setTextColor(80, 80, 80)
      
      // Calcular ratios importantes
      const responseRatio = userMessages > 0 ? (botMessages / userMessages).toFixed(2) : "0.00";
      const leadConversionRate = conversations.length > 0 ? ((qualifiedLeads.length / conversations.length) * 100).toFixed(2) : "0.00";
      
      // Texto de conclusiones basado en los datos
      let conclusions = [
        `• El sistema automatizado ha respondido a ${botMessages} mensajes, lo que representa una proporción de ${responseRatio} respuestas por cada mensaje de usuario.`,
        `• Se han identificado ${qualifiedLeads.length} leads calificados, con una tasa de conversión del ${leadConversionRate}% del total de conversaciones.`,
        `• El tiempo promedio de respuesta es de ${formatResponseTime(responseTimeMetrics.averageResponseTime)}, lo que indica una alta eficiencia en la atención al cliente.`,
        `• Se han ahorrado aproximadamente ${timeSavedMetrics.hours} horas y ${timeSavedMetrics.minutes} minutos de trabajo manual gracias a la automatización.`
      ]
      
      // Añadir conclusiones al PDF con un ancho limitado para evitar el recorte a la derecha
      let yPosition = getFinalY(pdf) + 25
      const maxLineWidth = 170; // Limitar el ancho para evitar recorte en el lado derecho
      
      conclusions.forEach(conclusion => {
        const lines = pdf.splitTextToSize(conclusion, maxLineWidth);
        pdf.text(lines, 14, yPosition);
        yPosition += 7 * lines.length; // Ajustar la posición Y según el número de líneas
      })
      
      // Pie de página
      const totalPages = pdf.getNumberOfPages()
      
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i)
        pdf.setFontSize(8)
        pdf.setTextColor(150, 150, 150)
        pdf.text(`BEXOR - Reporte Analítico - Página ${i} de ${totalPages}`, 105, 287, { align: 'center' })
      }
      
      // Aplicar encabezado a todas las páginas excepto la portada
      addHeaderToAllPages()
      
      // Guardar el PDF
      pdf.save(`reporte-completo-bexor-${timeRange}-${new Date().toISOString().split('T')[0]}.pdf`)
      
      toast({
        title: "Reporte generado con éxito",
        description: "El reporte detallado ha sido descargado correctamente.",
      })
    } catch (error) {
      console.error('Error al generar PDF detallado:', error)
      toast({
        title: "Error al generar reporte",
        description: error instanceof Error ? error.message : "Ocurrió un error inesperado",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Button
      variant="outline"
      className="flex items-center gap-2 text-[#2188f3] border-[#2188f3] hover:bg-[#2188f3]/10 dark:text-white dark:border-white"
      onClick={generateDetailedPDF}
      disabled={isGenerating}
    >
      <Download className="h-4 w-4" />
      {isGenerating ? "Generando reporte..." : "Reporte analítico"}
    </Button>
  )
}

// Funciones de utilidad
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function truncateText(text: string, maxLength: number): string {
  if (!text) return '-'
  return text.length > maxLength 
    ? text.substring(0, maxLength) + '...' 
    : text
}

function getDateRangeForReport(timeRange: TimeRange) {
  try {
    const now = new Date()
    let startDate: Date
    
    switch (timeRange) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
        break
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case 'yearly':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }
    
    return {
      startDate,
      endDate: now
    }
  } catch (error) {
    console.error('Error in getDateRangeForReport:', error)
    // Default to last 7 days if there's an error
    const now = new Date()
    return {
      startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      endDate: now
    }
  }
}

// Obtener la posición final después de usar autoTable
function getFinalY(pdf: any): number {
  if (pdf.lastAutoTable && pdf.lastAutoTable.finalY) {
    return pdf.lastAutoTable.finalY;
  }
  
  // Fallback position if lastAutoTable is not available
  return 50;
}