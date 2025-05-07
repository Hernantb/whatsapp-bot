# WhatsApp Bot con OpenAI y Gupshup

Este proyecto implementa un bot de WhatsApp que utiliza la API de OpenAI para responder mensajes y la integración con Gupshup para enviar/recibir mensajes de WhatsApp.

## Estructura del Proyecto

- `index.js` - El archivo principal que contiene la lógica del bot
- `direct-port-fix.js` - Script para solucionar problemas de puerto en Render
- `notification-patch.cjs` - Módulo para manejar notificaciones
- `global-patch.js` - Módulo para configuraciones globales

## Despliegue en Render

### Configuración Importante

⚠️ **NOTA SOBRE PUERTOS**: Este proyecto utiliza Next.js y Express en el mismo repositorio, lo que puede causar conflictos de puerto. Para evitar estos problemas:

1. El proyecto configura Next.js para usar el puerto 3000 (predeterminado)
2. El bot de WhatsApp utiliza el puerto 10000 (configurado por `direct-port-fix.js`)

### Pasos para Desplegar en Render

1. Crea un nuevo servicio Web en Render
2. Conecta tu repositorio de GitHub
3. Configura las siguientes opciones:
   - **Nombre**: `whatsapp-bot`
   - **Entorno**: `Node`
   - **Buildcommand**: `npm install`
   - **Start Command**: `node direct-port-fix.js`
   - **Plan**: `Starter` o según tus necesidades
   - **Región**: La más cercana a tus usuarios

4. Configura las siguientes variables de entorno:
   ```
   NODE_ENV=production
   RENDER=true
   PORT=10000
   FORCE_PORT=10000
   OPENAI_MODEL=gpt-4-turbo-preview
   OPENAI_API_KEY=tu-api-key
   GUPSHUP_API_KEY=tu-api-key
   GUPSHUP_NUMBER=tu-numero
   GUPSHUP_USERID=tu-userid
   SUPABASE_URL=tu-url
   SUPABASE_KEY=tu-key
   CONTROL_PANEL_URL=https://tu-dominio.onrender.com/api/register-bot-response
   BUSINESS_ID=tu-business-id
   ```

5. Crea el servicio y espera a que se complete el despliegue

### Diagnóstico y Solución de Problemas

Si encuentras errores con el puerto al desplegar:

1. Verifica los logs para identificar el error: `Error: listen EADDRINUSE: address already in use :::3000`
2. Asegúrate de que estás utilizando `direct-port-fix.js` como punto de entrada
3. Verifica que `render.yaml` tenga configurado correctamente:
   ```yaml
   PORT: 10000
   FORCE_PORT: 10000
   ```

4. Si sigues teniendo problemas, puedes modificar manualmente `direct-port-fix.js` para forzar el uso del puerto 10000

## Desarrollo Local

Para ejecutar el proyecto localmente:

```bash
# Iniciar el bot WhatsApp
npm run start

# Para desarrollo con Next.js
npm run dev
```

## Recursos Adicionales

- [Documentación de Render](https://render.com/docs)
- [API de OpenAI](https://platform.openai.com/docs/api-reference)
- [API de Gupshup para WhatsApp](https://www.gupshup.io/developer/docs/whatsapp-api)
