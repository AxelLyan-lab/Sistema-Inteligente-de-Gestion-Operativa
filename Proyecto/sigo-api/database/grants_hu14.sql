-- =========================================================================
-- S.I.G.O. - Script de permisos para Dashboard Web y App Móvil
-- Ejecutar en el SQL Editor de Supabase:
-- https://supabase.com/dashboard/project/cjyrlgpnqkahhyqgyyvu/sql/new
-- =========================================================================

-- 1. Dar permisos a la vista de posiciones a roles públicos y autenticados
GRANT SELECT ON public.v_posicion_actual_unidades TO anon, authenticated;

-- 2. Dar permisos a la tabla de telemetría a roles públicos y autenticados
GRANT SELECT, INSERT ON public.telemetria_activa TO anon, authenticated;

-- 2b. IMPORTANTE: Dar permisos en la secuencia (BIGSERIAL) de telemetría
--     Sin esto, INSERT falla con "permission denied for sequence"
GRANT USAGE, SELECT ON SEQUENCE public.telemetria_activa_id_telemetria_seq TO anon, authenticated;

-- 3. Asegurar que los roles también puedan leer las sesiones operativas y usuarios
GRANT SELECT ON public.sesiones_operativas TO anon, authenticated;
GRANT SELECT ON public.usuarios TO anon, authenticated;
GRANT SELECT ON public.tripulacion_sesion TO anon, authenticated;
GRANT SELECT ON public.asignaciones_tacticas TO anon, authenticated;

-- 4. Recrear las políticas RLS para que apliquen correctamente
DROP POLICY IF EXISTS "anon_read_sesiones_activas" ON sesiones_operativas;
CREATE POLICY "anon_read_sesiones_activas"
  ON sesiones_operativas FOR SELECT
  USING (fecha_cierre IS NULL);

DROP POLICY IF EXISTS "anon_read_telemetria" ON telemetria_activa;
CREATE POLICY "anon_read_telemetria"
  ON telemetria_activa FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "anon_insert_telemetria" ON telemetria_activa;
CREATE POLICY "anon_insert_telemetria"
  ON telemetria_activa FOR INSERT
  WITH CHECK (true);

-- 5. Realtime: necesario para que el dashboard reciba actualizaciones automáticas
ALTER TABLE telemetria_activa REPLICA IDENTITY FULL;
