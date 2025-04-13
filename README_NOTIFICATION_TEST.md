# Sistema de Prueba de Notificaciones de WhatsApp

Este es un servidor independiente para probar el sistema de notificaciones de WhatsApp sin necesidad de integración con Supabase u otros servicios externos.

## Características

- Detección de frases que requieren atención humana
- Envío de notificaciones por correo electrónico
- Manejo de conversaciones en memoria
- Endpoints de prueba para diferentes escenarios
- Sistema de respaldo para envío de correos

## Requisitos

- Node.js 14.x o superior
- NPM o Yarn
- Configuración de variables de entorno (ver sección siguiente)

## Variables de Entorno

Crea un archivo `.env` en el directorio raíz con las siguientes variables:

```
# Puerto del servidor
PORT=3095

# Configuración SMTP principal
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu_correo@gmail.com
SMTP_PASS=tu_password_o_app_password
SMTP_FROM=notificaciones@tuempresa.com

# Configuración SMTP alternativa (opcional)
ALTERNATE_SMTP_HOST=smtp.tuservidor.com
ALTERNATE_SMTP_PORT=587
ALTERNATE_SMTP_SECURE=false
ALTERNATE_SMTP_USER=otro_correo@example.com
ALTERNATE_SMTP_PASS=otro_password

# Otros ajustes
NOTIFICATION_EMAILS=destinatario1@example.com,destinatario2@example.com
BUSINESS_NAME=Mi Empresa
```

## Instalación

1. Asegúrate de tener instalados los paquetes necesarios:

```bash
npm install express body-parser cors nodemailer dotenv
```

2. Ejecuta el servidor:

```bash
node test-server-without-supabase.js
```

El servidor comenzará a ejecutarse en http://localhost:3095 (o el puerto que hayas configurado).

## Uso

### Endpoints Disponibles

#### 1. Verificar Estado del Servidor

```
GET /status
```

Respuesta:
```json
{
  "status": "running",
  "timestamp": "2023-09-01T12:34:56.789Z",
  "environment": "development",
  "memory_db": {
    "conversations": 2,
    "notifications": 5
  }
}
```

#### 2. Probar Detección y Envío de Notificación

```
GET /test-notification?message=necesitarás hablar con un agente humano&phone=1234567890
```

Parámetros opcionales:
- `message`: Mensaje a analizar (por defecto usa una frase que requiere notificación)
- `phone`: Número de teléfono del cliente
- `conversation_id`: ID de la conversación

Respuesta exitosa (con notificación):
```json
{
  "success": true,
  "requires_notification": true,
  "matched_phrase": "necesitarás hablar con un agente humano",
  "notification_sent": true,
  "notification_details": {
    "success": true,
    "messageId": "1234567890@example.com",
    "recipients": ["email1@example.com", "email2@example.com"]
  }
}
```

Respuesta sin notificación:
```json
{
  "success": true,
  "requires_notification": false,
  "message": "El mensaje no requiere notificación"
}
```

#### 3. Probar Procesamiento de Mensaje

```
GET /test-process-message?message=habla con un asesor para más información&phone=1234567890&is_bot=true
```

Parámetros opcionales:
- `message`: Mensaje a procesar
- `phone`: Número de teléfono del cliente
- `conversation_id`: ID de la conversación
- `is_bot`: "true" si el mensaje proviene del bot, "false" si es del usuario

#### 4. Probar Flujo Completo

```
POST /test-complete-flow
```

Cuerpo de la solicitud:
```json
{
  "userMessage": "Necesito hablar con alguien real",
  "botMessage": "Entiendo, necesitarás hablar con un agente humano para resolver tu problema",
  "phoneNumber": "1234567890"
}
```

## Ejemplos con cURL

### Probar detección de notificación

```bash
curl "http://localhost:3095/test-notification?message=necesitarás%20hablar%20con%20un%20agente%20humano&phone=5551234567"
```

### Procesar mensaje del usuario

```bash
curl "http://localhost:3095/test-process-message?message=Hola,%20quiero%20hablar%20con%20una%20persona&phone=5551234567&is_bot=false"
```

### Procesar mensaje del bot

```bash
curl "http://localhost:3095/test-process-message?message=Para%20este%20caso,%20necesitarás%20hablar%20con%20un%20agente%20humano&phone=5551234567&is_bot=true"
```

### Probar flujo completo

```bash
curl -X POST http://localhost:3095/test-complete-flow \
  -H "Content-Type: application/json" \
  -d '{
    "userMessage": "Tengo un problema con mi pedido",
    "botMessage": "Entiendo, necesitarás hablar con un asesor para resolver este problema",
    "phoneNumber": "5551234567"
  }'
```

## Notas Adicionales

- Este servidor utiliza una base de datos en memoria, por lo que los datos se perderán al reiniciarlo.
- Las notificaciones por correo electrónico requieren una configuración SMTP válida.
- Para probar sin enviar correos, puedes usar servicios como Mailtrap o configurar un servidor SMTP falso. 