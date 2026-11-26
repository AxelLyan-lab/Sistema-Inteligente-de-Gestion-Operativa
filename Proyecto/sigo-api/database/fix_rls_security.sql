-- ==============================================================================
-- S.I.G.O. — Corrección de Seguridad Supabase (rls_disabled_in_public)
-- Habilita Row-Level Security (RLS) en TODAS las tablas del esquema public
-- y restringe escrituras públicas (INSERT/UPDATE/DELETE) para el rol anon.
-- Ejecutar en el SQL Editor de Supabase.
-- ==============================================================================

DO $$
DECLARE
  tbl TEXT;
  tablas TEXT[] := ARRAY[
    'usuarios',
    'sesiones_operativas',
    'tripulacion_sesion',
    'registro_evidencias',
    'asignaciones_tacticas',
    'telemetria_activa',
    'alertas_emergencia',
    'vehiculos',
    'turnos_patrullaje',
    'dotacion_turno',
    'alertas_refuerzo',
    'sesiones_patrullaje',
    'zonas_riesgo',
    'delitos_registro'
  ];
BEGIN
  FOREACH tbl IN ARRAY tablas LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    END IF;
  END LOOP;
END $$;

-- ==============================================================================
-- POLÍTICAS SEGURAS PARA DASHBOARD (Solo lectura controlada; escrituras vía API)
-- ==============================================================================

-- 1. tripulacion_sesion (estaba deshabilitado en HU13_DDL_RLS.sql)
DROP POLICY IF EXISTS "anon_read_tripulacion" ON public.tripulacion_sesion;
CREATE POLICY "anon_read_tripulacion"
  ON public.tripulacion_sesion FOR SELECT
  TO anon, authenticated
  USING (true);

-- 2. sesiones_operativas — solo sesiones activas en lectura
DROP POLICY IF EXISTS "anon_read_sesiones_activas" ON public.sesiones_operativas;
CREATE POLICY "anon_read_sesiones_activas"
  ON public.sesiones_operativas FOR SELECT
  TO anon, authenticated
  USING (fecha_cierre IS NULL);

-- 3. telemetria_activa — solo lectura para Realtime del Dashboard
DROP POLICY IF EXISTS "anon_read_telemetria" ON public.telemetria_activa;
CREATE POLICY "anon_read_telemetria"
  ON public.telemetria_activa FOR SELECT
  TO anon, authenticated
  USING (true);

-- 4. asignaciones_tacticas — solo lectura para Dashboard
DROP POLICY IF EXISTS "anon_read_asignaciones" ON public.asignaciones_tacticas;
CREATE POLICY "anon_read_asignaciones"
  ON public.asignaciones_tacticas FOR SELECT
  TO anon, authenticated
  USING (true);

-- 5. alertas_emergencia — solo lectura para alertas SOS en tiempo real
DROP POLICY IF EXISTS "anon_read_alertas_emergencia" ON public.alertas_emergencia;
CREATE POLICY "anon_read_alertas_emergencia"
  ON public.alertas_emergencia FOR SELECT
  TO anon, authenticated
  USING (true);

-- 6. zonas_riesgo — solo lectura para mapa de zonas
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zonas_riesgo') THEN
    DROP POLICY IF EXISTS "anon_read_zonas_riesgo" ON public.zonas_riesgo;
    CREATE POLICY "anon_read_zonas_riesgo"
      ON public.zonas_riesgo FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- 7. delitos_registro — solo lectura para conteo/calibración
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delitos_registro') THEN
    DROP POLICY IF EXISTS "anon_read_delitos_registro" ON public.delitos_registro;
    CREATE POLICY "anon_read_delitos_registro"
      ON public.delitos_registro FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- 8. sesiones_patrullaje — solo lectura de sesiones activas
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sesiones_patrullaje') THEN
    DROP POLICY IF EXISTS "anon_read_sesiones_patrullaje" ON public.sesiones_patrullaje;
    CREATE POLICY "anon_read_sesiones_patrullaje"
      ON public.sesiones_patrullaje FOR SELECT
      TO anon, authenticated
      USING (activa = true);
  END IF;
END $$;

-- 10. Convertir vistas SECURITY DEFINER a SECURITY INVOKER (corrige alertas de Supabase)
DO $$
DECLARE
  v TEXT;
  vistas TEXT[] := ARRAY[
    'v_posicion_actual_unidades',
    'v_alertas_emergencia',
    'v_evidencias'
  ];
BEGIN
  FOREACH v IN ARRAY vistas LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.views
      WHERE table_schema = 'public' AND table_name = v
    ) THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true);', v);
    END IF;
  END LOOP;
END $$;
--    Las mutaciones deben pasar siempre por sigo-api (service_role).
DO $$
DECLARE
  tbl TEXT;
  tablas TEXT[] := ARRAY[
    'usuarios',
    'sesiones_operativas',
    'tripulacion_sesion',
    'registro_evidencias',
    'asignaciones_tacticas',
    'telemetria_activa',
    'alertas_emergencia',
    'vehiculos',
    'turnos_patrullaje',
    'dotacion_turno',
    'alertas_refuerzo',
    'sesiones_patrullaje',
    'zonas_riesgo',
    'delitos_registro'
  ];
BEGIN
  FOREACH tbl IN ARRAY tablas LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon;', tbl);
    END IF;
  END LOOP;
END $$;

