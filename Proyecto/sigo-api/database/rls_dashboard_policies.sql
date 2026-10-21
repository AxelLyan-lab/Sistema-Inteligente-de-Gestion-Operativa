-- ============================================================
-- RLS Policies para Dashboard Web (Supabase anon key)
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. sesiones_operativas — lectura pública (solo activas)
DROP POLICY IF EXISTS "anon_read_sesiones_activas" ON sesiones_operativas;
CREATE POLICY "anon_read_sesiones_activas"
  ON sesiones_operativas FOR SELECT
  USING (fecha_cierre IS NULL);

-- 2. usuarios — lectura de nombre/grado para joins
DROP POLICY IF EXISTS "anon_read_usuarios" ON usuarios;
CREATE POLICY "anon_read_usuarios"
  ON usuarios FOR SELECT
  USING (true);

-- 3. tripulacion_sesion — lectura para joins de dotación
DROP POLICY IF EXISTS "anon_read_tripulacion" ON tripulacion_sesion;
CREATE POLICY "anon_read_tripulacion"
  ON tripulacion_sesion FOR SELECT
  USING (true);

-- 4. asignaciones_tacticas — lectura para dashboard
DROP POLICY IF EXISTS "anon_read_asignaciones" ON asignaciones_tacticas;
CREATE POLICY "anon_read_asignaciones"
  ON asignaciones_tacticas FOR SELECT
  USING (true);

-- 5. telemetria_activa — lectura para dashboard
DROP POLICY IF EXISTS "anon_read_telemetria" ON telemetria_activa;
CREATE POLICY "anon_read_telemetria"
  ON telemetria_activa FOR SELECT
  USING (true);

-- Realtime: necesario para que Supabase transmita los valores nuevos
-- (sin esto, el payload de INSERT no incluye lat/lon)
ALTER TABLE telemetria_activa REPLICA IDENTITY FULL;
