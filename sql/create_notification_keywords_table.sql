-- Tabla para almacenar palabras clave que activan notificaciones
CREATE TABLE IF NOT EXISTS notification_keywords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  keyword TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Asegurar que no haya duplicados para el mismo negocio
  CONSTRAINT unique_keyword_per_business UNIQUE (business_id, keyword)
);

-- Política de seguridad para acceso a la tabla (RLS)
ALTER TABLE notification_keywords ENABLE ROW LEVEL SECURITY;

-- Política para ver palabras clave (sólo usuarios del mismo negocio)
CREATE POLICY view_notification_keywords ON notification_keywords
  FOR SELECT USING (
    business_id IN (
      SELECT business_id FROM business_users
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

-- Política para insertar palabras clave (sólo usuarios del mismo negocio)
CREATE POLICY insert_notification_keywords ON notification_keywords
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT business_id FROM business_users
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

-- Política para actualizar palabras clave (sólo usuarios del mismo negocio)
CREATE POLICY update_notification_keywords ON notification_keywords
  FOR UPDATE USING (
    business_id IN (
      SELECT business_id FROM business_users
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

-- Política para eliminar palabras clave (sólo usuarios del mismo negocio)
CREATE POLICY delete_notification_keywords ON notification_keywords
  FOR DELETE USING (
    business_id IN (
      SELECT business_id FROM business_users
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

-- Índices para mejorar el rendimiento
CREATE INDEX notification_keywords_business_id_idx ON notification_keywords(business_id);
CREATE INDEX notification_keywords_user_id_idx ON notification_keywords(user_id);
CREATE INDEX notification_keywords_enabled_idx ON notification_keywords(enabled);

-- Trigger para actualizar el timestamp de actualización
CREATE OR REPLACE FUNCTION update_notification_keywords_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_notification_keywords_updated_at
BEFORE UPDATE ON notification_keywords
FOR EACH ROW
EXECUTE FUNCTION update_notification_keywords_updated_at();

-- Comentarios de la tabla
COMMENT ON TABLE notification_keywords IS 'Palabras clave que activan notificaciones cuando aparecen en las conversaciones';
COMMENT ON COLUMN notification_keywords.id IS 'Identificador único de la palabra clave';
COMMENT ON COLUMN notification_keywords.business_id IS 'Negocio al que pertenece la palabra clave';
COMMENT ON COLUMN notification_keywords.user_id IS 'Usuario que creó la palabra clave';
COMMENT ON COLUMN notification_keywords.keyword IS 'Palabra o frase que activa la notificación';
COMMENT ON COLUMN notification_keywords.enabled IS 'Indica si la palabra clave está activa';
COMMENT ON COLUMN notification_keywords.created_at IS 'Fecha de creación del registro';
COMMENT ON COLUMN notification_keywords.updated_at IS 'Fecha de última actualización del registro'; 