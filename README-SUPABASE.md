# Configuración de Supabase para el Bot de WhatsApp

## Problema detectado

El proyecto original utilizaba un proyecto Supabase con la URL `ecnimzwygbbumxdcilsb.supabase.co`, pero este proyecto ya no existe o no es accesible. Las pruebas DNS indican que el dominio no se puede resolver, incluso utilizando servidores DNS alternativos como Google (8.8.8.8) o Cloudflare (1.1.1.1).

## Solución implementada

Se ha implementado un sistema de configuración flexible que permite cambiar fácilmente las credenciales de Supabase:

1. Se creó un archivo `supabase-config.js` donde se deben configurar las credenciales del nuevo proyecto Supabase.
2. Se modificaron los archivos `fix-real-bot.js` y `test-dns.js` para utilizar esta configuración centralizada.
3. Se agregó soporte para variables de entorno, que tienen prioridad sobre la configuración del archivo.

## Pasos para configurar un nuevo proyecto Supabase

1. **Crear un nuevo proyecto en Supabase:**
   - Visita [https://supabase.com](https://supabase.com) y crea una cuenta o inicia sesión.
   - Crea un nuevo proyecto y anota la URL y la clave anónima (API key).

2. **Crear las tablas necesarias en Supabase:**
   El bot requiere dos tablas principales:
   
   **Tabla `conversations`:**
   ```sql
   CREATE TABLE conversations (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     phone_number TEXT NOT NULL,
     business_id UUID NOT NULL,
     name TEXT DEFAULT 'Usuario',
     last_message TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   CREATE INDEX idx_conversations_phone_business ON conversations(phone_number, business_id);
   ```
   
   **Tabla `messages`:**
   ```sql
   CREATE TABLE messages (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     conversation_id UUID REFERENCES conversations(id),
     message TEXT NOT NULL,
     is_from_user BOOLEAN DEFAULT FALSE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   CREATE INDEX idx_messages_conversation ON messages(conversation_id);
   ```

3. **Configurar las credenciales:**
   - Edita el archivo `supabase-config.js` con la información de tu nuevo proyecto:
     ```javascript
     const SUPABASE_URL = 'https://tu-proyecto.supabase.co';
     const SUPABASE_KEY = 'tu-clave-anonima';
     const BUSINESS_ID = '2d385aa5-40e0-4ec9-9360-19281bc605e4'; // O genera un nuevo UUID
     ```

4. **Probar la conexión:**
   - Ejecuta `node test-dns.js` para verificar que puedes conectarte al proyecto de Supabase.
   - Si hay problemas, el script mostrará diagnósticos detallados para ayudarte a resolverlos.

5. **Configurar en el servidor:**
   - Asegúrate de configurar las variables de entorno en tu servidor:
     ```
     SUPABASE_URL=https://tu-proyecto.supabase.co
     SUPABASE_KEY=tu-clave-anonima
     BUSINESS_ID=tu-business-id
     ```

## Verificación de DNS

Si enfrentas problemas para conectarte a Supabase, el script `test-dns.js` puede ayudar a diagnosticar si es un problema de DNS o de conectividad. Este script:

1. Verifica si puede resolver el dominio de Supabase con DNS local.
2. Intenta usar servidores DNS alternativos (Cloudflare y Google).
3. Prueba la conexión HTTP al proyecto.
4. Verifica si otros dominios como Google pueden resolverse.

Esto te ayudará a determinar si el problema es específico a Supabase o es más generalizado.

## Notas importantes

- El bot ahora guarda los mensajes directamente en Supabase, sin almacenamiento local de respaldo.
- Se utilizan múltiples métodos para conectarse a Supabase (cliente oficial, REST con axios, etc.) para maximizar la confiabilidad.
- Si tienes problemas de DNS, considera cambiar los servidores DNS de tu servidor a los de Google (8.8.8.8, 8.8.4.4) o Cloudflare (1.1.1.1, 1.0.0.1). 