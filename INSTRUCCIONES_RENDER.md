# Instrucciones para Despliegue en Render

## Paso 1: Configurar el Repositorio

Asegúrate de que tu repositorio no contiene información sensible:

1. Revisa que no haya claves API en los archivos
2. Verifica que el archivo `.env.example` no contenga claves reales
3. Asegúrate de que el `.gitignore` excluya archivos sensibles

## Paso 2: Crear un Nuevo Servicio Web en Render

1. Inicia sesión en tu cuenta de Render
2. Haz clic en "New" y selecciona "Web Service"
3. Conecta tu repositorio de GitHub
4. Selecciona el repositorio "whatsapp-bot"

## Paso 3: Configurar el Servicio

Utiliza la siguiente configuración:

- **Name**: whatsapp-bot (o el nombre que prefieras)
- **Environment**: Node
- **Region**: La más cercana a tus usuarios
- **Branch**: main
- **Build Command**: `npm install`
- **Start Command**: `node index.js`
- **Plan**: Free (o el que necesites)

## Paso 4: Variables de Entorno

Estas son las variables de entorno esenciales que debes configurar:

```
GUPSHUP_API_KEY=tu_api_key_gupshup
GUPSHUP_API_KEY_ALT=tu_api_key_alternativa
GUPSHUP_USER_ID=tu_usuario_gupshup
GUPSHUP_PASSWORD=tu_contraseña_gupshup
GUPSHUP_URL=https://api.gupshup.io/sm/api/v1/msg
GUPSHUP_SOURCE_NAME=NombreDeTuBot

OPENAI_API_KEY=tu_api_key_openai

SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=tu_service_key_supabase
SUPABASE_ANON_KEY=tu_anon_key_supabase

CONTROL_PANEL_URL=https://tu-panel-de-control.com/register-bot-response

PORT=3000
NODE_ENV=production
LOG_LEVEL=info
FORCE_SAVE_TO_SUPABASE=true
```

## Paso 5: Solución de Problemas Comunes

### Error: "Cannot find module 'X'"

Si ves este error, significa que falta una dependencia. Añádela manualmente al package.json o ejecuta:

```bash
npm install X --save
```

### Error: "supabaseKey is required"

Verifica que has configurado correctamente las variables de entorno `SUPABASE_URL` y `SUPABASE_SERVICE_KEY`.

### Error con GupShup

Si ves errores relacionados con GupShup, verifica:
- Las credenciales de GupShup son correctas
- El formato del número de teléfono (debe incluir código de país)
- La URL de GupShup es la correcta

### Error de conexión con el Panel de Control

Si ves errores de conexión con el panel de control, asegúrate de que:
- La URL del panel es correcta y termina con `/register-bot-response`
- El panel de control está funcionando
- No hay problemas de CORS

## Paso 6: Verificar el Despliegue

1. Una vez desplegado, verifica los logs en Render para asegurarte de que no hay errores
2. Visita la URL generada por Render para comprobar que el servicio está en línea
3. Realiza una prueba enviando un mensaje a tu número de WhatsApp

## Notas Importantes

- Render puede tardar unos minutos en completar el despliegue
- Los servicios gratuitos de Render se "duermen" tras períodos de inactividad
- Configura correctamente el webhook de GupShup para que apunte a tu panel de control

Preparado: 2025-04-10T05:06:38.256Z
