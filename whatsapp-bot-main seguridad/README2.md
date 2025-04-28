# WhatsApp Bot con OpenAI y Gupshup

Este servidor conecta WhatsApp (vía Gupshup) con OpenAI para crear un chatbot inteligente, y registra las respuestas en un panel de control con Supabase.

## Funcionalidades

- Recibe mensajes de WhatsApp a través de Gupshup
- Procesa los mensajes con OpenAI (usando la API de Asistentes v2)
- Envía respuestas automáticas a los usuarios
- **NUEVO**: Registra las respuestas del bot en el servidor del panel de control (my-backend-project)

## Configuración

1. Clona este repositorio
2. Instala las dependencias:
   ```
   npm install
   ```
3. Configura las variables de entorno en el archivo `.env`:
   ```
   # Completa con tus claves API
   OPENAI_API_KEY=sk-...
   GUPSHUP_API_KEY=...
   GUPSHUP_NUMBER=...
   
   # URL del servidor de control panel
   CONTROL_PANEL_URL=http://localhost:4000
   ```

## Uso

Inicia el servidor:

```
npm start
```

El servidor se iniciará en el puerto 3000 (o el que configures en la variable `PORT`).

## Integración con el Panel de Control

Este bot ahora envía automáticamente las respuestas al servidor del panel de control (my-backend-project) cada vez que responde a un usuario. Para que esto funcione:

1. Asegúrate de que el servidor del panel de control esté funcionando
2. Configura correctamente la URL en `CONTROL_PANEL_URL` en el archivo `.env`
3. El servidor debe tener un endpoint `/register-bot-response` configurado (ya implementado en my-backend-project)

## Estructura del Proyecto

- `index.js`: Archivo principal que contiene la lógica del servidor
- `.env`: Archivo de configuración con variables de entorno
- `package.json`: Configuración del proyecto y dependencias

## Dependencias

- Express: Framework para el servidor web
- Axios: Cliente HTTP para realizar peticiones
- Dotenv: Para cargar variables de entorno 