# Instrucciones para Render - WhatsApp Bot

## Configuración para despliegue

1. **Variables de entorno necesarias**:
   - `OPENAI_API_KEY`: Tu clave de API de OpenAI
   - `GUPSHUP_API_KEY`: Clave de la API de GupShup
   - `GUPSHUP_NUMBER`: Número de WhatsApp registrado en GupShup
   - `GUPSHUP_USERID`: ID de usuario de GupShup
   - `SUPABASE_URL`: URL de tu proyecto de Supabase
   - `SUPABASE_KEY`: Clave de Supabase
   - `EMAIL_USER`: Correo electrónico para enviar notificaciones
   - `EMAIL_PASSWORD`: Contraseña para el correo electrónico
   - `NOTIFICATION_EMAIL`: Correo donde recibirás las notificaciones
   - `NODE_ENV`: Establecer como "production"

2. **Comando de inicio**:
   ```
   node index.js
   ```

3. **Build Command**:
   ```
   npm install
   ```

## Dependencias principales

- Express para el servidor web
- OpenAI para el modelo de lenguaje
- Supabase para la base de datos
- Nodemailer para notificaciones por correo
- Axios para peticiones HTTP
- Multer para manejo de archivos

## Endpoints importantes

- `/status`: Verifica el estado del servidor
- `/api/send-manual-message`: Envía mensajes manuales
- `/test-message`: Prueba el envío de mensajes
- `/test-notification`: Prueba el sistema de notificaciones

## Solución de problemas

Si encuentras errores durante el despliegue:

1. Asegúrate de que todas las variables de entorno estén configuradas correctamente
2. Verifica los logs para identificar errores específicos
3. Si hay problemas de dependencias, asegúrate de que todos los módulos requeridos estén en package.json

## Seguridad

- No incluyas credenciales en el código
- Usa siempre variables de entorno para datos sensibles
- Configura las variables de entorno en el panel de Render 