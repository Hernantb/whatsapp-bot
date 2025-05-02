-- Script para corregir las políticas RLS de la tabla business_config

-- Política para permitir la inserción desde aplicaciones con clave anónima
CREATE POLICY "Permitir inserción anónima durante migración" 
ON business_config FOR INSERT 
WITH CHECK (true);

-- Política para permitir la actualización 
CREATE POLICY "Permitir actualización anónima durante migración" 
ON business_config FOR UPDATE
USING (true)
WITH CHECK (true);

-- Para borrado (opcional)
CREATE POLICY "Permitir borrado anónimo durante migración" 
ON business_config FOR DELETE
USING (true);

-- Nota: Estas políticas son muy permisivas y deberían limitarse más
-- después de la migración inicial. 