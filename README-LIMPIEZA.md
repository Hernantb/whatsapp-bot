# Script de Limpieza de Mensajes de WhatsApp Bot

Este script permite eliminar mensajes antiguos de la base de datos Supabase para liberar espacio y mantener el rendimiento óptimo de la aplicación.

## Características

- Elimina mensajes antiguos basándose en una fecha de corte configurable
- Mantiene un número mínimo de mensajes por conversación
- Incluye modo de prueba (dry-run) para simular la eliminación sin realizar cambios
- Ofrece la posibilidad de limpiar solo conversaciones inactivas o todas las conversaciones
- Procesa las conversaciones en lotes para evitar sobrecargar la base de datos

## Requisitos

- Node.js instalado (v14 o superior)
- Credenciales de Supabase configuradas en el archivo `.env`

## Uso

```bash
node cleanup-messages.js [opciones]
```

### Opciones

- `--days=N`: Mantener mensajes de los últimos N días (por defecto: 30)
- `--keep=N`: Mantener al menos N mensajes por conversación (por defecto: 100)
- `--dry-run`: Ejecutar en modo simulación (no elimina realmente)
- `--all`: Limpiar todas las conversaciones (por defecto solo inactivas por más de 30 días)
- `--force`: Ignorar fecha de corte y eliminar todos los mensajes hasta dejar solo los últimos N

## Ejemplos

### Simulación de limpieza

Para ver qué mensajes se eliminarían sin realizar cambios reales:

```bash
node cleanup-messages.js --dry-run
```

### Limpieza conservadora

Para eliminar mensajes de más de 60 días, manteniendo los 200 más recientes por conversación:

```bash
node cleanup-messages.js --days=60 --keep=200
```

### Limpieza agresiva

Para eliminar mensajes de todas las conversaciones, manteniendo solo los 50 más recientes:

```bash
node cleanup-messages.js --all --keep=50
```

### Limpieza forzada

Para eliminar todos los mensajes antiguos excepto los 20 más recientes, independientemente de su fecha:

```bash
node cleanup-messages.js --all --force --keep=20
```

## Programación de limpieza automática

Para configurar una limpieza automática periódica, puede utilizar cron (Linux/Mac) o el Programador de tareas (Windows).

### Ejemplo con cron (Linux/Mac)

Añadir al crontab (ejecutar `crontab -e`):

```
# Ejecutar limpieza cada domingo a las 3:00 AM
0 3 * * 0 cd /ruta/a/whatsapp-bot-main && node cleanup-messages.js --days=30 --keep=100
```

## Consideraciones de seguridad

- El script incluye una opción `--dry-run` que debe usarse primero para verificar qué mensajes serán eliminados.
- Por defecto, solo se procesan conversaciones inactivas (sin mensajes en los últimos 30 días).
- Se recomienda hacer una copia de seguridad de la base de datos antes de ejecutar una limpieza a gran escala.
- La opción `--force` debe usarse con precaución ya que eliminará mensajes sin considerar su fecha de creación.

## Solución de problemas

- Si el script falla debido a timeout, intente aumentar el valor de `--keep` o ejecute el script varias veces con diferentes parámetros.
- Si necesita cancelar la ejecución del script, presione `Ctrl+C`. El script procesará de manera segura la interrupción.
- Para problemas de conexión con Supabase, verifique las credenciales en el archivo `.env` y la conectividad a Internet. 