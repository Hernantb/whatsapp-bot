# WhatsApp Business API Panel de Control

Este proyecto es un panel de control para gestionar conversaciones de WhatsApp Business a través de Gupshup y la API oficial de WhatsApp.

## Configuración

### Variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto con las siguientes variables:

```
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_de_supabase
GUPSHUP_API_KEY=tu_clave_de_gupshup
```

### Configuración de Gupshup

1. Accede a tu panel de Gupshup
2. Configura el webhook para recibir mensajes:
   - URL del webhook: `https://render-wa.onrender.com/webhook`
   - Método: POST
   - Tipo de contenido: application/json

## Endpoints API

### Webhook principal
- **URL**: `/webhook`
- **Método**: POST
- **Descripción**: Recibe mensajes de WhatsApp en diferentes formatos y los procesa.

### Registro de respuestas del bot
- **URL**: `/api/register-bot-response` o `/register-bot-response` (redirige automáticamente)
- **Método**: POST
- **Cuerpo**: `{ "conversationId": "id_del_usuario", "message": "texto_del_mensaje", "business_id": "id_del_negocio" }`
- **Descripción**: Permite al bot registrar sus respuestas automáticas en el panel de control.

### Actualizar color de chat
- **URL**: `/update-chat-color`
- **Método**: POST
- **Cuerpo**: `{ "conversationId": "uuid", "color": "#hexcode" }`

### Activar/desactivar bot
- **URL**: `/toggle-bot`
- **Método**: POST
- **Cuerpo**: `{ "conversationId": "uuid", "isActive": boolean }`

## Estructura de la base de datos

### Tablas principales
- `businesses`: Información de los negocios
- `conversations`: Conversaciones entre usuarios y negocios
- `messages`: Mensajes individuales dentro de las conversaciones

## Despliegue

El proyecto está configurado para desplegarse automáticamente en Render cuando se suben cambios al repositorio de GitHub.

## Conexión con el Bot de WhatsApp

Para que el bot de WhatsApp pueda registrar las conversaciones en este panel de control, debe configurar la URL del panel correctamente:

1. En el código del bot de WhatsApp, busca la variable de entorno `CONTROL_PANEL_URL`.

2. Establece la URL completa del panel de control incluyendo la ruta del API:

```js
// Ejemplo en el archivo .env del bot
CONTROL_PANEL_URL=https://render-wa.onrender.com
```

El bot automáticamente usará la ruta `/api/register-bot-response` para registrar las respuestas.

## Solución de Problemas

Si encuentras errores 404 al registrar mensajes:

1. Verifica que ambas rutas funcionen correctamente:
   - `/api/register-bot-response` (ruta principal)
   - `/register-bot-response` (ruta alternativa)

2. Confirma que el middleware esté configurado correctamente para permitir estas rutas sin autenticación.

3. Revisa los logs tanto del panel como del bot para identificar posibles problemas.

## Información técnica

Este panel utiliza Next.js con una API route para manejar el registro de respuestas del bot. El middleware está configurado para permitir ciertas rutas sin autenticación y redireccionar automáticamente las variantes de la ruta de registro. 