# Implementación de Arquitectura Multi-Tenant

Este documento describe los pasos para implementar una arquitectura multi-tenant con separación por ID de negocio para el sistema de WhatsApp Bot con IA.

## Arquitectura Multi-Tenant con Separación por ID de Negocio

Esta arquitectura permite gestionar múltiples empresas en un único servidor, cada una con su propia configuración de WhatsApp (Gupshup), OpenAI y otros parámetros específicos.

## Pasos de Implementación

### 1. Crear la tabla de configuración de negocios

```sql
-- Ejecutar en el SQL Editor de Supabase
CREATE TABLE business_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  gupshup_api_key TEXT NOT NULL,
  gupshup_number TEXT NOT NULL,
  gupshup_userid TEXT,
  openai_api_key TEXT,
  openai_assistant_id TEXT NOT NULL,
  system_prompt TEXT,
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configurar seguridad a nivel de fila (RLS)
ALTER TABLE business_config ENABLE ROW LEVEL SECURITY;

-- Política para administradores
CREATE POLICY "Los administradores pueden ver todas las configuraciones" 
ON business_config FOR SELECT 
USING (
  auth.uid() IN (
    SELECT user_id FROM business_users WHERE role = 'admin'
  )
);

-- Política para usuarios de negocio
CREATE POLICY "Los usuarios solo ven su propio negocio" 
ON business_config FOR SELECT 
USING (
  id IN (
    SELECT business_id FROM business_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
);
```

### 2. Migrar la configuración del negocio actual

```javascript
// migrate-business-config.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Usar configuración actual
const { SUPABASE_URL, SUPABASE_KEY, BUSINESS_ID } = require('./supabase-config');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function migrateConfig() {
  try {
    // Datos del negocio actual
    const businessConfig = {
      id: BUSINESS_ID, // Usar el ID existente
      business_name: "Empresa Original", 
      gupshup_api_key: process.env.GUPSHUP_API_KEY,
      gupshup_number: process.env.GUPSHUP_NUMBER,
      gupshup_userid: process.env.GUPSHUP_USERID,
      openai_api_key: process.env.OPENAI_API_KEY,
      openai_assistant_id: process.env.ASSISTANT_ID || 'asst_bdJlX30wF1qQH3Lf8ZoiptVx',
      system_prompt: process.env.SYSTEM_PROMPT || `Eres un asistente de ventas amigable...`,
      webhook_url: process.env.CONTROL_PANEL_URL,
      is_active: true
    };

    // Insertar en la nueva tabla
    const { data, error } = await supabase
      .from('business_config')
      .upsert(businessConfig)
      .select();

    if (error) {
      console.error('Error al migrar la configuración:', error);
      return;
    }

    console.log('✅ Configuración migrada correctamente:', data);
  } catch (err) {
    console.error('Error en el proceso de migración:', err);
  }
}

migrateConfig();
```

### 3. Modificar el servidor para usar la configuración dinámica

Añadir al principio de `index.js` después de cargar las variables de entorno:

```javascript
// Caché para configuraciones de negocios, mapeado por número de WhatsApp
const businessConfigCache = new Map();

// Función para cargar todas las configuraciones de negocios
async function loadAllBusinessConfigs() {
  try {
    console.log('🔄 Cargando configuraciones de negocios desde Supabase...');
    
    const { data, error } = await supabase
      .from('business_config')
      .select('*')
      .eq('is_active', true);
      
    if (error) {
      console.error('❌ Error al cargar configuraciones:', error.message);
      return false;
    }
    
    // Limpiar caché actual
    businessConfigCache.clear();
    
    // Poblar caché con nuevos datos
    data.forEach(config => {
      // Mapear por número de WhatsApp para búsqueda rápida
      businessConfigCache.set(config.gupshup_number, config);
      console.log(`✅ Configuración cargada para: ${config.business_name} (${config.gupshup_number})`);
    });
    
    console.log(`📊 Total de negocios configurados: ${businessConfigCache.size}`);
    return true;
  } catch (e) {
    console.error('❌ Error crítico cargando configuraciones:', e.message);
    return false;
  }
}

// Función para obtener configuración por número
function getBusinessConfigByNumber(phoneNumber) {
  return businessConfigCache.get(phoneNumber) || null;
}

// Cargar configuraciones al inicio
console.log('🚀 Iniciando carga de configuraciones de negocios...');
loadAllBusinessConfigs();

// Programar recarga periódica (cada 15 minutos)
setInterval(() => {
  console.log('🔄 Recargando configuraciones de negocios...');
  loadAllBusinessConfigs();
}, 15 * 60 * 1000);
```

### 4. Modificar el manejador del webhook para usar la configuración dinámica

```javascript
// Reemplazar el código del webhook en index.js

app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    console.log(`📩 Mensaje recibido en webhook: ${JSON.stringify(body).substring(0, 500)}...`);
    
    // Extraer datos del mensaje
    const messageData = extractMessageData(body);
    
    // Si es una actualización de estado, solo registrarla
    if (messageData.isStatusUpdate) {
      console.log(`📊 Notificación de estado recibida, no requiere respuesta`);
      return res.sendStatus(200);
    }
    
    const { sender, recipient, message, messageId, isImage, isAudio } = messageData;
    
    // Buscar configuración del negocio según el número RECEPTOR
    const businessConfig = getBusinessConfigByNumber(recipient);
    
    if (!businessConfig) {
      console.log(`⚠️ No se encontró configuración para el número receptor: ${recipient}`);
      return res.sendStatus(200); // Responder OK para evitar reintentos
    }
    
    // Configurar variables dinámicas para este negocio
    const BUSINESS_ID = businessConfig.id;
    const GUPSHUP_API_KEY = businessConfig.gupshup_api_key;
    const GUPSHUP_NUMBER = businessConfig.gupshup_number;
    const ASSISTANT_ID = businessConfig.openai_assistant_id;
    
    console.log(`🏢 Procesando mensaje para negocio: ${businessConfig.business_name}`);
    
    // El resto del código existente sigue igual, pero usando las variables definidas arriba
    // ...
    
    return res.sendStatus(200);
  } catch (error) {
    console.error(`❌ Error procesando webhook: ${error.message}`);
    return res.sendStatus(200); // Siempre responder 200 para evitar reintentos
  }
});
```

### 5. Modificar las funciones clave para usar la configuración dinámica

```javascript
// Modificar la función processMessageWithOpenAI

async function processMessageWithOpenAI(sender, message, conversationId, businessConfig) {
  // Usar configuración específica del negocio
  const OPENAI_API_KEY = businessConfig.openai_api_key || process.env.OPENAI_API_KEY;
  const ASSISTANT_ID = businessConfig.openai_assistant_id;
  const SYSTEM_PROMPT = businessConfig.system_prompt;
  const BUSINESS_ID = businessConfig.id;
  
  // Inicializar OpenAI con la clave específica
  const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });
  
  // El resto de la función sigue igual, pero usando las variables definidas arriba
  // ...
}

// Modificar la función sendWhatsAppResponse

async function sendWhatsAppResponse(recipient, message, businessConfig) {
  // Usar configuración específica del negocio
  const GUPSHUP_API_KEY = businessConfig.gupshup_api_key;
  const GUPSHUP_NUMBER = businessConfig.gupshup_number;
  
  // El resto de la función sigue igual, pero usando las variables definidas arriba
  // ...
}
```

### 6. (Opcional) Gestionar negocios desde Supabase o crear panel de administración

Para empezar puedes gestionar tus empresas directamente desde el panel de Supabase:

1. Ve a la sección "Table Editor" en Supabase
2. Selecciona la tabla `business_config`
3. Usa la interfaz para:
   - Añadir nuevas empresas
   - Editar configuraciones existentes
   - Activar o desactivar empresas cambiando el campo `is_active`

Si posteriormente necesitas una interfaz más amigable, puedes desarrollar una sección en tu dashboard Next.js para gestionar estos datos.

## Ventajas de esta arquitectura

- Un solo servidor gestiona múltiples empresas
- Cada empresa tiene su propia configuración independiente
- Puedes actualizar parámetros sin reiniciar el servidor
- Fácil escalar agregando nuevas empresas desde Supabase
- Las empresas se pueden activar/desactivar sin afectar a las demás

## Consideraciones para producción

1. Asegúrate de cifrar las claves API en reposo en Supabase
2. Implementa un sistema de reintentos para mensajes fallidos
3. Considera un sistema de monitoreo por empresa
4. Respalda periódicamente la tabla `business_config` 