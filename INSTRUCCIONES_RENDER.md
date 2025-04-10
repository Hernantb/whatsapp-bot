
# Instrucciones para desplegar el WhatsApp Bot en Render

## Resumen de cambios aplicados

Se han realizado las siguientes correcciones en el código:

1. ✅ Eliminación de funciones duplicadas
2. ✅ Instalación del sistema de notificaciones
3. ✅ Corrección de errores de linter
4. ✅ Configuración de variables de entorno para notificaciones

## Configuración del Servicio Web en Render

1. Crea un nuevo Web Service en Render
2. Conecta tu repositorio Git
3. Configura los siguientes parámetros:
   - Name: whatsapp-bot
   - Environment: Node
   - Build Command: npm install
   - Start Command: node index.js
   - Plan: Free (o el plan que prefieras)

## Variables de Entorno a Configurar

Asegúrate de configurar las siguientes variables de entorno en el panel de Render:

- NOTIFICATION_EMAIL
- EMAIL_USER
- EMAIL_PASSWORD
- EMAIL_HOST
- EMAIL_PORT
- GUPSHUP_API_KEY
- GUPSHUP_NUMBER
- GUPSHUP_USERID
- OPENAI_API_KEY
- SUPABASE_URL
- SUPABASE_KEY

## Notas Importantes

- El sistema de notificaciones está completamente instalado y configurado
- Se enviarán notificaciones por correo cuando el bot detecte mensajes que requieran atención humana
- Asegúrate de que las credenciales de GupShup y OpenAI sean válidas
- Para recibir notificaciones, asegúrate de que los valores de EMAIL_USER, EMAIL_PASSWORD y NOTIFICATION_EMAIL sean correctos

## Después del Despliegue

1. Verifica que el servidor esté en línea visitando la URL proporcionada por Render
2. Prueba el endpoint /status para confirmar que todo funciona correctamente
3. Prueba el endpoint /test-notification para verificar que las notificaciones funcionan correctamente

Preparado: 2025-04-10T05:06:38.256Z
