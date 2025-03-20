# WhatsApp Bot con OpenAI y Gupshup

Este servidor conecta WhatsApp (vía Gupshup) con OpenAI para crear un chatbot inteligente.

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
- `CONTROL_PANEL_URL`: URL del servidor de control panel (por defecto: http://localhost:4000)
- `PORT`: Puerto en el que se ejecutará el servidor (por defecto: 3000)

## Uso

Inicia el servidor:

```
npm start
```

El servidor se iniciará en el puerto especificado (por defecto 3000).

## Integración con el Panel de Control

Este servidor envía las respuestas del bot al servidor de control panel configurado en `CONTROL_PANEL_URL`, permitiendo que aparezcan en el panel de control y se almacenen en la base de datos Supabase.

Para que la integración funcione correctamente:

1. Asegúrate de que el servidor de control panel esté funcionando
2. El servidor de control panel debe tener un endpoint `/register-bot-response` configurado
3. Configura correctamente la URL en la variable `CONTROL_PANEL_URL`

## Webhook de Gupshup

Configura el webhook de Gupshup para que apunte a:

```
https://tu-servidor.com/webhook
```

Reemplaza `tu-servidor.com` con la URL pública de tu servidor.