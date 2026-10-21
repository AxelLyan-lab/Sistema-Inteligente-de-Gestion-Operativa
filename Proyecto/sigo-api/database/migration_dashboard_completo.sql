-- ==============================================================================
-- S.I.G.O. — Migración "Dashboard completo"
-- Zonas de patrullaje, despacho manual, mensajería, evidencias y alertas.
-- Ejecutar UNA VEZ en el SQL Editor de Supabase (es idempotente).
-- ==============================================================================

-- ─── 1. ZONAS DE PATRULLAJE ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zonas_patrullaje (
    id_zona     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre      VARCHAR(120) NOT NULL,
    direccion   VARCHAR(200),
    lat         DOUBLE PRECISION NOT NULL,
    lng         DOUBLE PRECISION NOT NULL,
    radio_m     DOUBLE PRECISION NOT NULL CHECK (radio_m > 0),
    activa      BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Zona inicial: Chonta 3544, Miraflores, Viña del Mar.
-- Círculo de 4 m² de área => radio = sqrt(4/π) ≈ 1.13 m.
-- Coordenadas aproximadas (calle Chonta, Villa Buzo Sobenes). Ajustables desde
-- el dashboard (Zonas → Editar) para ubicar el número exacto.
INSERT INTO zonas_patrullaje (nombre, direccion, lat, lng, radio_m)
SELECT 'Chonta 3544', 'Chonta 3544, Miraflores, Viña del Mar', -33.01767, -71.51619, 1.13
WHERE NOT EXISTS (SELECT 1 FROM zonas_patrullaje WHERE nombre = 'Chonta 3544');

-- ─── 2. ASIGNACIONES TÁCTICAS: datos del círculo para móvil y dashboard ───────
ALTER TABLE asignaciones_tacticas
  ADD COLUMN IF NOT EXISTS centro_lat   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS centro_lng   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS radio_m      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS nombre_zona  VARCHAR(120),
  ADD COLUMN IF NOT EXISTS instrucciones TEXT,
  ADD COLUMN IF NOT EXISTS id_zona      BIGINT;

-- ─── 3. MENSAJERÍA SUPERVISOR <-> SESIÓN ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS mensajes (
    id_mensaje      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sesion       BIGINT NOT NULL REFERENCES sesiones_operativas(id_sesion) ON DELETE CASCADE,
    remitente       VARCHAR(20) NOT NULL CHECK (remitente IN ('SUPERVISOR', 'FUNCIONARIO')),
    rut_remitente   VARCHAR(12),
    texto           TEXT NOT NULL,
    fecha           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    leido           BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_mensajes_sesion ON mensajes (id_sesion, fecha);

-- ─── 4. EVIDENCIAS: origen (móvil / dashboard) y geolocalización ──────────────
ALTER TABLE registro_evidencias
  ADD COLUMN IF NOT EXISTS geom_evidencia GEOMETRY(Point, 4326),
  ADD COLUMN IF NOT EXISTS origen         VARCHAR(20) DEFAULT 'MOVIL',
  ADD COLUMN IF NOT EXISTS subido_por     VARCHAR(120);

-- ─── 5. VISTAS (lat/lng ya resueltos para el dashboard) ───────────────────────
DROP VIEW IF EXISTS v_alertas_emergencia;
CREATE VIEW v_alertas_emergencia AS
SELECT a.id_emergencia,
       a.id_sesion_solicitante,
       a.estado,
       a.fecha_alerta,
       ST_Y(a.geom_emergencia::geometry) AS lat,
       ST_X(a.geom_emergencia::geometry) AS lng,
       s.identificador_unidad,
       u.nombre_completo AS conductor
FROM   alertas_emergencia a
LEFT JOIN sesiones_operativas s ON s.id_sesion = a.id_sesion_solicitante
LEFT JOIN usuarios u            ON u.rut_usuario = s.rut_conductor;

DROP VIEW IF EXISTS v_evidencias;
CREATE VIEW v_evidencias AS
SELECT e.id_evidencia,
       e.id_sesion,
       e.id_asignacion,
       e.tipo_evidencia,
       e.es_obligatoria,
       e.url_fotografia,
       e.descripcion_texto,
       e.fecha_subida,
       e.origen,
       e.subido_por,
       CASE WHEN e.geom_evidencia IS NULL THEN NULL ELSE ST_Y(e.geom_evidencia) END AS lat,
       CASE WHEN e.geom_evidencia IS NULL THEN NULL ELSE ST_X(e.geom_evidencia) END AS lng,
       s.identificador_unidad,
       s.rut_conductor,
       u.nombre_completo AS conductor
FROM   registro_evidencias e
LEFT JOIN sesiones_operativas s ON s.id_sesion = e.id_sesion
LEFT JOIN usuarios u            ON u.rut_usuario = s.rut_conductor;

-- ─── 6. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE zonas_patrullaje     ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE asignaciones_tacticas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zonas_all" ON zonas_patrullaje;
CREATE POLICY "zonas_all" ON zonas_patrullaje FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "mensajes_all" ON mensajes;
CREATE POLICY "mensajes_all" ON mensajes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "asignaciones_all" ON asignaciones_tacticas;
CREATE POLICY "asignaciones_all" ON asignaciones_tacticas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "alertas_update_all" ON alertas_emergencia;
CREATE POLICY "alertas_update_all" ON alertas_emergencia FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "evidencias_delete_all" ON registro_evidencias;
CREATE POLICY "evidencias_delete_all" ON registro_evidencias FOR DELETE USING (true);

GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- ─── 7. STORAGE: bucket público de evidencias (subida desde dashboard) ────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('sigo-evidencias', 'sigo-evidencias', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

DROP POLICY IF EXISTS "sigo_evidencias_select" ON storage.objects;
CREATE POLICY "sigo_evidencias_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'sigo-evidencias');

DROP POLICY IF EXISTS "sigo_evidencias_insert" ON storage.objects;
CREATE POLICY "sigo_evidencias_insert" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'sigo-evidencias');

DROP POLICY IF EXISTS "sigo_evidencias_delete" ON storage.objects;
CREATE POLICY "sigo_evidencias_delete" ON storage.objects
  FOR DELETE TO anon, authenticated USING (bucket_id = 'sigo-evidencias');

-- ─── 8. REALTIME ──────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['mensajes','asignaciones_tacticas','alertas_emergencia',
                           'registro_evidencias','zonas_patrullaje']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;
