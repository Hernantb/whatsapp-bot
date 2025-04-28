-- Asegurarse de que la extensión uuid-ossp esté habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verificar y añadir la columna last_message_time si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'conversations' 
        AND column_name = 'last_message_time'
    ) THEN
        -- Añadir la columna last_message_time
        ALTER TABLE conversations 
        ADD COLUMN last_message_time TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Verificar y añadir la columna last_message si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'conversations' 
        AND column_name = 'last_message'
    ) THEN
        -- Añadir la columna last_message
        ALTER TABLE conversations 
        ADD COLUMN last_message TEXT DEFAULT 'Nueva conversación';
    END IF;
END $$;

-- Verificar y añadir la columna unread_count si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'conversations' 
        AND column_name = 'unread_count'
    ) THEN
        -- Añadir la columna unread_count
        ALTER TABLE conversations 
        ADD COLUMN unread_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Actualizar los registros existentes para establecer valores predeterminados
UPDATE conversations
SET last_message_time = created_at
WHERE last_message_time IS NULL;

UPDATE conversations
SET last_message = 'Nueva conversación'
WHERE last_message IS NULL;

UPDATE conversations
SET unread_count = 0
WHERE unread_count IS NULL;

