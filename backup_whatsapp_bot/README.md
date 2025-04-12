# WhatsApp Bot con OpenAI y Gupshup

Este servidor conecta WhatsApp (vía Gupshup) con OpenAI para crear un chatbot inteligente.

## ⚠️ ACTUALIZACIÓN IMPORTANTE: Integración con el Panel de Control

Para solucionar el problema de envío de mensajes desde el panel de control, agrega el siguiente código al archivo `index.js`. Este código implementa un sistema de consulta de mensajes pendientes desde el control panel y los envía a WhatsApp.

### Pasos para implementar:

1. Abre el archivo `index.js`
2. Después de la declaración de las constantes (aproximadamente línea 40), agrega:

```javascript
// 🕒 Configuración para consultar mensajes pendientes
const POLL_INTERVAL = process.env.POLL_INTERVAL || 5000; // 5 segundos por defecto
const CONTROL_PANEL_API_URL = CONTROL_PANEL_URL;
```

3. Antes de la línea `// 🟢 Iniciar servidor` (cerca del final del archivo), agrega:

```javascript
// 📨 Endpoint para enviar mensajes manualmente
app.post('/send-message', async (req, res) => {
    try {
        const { phone, message } = req.body;
        
        if (!phone || !message) {
            return res.status(400).send("Se requieren los parámetros 'phone' y 'message'");
        }
        
        console.log(`📨 Solicitud para enviar mensaje a ${phone}: ${message}`);
        
        // Limpiar el número de teléfono (eliminar el "+" si existe)
        const cleanPhoneNumber = phone.replace(/\+/g, '');
        
        // Enviar mensaje a WhatsApp mediante Gupshup
        const response = await axios.post(
            "https://api.gupshup.io/wa/api/v1/msg",
            new URLSearchParams({
                channel: "whatsapp",
                source: GUPSHUP_NUMBER,
                destination: cleanPhoneNumber,
                message: JSON.stringify({ type: "text", text: message })
            }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "apikey": GUPSHUP_API_KEY
                }
            }
        );
        
        console.log(`✅ Mensaje enviado manualmente a ${cleanPhoneNumber}`);
        return res.status(200).send("Mensaje enviado correctamente");
        
    } catch (error) {
        console.error(`❌ Error al enviar mensaje manual:`, error.response?.data || error.message);
        return res.status(500).send(`Error al enviar mensaje: ${error.message}`);
    }
});

// 🔄 Función para consultar mensajes pendientes
async function checkPendingMessages() {
    try {
        console.log(`🔍 Consultando mensajes pendientes en: ${CONTROL_PANEL_API_URL}/bot-pending-messages`);
        
        const response = await axios.get(`${CONTROL_PANEL_API_URL}/bot-pending-messages`);
        
        if (response.data.success && response.data.messages && response.data.messages.length > 0) {
            console.log(`📩 Se encontraron ${response.data.messages.length} mensajes pendientes`);
            
            // Procesar cada mensaje pendiente
            for (const msg of response.data.messages) {
                try {
                    console.log(`🔄 Procesando mensaje pendiente para ${msg.phone}: ${msg.message}`);
                    
                    // Enviar mensaje a WhatsApp mediante Gupshup
                    await axios.post(
                        "https://api.gupshup.io/wa/api/v1/msg",
                        new URLSearchParams({
                            channel: "whatsapp",
                            source: GUPSHUP_NUMBER,
                            destination: msg.phone,
                            message: JSON.stringify({ type: "text", text: msg.message })
                        }),
                        {
                            headers: {
                                "Content-Type": "application/x-www-form-urlencoded",
                                "apikey": GUPSHUP_API_KEY
                            }
                        }
                    );
                    
                    console.log(`✅ Mensaje pendiente enviado a ${msg.phone}`);
                    
                } catch (sendError) {
                    console.error(`❌ Error al enviar mensaje pendiente a ${msg.phone}:`, sendError.message);
                }
            }
        } else {
            console.log(`ℹ️ No hay mensajes pendientes para procesar`);
        }
    } catch (error) {
        console.error(`❌ Error al consultar mensajes pendientes:`, error.message);
    }
    
    // Programar la próxima consulta
    setTimeout(checkPendingMessages, POLL_INTERVAL);
}

// Endpoint para probar el sistema de mensajes pendientes
app.get('/test-pending-messages', async (req, res) => {
    try {
        await checkPendingMessages();
        res.status(200).send("Consulta de mensajes pendientes iniciada");
    } catch (error) {
        res.status(500).send(`Error: ${error.message}`);
    }
});
```

4. Al final del archivo, justo después de iniciar el servidor, agrega:

```javascript
// Iniciar el sistema de consulta de mensajes pendientes
console.log(`🔄 Iniciando sistema de consulta de mensajes pendientes cada ${POLL_INTERVAL}ms`);
setTimeout(checkPendingMessages, 5000); // Esperar 5 segundos antes de la primera consulta
```

5. Actualiza tu archivo `.env` para agregar la variable opcional:

```
# Intervalo para consultar mensajes pendientes (en milisegundos)
POLL_INTERVAL=5000
```

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
- `CONTROL_PANEL_URL`: URL del servidor de control panel (por defecto: http://localhost:3001)
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

Cuando despliegues este servidor en Render, debes configurar `CONTROL_PANEL_URL` correctamente. Este valor es **crítico** para que el bot funcione adecuadamente y pueda guardar los mensajes en Supabase.

```
# ❌ INCORRECTO - NO usar estos valores en producción
CONTROL_PANEL_URL=http://localhost:3001
CONTROL_PANEL_URL=https://api.openai.com
CONTROL_PANEL_URL=https://tu-aplicacion.onrender.com

# ✅ CORRECTO - Usar la URL real de tu panel de control
CONTROL_PANEL_URL=https://whatsapp-bot-if6z.onrender.com
```

### Otras variables para producción

También es recomendable configurar estas variables en Render:

```
NODE_ENV=production
LOG_LEVEL=debug
FORCE_SAVE_TO_SUPABASE=true
```

Esto mejorará la robustez y facilitará la solución de problemas.

## Cómo configurar variables en Render

1. Ve al panel de control de Render
2. Selecciona tu servicio
3. Haz clic en "Environment" en el menú lateral
4. Agrega o actualiza las variables de entorno
5. Haz clic en "Save Changes" y luego en "Manual Deploy" > "Deploy latest commit"

## Solución de problemas con el registro de respuestas

Si ves errores como `❌ Error al registrar respuesta en el control panel: Request failed with status code 401` o `404`, sigue estos pasos:

1. **Verifica el valor de CONTROL_PANEL_URL**:
   - Debe ser la URL completa de tu aplicación en Render
   - No debe contener `api.openai.com` ni localhost

2. **Comprueba los logs**: 
   - El bot ahora proporciona información detallada sobre los errores
   - Busca mensajes que empiecen con 🚨 (error grave) o ⚠️ (advertencia)
   
3. **Asegúrate de que el endpoint existe**:
   - Confirma que tu panel de control tiene un endpoint `/register-bot-response`
   - Prueba acceder a `https://tu-panel-control.onrender.com/register-bot-response` para verificar

## Mejoras recientes

- Validación y detección de URLs incorrectas al iniciar
- Función `registerBotResponse` mejorada con mejor manejo de errores
- Logging detallado para facilitar la depuración
- Verificación automática de respuestas exitosas
- Endpoint `/` mejorado para mostrar información de configuración

## Webhook de Gupshup

Configura el webhook de Gupshup para que apunte a:

```
https://tu-servidor.com/webhook
```

Reemplaza `tu-servidor.com` con la URL pública de tu servidor.
