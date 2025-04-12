# WhatsApp Bot con OpenAI y Gupshup

Este servidor conecta WhatsApp (vía Gupshup) con OpenAI para crear un chatbot inteligente que se integra con un panel de control.

## Funcionalidades

- Recibe mensajes de WhatsApp a través de Gupshup
- Procesa los mensajes con OpenAI (usando la API de Asistentes v2)
- Envía respuestas automáticas a los usuarios
- Registra las respuestas del bot en un servidor de control panel que usa Supabase

## Configuración

1. Clona este repositorio
2. Instala las dependencias:
   ```
   npm install
   ```
3. Copia `.env.example` a `.env` y configura las variables de entorno:
   ```
   cp .env.example .env
   ```
4. Edita el archivo `.env` con tus claves API de OpenAI y Gupshup
5. Configura la variable `CONTROL_PANEL_URL` con la URL de tu servidor de control panel

## Variables de Entorno

- `OPENAI_API_KEY`: Tu clave API de OpenAI
- `GUPSHUP_API_KEY`: Tu clave API de Gupshup
- `GUPSHUP_NUMBER`: Número de WhatsApp configurado en Gupshup
- `CONTROL_PANEL_URL`: URL del servidor de control panel (debe incluir `/register-bot-response`)
- `PORT`: Puerto en el que se ejecutará el servidor (por defecto: 3000)
- `LOG_LEVEL`: Nivel de detalle de los logs (valores: debug, info, warn, error)
- `FORCE_SAVE_TO_SUPABASE`: Si debe forzar el guardado en Supabase (true/false)

## Uso

Inicia el servidor:

```
npm start
```

El servidor se iniciará en el puerto especificado (por defecto 3000).

## Configuración en Producción

### ⚠️ IMPORTANTE: URL del Panel de Control

Cuando despliegues este servidor en Render, debes configurar `CONTROL_PANEL_URL` correctamente con el endpoint `/register-bot-response`. Este valor es **crítico** para que el bot funcione adecuadamente y pueda guardar los mensajes en Supabase.

```
# ❌ INCORRECTO - NO usar estos valores en producción
CONTROL_PANEL_URL=http://localhost:3001
CONTROL_PANEL_URL=https://api.openai.com
CONTROL_PANEL_URL=https://render-wa.onrender.com   # Sin el endpoint

# ✅ CORRECTO - Usar la URL real de tu panel de control con el endpoint específico
CONTROL_PANEL_URL=https://render-wa.onrender.com/register-bot-response
```

### Otras variables para producción

También es recomendable configurar estas variables en Render:

```
NODE_ENV=production
LOG_LEVEL=debug
FORCE_SAVE_TO_SUPABASE=true
```

Esto mejorará la robustez y facilitará la solución de problemas.

## Guía de configuración completa

Para que el sistema funcione correctamente necesitas dos servicios en Render:

1. **Panel de Control**: Gestiona las conversaciones y se integra con Gupshup
   - URL típica: `https://render-wa.onrender.com`
   - Endpoints importantes: `/webhook`, `/register-bot-response`

2. **Bot de WhatsApp** (este servicio): Proporciona respuestas automáticas con OpenAI
   - Debe apuntar al panel de control para registrar sus respuestas

### Pasos de verificación

Si has actualizado la configuración y siguen habiendo problemas, ejecuta el script de verificación en el panel de control:

```bash
npm run verify:integration
```

Este script verificará que ambos servicios estén conectados correctamente.

## Cómo configurar variables en Render

1. Ve al panel de control de Render
2. Selecciona tu servicio
3. Haz clic en "Environment" en el menú lateral
4. Agrega o actualiza las variables de entorno
5. Haz clic en "Save Changes" y luego en "Manual Deploy" > "Deploy latest commit"

## Solución de problemas con el registro de respuestas

Si ves errores como `❌ Error al registrar respuesta en el control panel: Request failed with status code 401` o `404`, sigue estos pasos:

1. **Verifica el valor de CONTROL_PANEL_URL**:
   - Debe ser la URL completa del panel incluyendo `/register-bot-response`
   - Ejemplo correcto: `https://render-wa.onrender.com/register-bot-response`
   - No debe contener `api.openai.com` ni localhost

2. **Comprueba los logs**: 
   - El bot ahora proporciona información detallada sobre los errores
   - Busca mensajes que empiecen con 🚨 (error grave) o ⚠️ (advertencia)
   
3. **Asegúrate de que el endpoint existe**:
   - Confirma que tu panel de control tiene un endpoint `/register-bot-response`
   - Ejecuta `curl -X POST https://render-wa.onrender.com/register-bot-response` para probar

## Webhook de Gupshup

Configura el webhook de Gupshup para que apunte al endpoint `/webhook` del panel de control:

```
https://render-wa.onrender.com/webhook
```

## Verificación del sistema completo

Para probar que todo el sistema funciona correctamente:

1. Envía un mensaje al número de WhatsApp configurado en Gupshup
2. Verifica en los logs del bot que recibe y procesa el mensaje
3. Comprueba que la respuesta se registra en el panel de control
4. Confirma que el usuario recibe la respuesta en WhatsApp
