"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Settings, MessageCircle, Bell, Shield, Users, ArrowLeft, Loader2, Check, Save, Upload, FileUp, AlertTriangle, FileText, Plus, X, Edit, PlusCircle, Trash } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/navigation"

interface BusinessConfig {
  vector_store_id?: string;
  [key: string]: any;
}

// Definir interface para el FileItem
interface FileItem {
  id: string;
  object: string;
  created_at: number;
  status: string;
  filename: string;
  purpose: string;
  bytes: number;
}

// Definir interface para las props de DocumentFilesList
interface DocumentFilesListProps {
  vectorStoreId?: string;
  businessId?: string;
  onFileDeleted?: () => void;
}

// Interface para las palabras clave de notificación
interface KeywordNotification {
  id: string;
  keyword: string;
  enabled: boolean;
}

export default function ConfigPanel() {
  const [loading, setLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [assistantName, setAssistantName] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [vectorStoreId, setVectorStoreId] = useState("")
  const [businessConfig, setBusinessConfig] = useState<BusinessConfig | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  
  // Estados para palabras clave de notificación
  const [keywords, setKeywords] = useState<KeywordNotification[]>([])
  const [newKeyword, setNewKeyword] = useState("")
  const [editingKeywordId, setEditingKeywordId] = useState<string | null>(null)
  const [editingKeywordValue, setEditingKeywordValue] = useState("")
  const [loadingKeywords, setLoadingKeywords] = useState(false)
  const [savingKeyword, setSavingKeyword] = useState(false)
  
  const { toast } = useToast()

  // Cargar la configuración actual del asistente al montar el componente
  useEffect(() => {
    const fetchAssistantConfig = async () => {
      try {
        setLoading(true)
        
        // Primero intentamos obtener la configuración del negocio
        const configResponse = await fetch('/api/business/config', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        })
        
        if (configResponse.ok) {
          const configData = await configResponse.json()
          if (configData.success && configData.config) {
            setBusinessConfig(configData.config)
            // Si hay un vector_store_id en la configuración del negocio, lo usamos
            if (configData.config.vector_store_id) {
              setVectorStoreId(configData.config.vector_store_id)
              console.log(`Vector Store ID cargado desde configuración: ${configData.config.vector_store_id}`)
            }
          }
        }
        
        // Luego obtenemos la configuración del asistente
        const response = await fetch('/api/assistant', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'getAssistant'
          })
        })

        const data = await response.json()
        if (data.success && data.assistant) {
          setAssistantName(data.assistant.name || "")
          setSystemPrompt(data.assistant.instructions || "")
          
          // Solo sobreescribimos el Vector Store ID si no lo conseguimos de la configuración del negocio
          if (!vectorStoreId && data.assistant.vector_store_id) {
            setVectorStoreId(data.assistant.vector_store_id)
            console.log(`Vector Store ID cargado desde asistente: ${data.assistant.vector_store_id}`)
          }
        } else {
          console.error("Error al cargar la configuración:", data.error)
          toast({
            title: "Error",
            description: "No se pudo cargar la configuración del asistente",
            variant: "destructive"
          })
        }
      } catch (error) {
        console.error("Error inesperado:", error)
        toast({
          title: "Error",
          description: "Ocurrió un error al comunicarse con el servidor",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchAssistantConfig()
    loadKeywordNotifications()
  }, [toast])

  // Cargar palabras clave de notificación
  const loadKeywordNotifications = async () => {
    try {
      setLoadingKeywords(true)
      
      // Simulamos la carga de datos (esto debería ser reemplazado por una llamada API real)
      const response = await fetch('/api/notifications/keywords')
      
      if (response.ok) {
        const data = await response.json()
        setKeywords(data.keywords || [])
      } else {
        // Si la API aún no existe, usar datos de ejemplo
        setKeywords([
          { id: '1', keyword: 'urgente', enabled: true },
          { id: '2', keyword: 'importante', enabled: true },
          { id: '3', keyword: 'prioritario', enabled: false }
        ])
        
        console.log('Usando datos de ejemplo para palabras clave de notificación')
      }
    } catch (error) {
      console.error('Error al cargar palabras clave:', error)
      // En caso de error, usar datos de ejemplo
      setKeywords([
        { id: '1', keyword: 'urgente', enabled: true },
        { id: '2', keyword: 'importante', enabled: true },
        { id: '3', keyword: 'prioritario', enabled: false }
      ])
    } finally {
      setLoadingKeywords(false)
    }
  }
  
  // Añadir una nueva palabra clave
  const addKeyword = async () => {
    if (!newKeyword.trim()) {
      toast({
        title: "Error",
        description: "La palabra clave no puede estar vacía",
        variant: "destructive"
      })
      return
    }
    
    try {
      setSavingKeyword(true)
      
      // Simular la llamada a la API para guardar
      // Esto debería ser una llamada real a la API
      // await fetch('/api/notifications/keywords', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ keyword: newKeyword })
      // })
      
      // Simulamos la respuesta exitosa
      const newId = Date.now().toString()
      
      setKeywords(prev => [...prev, {
        id: newId,
        keyword: newKeyword.trim(),
        enabled: true
      }])
      
      setNewKeyword("")
      
      toast({
        title: "Palabra clave añadida",
        description: "La palabra clave se ha añadido con éxito",
        variant: "default",
        className: "bg-green-500 text-white"
      })
    } catch (error) {
      console.error('Error al añadir palabra clave:', error)
      toast({
        title: "Error",
        description: "No se pudo añadir la palabra clave",
        variant: "destructive"
      })
    } finally {
      setSavingKeyword(false)
    }
  }
  
  // Actualizar el estado de habilitación de una palabra clave
  const toggleKeywordEnabled = async (id: string, currentEnabled: boolean) => {
    try {
      const updatedKeywords = keywords.map(kw => 
        kw.id === id ? { ...kw, enabled: !currentEnabled } : kw
      )
      
      setKeywords(updatedKeywords)
      
      // Aquí iría la llamada real a la API para actualizar
      // await fetch(`/api/notifications/keywords/${id}`, {
      //   method: 'PATCH',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ enabled: !currentEnabled })
      // })
    } catch (error) {
      console.error('Error al actualizar estado de palabra clave:', error)
      
      // Revertir el cambio en caso de error
      setKeywords(keywords)
      
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado de la palabra clave",
        variant: "destructive"
      })
    }
  }
  
  // Iniciar edición de una palabra clave
  const startEditingKeyword = (id: string, value: string) => {
    setEditingKeywordId(id)
    setEditingKeywordValue(value)
  }
  
  // Guardar la edición de una palabra clave
  const saveKeywordEdit = async (id: string) => {
    if (!editingKeywordValue.trim()) {
      toast({
        title: "Error",
        description: "La palabra clave no puede estar vacía",
        variant: "destructive"
      })
      return
    }
    
    try {
      // Actualizar el estado local
      const updatedKeywords = keywords.map(kw => 
        kw.id === id ? { ...kw, keyword: editingKeywordValue.trim() } : kw
      )
      
      setKeywords(updatedKeywords)
      setEditingKeywordId(null)
      setEditingKeywordValue("")
      
      // Aquí iría la llamada real a la API para actualizar
      // await fetch(`/api/notifications/keywords/${id}`, {
      //   method: 'PATCH',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ keyword: editingKeywordValue.trim() })
      // })
      
      toast({
        title: "Palabra clave actualizada",
        description: "La palabra clave se ha actualizado con éxito",
        variant: "default",
        className: "bg-green-500 text-white"
      })
    } catch (error) {
      console.error('Error al actualizar palabra clave:', error)
      toast({
        title: "Error",
        description: "No se pudo actualizar la palabra clave",
        variant: "destructive"
      })
    }
  }
  
  // Eliminar una palabra clave
  const deleteKeyword = async (id: string) => {
    try {
      // Actualizar el estado local
      setKeywords(keywords.filter(kw => kw.id !== id))
      
      // Aquí iría la llamada real a la API para eliminar
      // await fetch(`/api/notifications/keywords/${id}`, {
      //   method: 'DELETE'
      // })
      
      toast({
        title: "Palabra clave eliminada",
        description: "La palabra clave se ha eliminado con éxito",
        variant: "default",
        className: "bg-green-500 text-white"
      })
    } catch (error) {
      console.error('Error al eliminar palabra clave:', error)
      
      // Recargar las palabras clave en caso de error
      loadKeywordNotifications()
      
      toast({
        title: "Error",
        description: "No se pudo eliminar la palabra clave",
        variant: "destructive"
      })
    }
  }
  
  // Cancelar la edición
  const cancelKeywordEdit = () => {
    setEditingKeywordId(null)
    setEditingKeywordValue("")
  }

  // Guardar la configuración del asistente con retroalimentación mejorada
  const saveAssistantConfig = async () => {
    try {
      setLoading(true)
      setSaveSuccess(false)
      
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updateAssistant',
          config: {
            name: assistantName,
            instructions: systemPrompt,
            vector_store_id: vectorStoreId
          }
        })
      })

      const data = await response.json()
      if (data.success) {
        setSaveSuccess(true)
        toast({
          title: "Configuración Guardada",
          description: "Los cambios se han guardado correctamente. Recuerda reiniciar el servidor para aplicarlos.",
          variant: "default",
          className: "bg-green-500 text-white"
        })
      } else {
        console.error("Error al guardar:", data.error)
        toast({
          title: "Error",
          description: data.error || "No se pudo guardar la configuración",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error inesperado:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error al comunicarse con el servidor",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
      // Desactivar la indicación de éxito después de 3 segundos
      setTimeout(() => {
        setSaveSuccess(false)
      }, 3000)
    }
  }

  // Manejar la carga de archivos
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles(Array.from(e.target.files))
      setUploadError(null)
    }
  }

  const uploadFiles = async () => {
    if (!vectorStoreId) {
      setUploadError("Se requiere un ID de Vector Store válido para subir archivos")
      return
    }

    if (uploadedFiles.length === 0) {
      setUploadError("Por favor, selecciona al menos un archivo para subir")
      return
    }

    try {
      setUploading(true)
      setUploadError(null)
      setUploadSuccess(false)
      
      console.log("Preparando archivos para subir:", uploadedFiles.map(f => f.name))
      console.log("Vector Store ID:", vectorStoreId)
      
      const formData = new FormData()
      uploadedFiles.forEach(file => {
        formData.append('files', file)
        console.log(`Añadido archivo a FormData: ${file.name}, tamaño: ${file.size} bytes`)
      })
      formData.append('vector_store_id', vectorStoreId)
      
      console.log("Enviando solicitud a /api/assistant/upload...")
      
      try {
        const response = await fetch('/api/assistant/upload', {
          method: 'POST',
          body: formData
        })

        console.log("Respuesta HTTP:", response.status, response.statusText)
        
        // Intentar leer el cuerpo de la respuesta
        let data
        try {
          data = await response.json()
          console.log("Datos de respuesta:", data)
        } catch (jsonError) {
          console.error("Error al parsear la respuesta JSON:", jsonError)
          throw new Error(`Error al procesar la respuesta: ${response.statusText}`)
        }
        
        if (data.success) {
          setUploadSuccess(true)
          setUploadedFiles([])
          toast({
            title: "Archivos Subidos",
            description: "Los documentos se han subido correctamente a OpenAI",
            variant: "default",
            className: "bg-green-500 text-white"
          })
        } else {
          console.error("Error al subir:", data.error)
          setUploadError(data.error || "No se pudieron subir los archivos")
          toast({
            title: "Error",
            description: data.error || "No se pudieron subir los archivos",
            variant: "destructive"
          })
        }
      } catch (fetchError: any) {
        console.error("Error en la solicitud fetch:", fetchError)
        setUploadError(`Error de red: ${fetchError.message}`)
        toast({
          title: "Error de Red",
          description: `No se pudo conectar con el servidor: ${fetchError.message}`,
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error inesperado:", error)
      setUploadError("Ocurrió un error al comunicarse con el servidor")
      toast({
        title: "Error",
        description: "Ocurrió un error al comunicarse con el servidor",
        variant: "destructive"
      })
    } finally {
      setUploading(false)
      // Desactivar la indicación de éxito después de 3 segundos
      setTimeout(() => {
        setUploadSuccess(false)
      }, 3000)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center">
          <Settings className="h-8 w-8 mr-3 text-[#40E0D0]" />
          <h1 className="text-3xl font-bold">Configuración del Sistema</h1>
        </div>
        <Button 
          variant="outline" 
          className="flex items-center"
          onClick={() => window.location.href = '/dashboard'}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Regresar al Dashboard
        </Button>
      </div>
      
      <Tabs defaultValue="openai" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="openai">
            <MessageCircle className="h-4 w-4 mr-2" />
            OpenAI
          </TabsTrigger>
          <TabsTrigger value="documentos">
            <FileText className="h-4 w-4 mr-2" />
            Documentos
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notificaciones
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Seguridad
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="h-4 w-4 mr-2" />
            Usuarios
          </TabsTrigger>
        </TabsList>
        
        {/* Configuración de OpenAI */}
        <TabsContent value="openai">
          <div className="grid gap-6 lg:grid-cols-1">
            <Card>
              <CardHeader>
                <CardTitle>Datos del Asistente</CardTitle>
                <CardDescription>
                  Configura la información básica y comportamiento de tu asistente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="assistantName">Nombre del Asistente</Label>
                  <Input
                    id="assistantName"
                    placeholder="Ej: Asistente de Ventas"
                    value={assistantName}
                    onChange={(e) => setAssistantName(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="systemPrompt">Instrucciones del Sistema</Label>
                  <Textarea
                    id="systemPrompt"
                    placeholder="Instrucciones detalladas sobre cómo debe comportarse el asistente..."
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="min-h-[150px]"
                    disabled={loading}
                  />
                  <p className="text-sm text-muted-foreground">
                    Define la personalidad, conocimientos y límites del asistente. Sé específico.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vectorStoreId">ID del Vector Store</Label>
                  <Input
                    id="vectorStoreId"
                    placeholder="Ej: vs_abc123xyz456"
                    value={vectorStoreId}
                    onChange={(e) => setVectorStoreId(e.target.value)}
                    disabled={loading}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      ID del Vector Store de OpenAI donde se almacenarán los documentos.
                    </p>
                    {businessConfig && businessConfig.vector_store_id && (
                      <p className="text-xs text-blue-600">
                        Vector Store asociado: {businessConfig.vector_store_id.substring(0, 12)}...
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="mt-6 flex justify-end">
            <Button 
              onClick={saveAssistantConfig}
              disabled={loading}
              className={saveSuccess ? "bg-green-500 hover:bg-green-600" : ""}
              size="lg"
            >
              {loading ? (
                <span className="flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </span>
              ) : saveSuccess ? (
                <span className="flex items-center">
                  <Check className="mr-2 h-4 w-4" />
                  ¡Guardado con éxito!
                </span>
              ) : (
                <span className="flex items-center">
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Configuración
                </span>
              )}
            </Button>
          </div>
        </TabsContent>
        
        {/* Nueva pestaña de Documentos */}
        <TabsContent value="documentos">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Subir Documentos</CardTitle>
                <CardDescription>
                  Sube archivos para que el asistente los consulte y use como referencia
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-md p-6 flex flex-col items-center justify-center bg-gray-50">
                  <FileUp className="h-10 w-10 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500 mb-2">Sube archivos para que el asistente pueda consultarlos</p>
                  <p className="text-xs text-gray-400 mb-3">PDF, DOCX, TXT, CSV (máx. 20MB)</p>
                  
                  {!vectorStoreId && (
                    <div className="text-center p-3 bg-amber-50 border border-amber-200 rounded-md w-full max-w-sm mb-3">
                      <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-2" />
                      <p className="text-sm text-amber-700">
                        Se requiere un ID de Vector Store válido para subir archivos.
                      </p>
                      <p className="text-xs text-amber-600 mt-1">
                        Por favor, especifique un ID en la sección de Datos del Asistente.
                      </p>
                    </div>
                  )}
                  
                  {vectorStoreId && (
                    <>
                      <Input
                        type="file"
                        id="file-upload-documentos"
                        className="hidden"
                        onChange={handleFileChange}
                        multiple
                        accept=".pdf,.docx,.txt,.csv"
                        disabled={uploading}
                      />
                      <div className="flex flex-col gap-3 w-full max-w-sm">
                        <Label
                          htmlFor="file-upload-documentos"
                          className="cursor-pointer bg-white border border-gray-300 rounded-md py-2 px-4 flex items-center justify-center text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Seleccionar archivos
                        </Label>
                        
                        {uploadedFiles.length > 0 && (
                          <div className="mt-2">
                            <p className="text-sm font-medium text-gray-700 mb-1">{uploadedFiles.length} archivo(s) seleccionado(s):</p>
                            <ul className="text-xs text-gray-500 space-y-1 max-h-20 overflow-auto">
                              {uploadedFiles.map((file, index) => (
                                <li key={index}>{file.name}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        <Button 
                          onClick={uploadFiles} 
                          disabled={uploading || uploadedFiles.length === 0}
                          className={uploadSuccess ? "bg-green-500 hover:bg-green-600" : ""}
                        >
                          {uploading ? (
                            <span className="flex items-center">
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Subiendo...
                            </span>
                          ) : uploadSuccess ? (
                            <span className="flex items-center">
                              <Check className="mr-2 h-4 w-4" />
                              ¡Subido con éxito!
                            </span>
                          ) : (
                            <span className="flex items-center">
                              <Upload className="mr-2 h-4 w-4" />
                              Subir a OpenAI
                            </span>
                          )}
                        </Button>
                        
                        {uploadError && (
                          <div className="text-red-500 text-xs mt-1">
                            {uploadError}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  
                  {vectorStoreId && (
                    <div className="text-xs text-blue-600 mt-3">
                      Los archivos se subirán al Vector Store: <span className="font-medium">{vectorStoreId}</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Los documentos subidos se guardarán en el Vector Store especificado y estarán disponibles para su consulta por el asistente.
                </p>
              </CardContent>
            </Card>
            
            {/* Lista de archivos existentes */}
            <Card>
              <CardHeader>
                <CardTitle>Documentos Existentes</CardTitle>
                <CardDescription>
                  Gestiona los documentos que ya has subido al Vector Store
                </CardDescription>
              </CardHeader>
              <CardContent>
                {vectorStoreId ? (
                  <DocumentFilesList 
                    vectorStoreId={vectorStoreId}
                    businessId={businessConfig?.id}
                    onFileDeleted={() => toast({
                      title: "Archivo eliminado",
                      description: "El documento ha sido eliminado correctamente",
                      variant: "default",
                      className: "bg-green-500 text-white"
                    })}
                  />
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-center">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-2" />
                    <p className="text-sm text-amber-700">
                      Se requiere un ID de Vector Store válido para ver los documentos.
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      Configura el Vector Store ID en la sección OpenAI.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Modificación de la pestaña de Notificaciones */}
        <TabsContent value="notifications">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Notificaciones</CardTitle>
                <CardDescription>
                  Configura qué notificaciones recibir y cómo recibirlas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="push-notifications">Notificaciones Push</Label>
                  <Switch id="push-notifications" />
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="email-notifications">Notificaciones por Email</Label>
                  <Switch id="email-notifications" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Palabras Clave para Notificaciones</CardTitle>
                <CardDescription>
                  Define palabras clave que activarán notificaciones y cambios en el dashboard cuando aparezcan en las conversaciones
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="Nueva palabra clave"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    disabled={savingKeyword}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addKeyword();
                      }
                    }}
                  />
                  <Button 
                    variant="outline" 
                    onClick={addKeyword}
                    disabled={!newKeyword.trim() || savingKeyword}
                  >
                    {savingKeyword ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PlusCircle className="h-4 w-4 mr-1" />
                    )}
                    Añadir
                  </Button>
                </div>
                
                {loadingKeywords ? (
                  <div className="flex justify-center items-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    <span className="ml-2 text-sm text-gray-500">Cargando palabras clave...</span>
                  </div>
                ) : keywords.length === 0 ? (
                  <div className="bg-blue-50 text-blue-700 p-4 rounded-md text-center">
                    <p>No hay palabras clave configuradas</p>
                    <p className="text-sm mt-1">Añade palabras clave para activar notificaciones automáticas</p>
                  </div>
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    <div className="max-h-[300px] overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Palabra Clave</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {keywords.map((keyword) => (
                            <tr key={keyword.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4">
                                {editingKeywordId === keyword.id ? (
                                  <Input
                                    value={editingKeywordValue}
                                    onChange={(e) => setEditingKeywordValue(e.target.value)}
                                    className="max-w-[180px]"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        saveKeywordEdit(keyword.id);
                                      }
                                      if (e.key === 'Escape') {
                                        e.preventDefault();
                                        cancelKeywordEdit();
                                      }
                                    }}
                                  />
                                ) : (
                                  <div className="text-base font-medium text-gray-900 break-words max-w-[180px]">
                                    {keyword.keyword}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Switch 
                                  checked={keyword.enabled} 
                                  onCheckedChange={() => toggleKeywordEnabled(keyword.id, keyword.enabled)}
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                {editingKeywordId === keyword.id ? (
                                  <div className="space-x-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => saveKeywordEdit(keyword.id)}
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={cancelKeywordEdit}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="space-x-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => startEditingKeyword(keyword.id, keyword.keyword)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => deleteKeyword(keyword.id)}
                                    >
                                      <Trash className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                <p className="text-sm text-gray-500 mt-4">
                  Las palabras clave definidas activarán notificaciones automáticas cuando aparezcan en las conversaciones. 
                  También moverán a los clientes a la columna de prioridad en el dashboard.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Seguridad</CardTitle>
              <CardDescription>
                Administra la seguridad de tu cuenta y negocio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Contraseña Actual</Label>
                <Input id="current-password" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Nueva Contraseña</Label>
                <Input id="new-password" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Contraseña</Label>
                <Input id="confirm-password" type="password" />
              </div>
              <Button className="w-full">Actualizar Contraseña</Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Gestión de Usuarios</CardTitle>
              <CardDescription>
                Administra usuarios y permisos de tu negocio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Próximamente: Administración de usuarios y permisos del sistema.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Componente para mostrar y gestionar archivos existentes
function DocumentFilesList({ vectorStoreId, businessId, onFileDeleted }: DocumentFilesListProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState({ show: false, message: '', isError: false });
  
  // Función para cargar los archivos
  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (vectorStoreId) params.append('vector_store_id', vectorStoreId);
      if (businessId) params.append('business_id', businessId);
      
      const response = await fetch(`/api/assistant/vector-files?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setFiles(data.files || []);
      } else {
        setError(data.error || 'Error al cargar archivos');
        setFiles([]);
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Función para eliminar un archivo
  const deleteFile = async (fileId: string) => {
    if (!vectorStoreId) {
      setNotification({
        show: true,
        message: 'No se pudo determinar el Vector Store ID',
        isError: true
      });
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch('/api/assistant/vector-files', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vector_store_id: vectorStoreId,
          file_id: fileId,
          business_id: businessId
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setNotification({
          show: true,
          message: 'Archivo eliminado correctamente',
          isError: false
        });
        // Actualizar la lista después de eliminar
        setFiles(files.filter(file => file.id !== fileId));
        // Llamar al callback si existe
        if (onFileDeleted) onFileDeleted();
      } else {
        setNotification({
          show: true,
          message: data.error || 'Error al eliminar archivo',
          isError: true
        });
      }
    } catch (err: any) {
      setNotification({
        show: true,
        message: err.message || 'Error de conexión',
        isError: true
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Ocultar notificación después de 3 segundos
  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification({ ...notification, show: false });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);
  
  // Cargar archivos al montar el componente
  useEffect(() => {
    if (vectorStoreId) {
      loadFiles();
    }
  }, [vectorStoreId, businessId]);
  
  // Formatear tamaño de archivo
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Archivos disponibles</h3>
        <Button 
          variant="outline"
          size="sm"
          onClick={loadFiles}
          disabled={loading}
          className="flex items-center"
        >
          {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
          {loading ? "Cargando..." : "Actualizar"}
        </Button>
      </div>
      
      {notification.show && (
        <div className={`px-4 py-3 rounded mb-4 ${notification.isError ? 'bg-red-100 text-red-700 border border-red-400' : 'bg-green-100 text-green-700 border border-green-400'}`}>
          {notification.message}
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : files.length === 0 ? (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-5 rounded text-center">
          <p>No hay documentos subidos en este Vector Store.</p>
          <p className="text-sm mt-1">Sube archivos usando el formulario superior.</p>
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <div className="overflow-x-auto max-w-full max-h-[400px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Archivo</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tamaño</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-base font-medium text-gray-900 break-words max-w-[180px]" title={file.filename}>
                        {file.filename}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        <span className="text-gray-400">ID:</span> <span className="font-mono">{file.id.substring(0, 8)}...</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{formatFileSize(file.bytes)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${file.status === 'processed' ? 'bg-green-100 text-green-800' : 
                          file.status === 'error' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {file.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteFile(file.id)}
                        disabled={loading}
                      >
                        Eliminar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
} 