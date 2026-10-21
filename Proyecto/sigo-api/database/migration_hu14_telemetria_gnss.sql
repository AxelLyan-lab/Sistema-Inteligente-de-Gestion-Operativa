-- ============================================================
-- HU14: Transmisión de Telemetría GPS — Migración PostGIS
-- Autor: S.I.G.O. Dev Team  |  Fecha: 2026-09-28
-- ⚠️  Este script hace DROP y recrea la tabla limpia.
--     Ejecutar una sola vez en Supabase SQL Editor.
-- ============================================================

-- 0. Limpiar objetos anteriores (cascada borra índices y vistas dependientes)
DROP VIEW  IF EXISTS v_posicion_actual_unidades CASCADE;
DROP TABLE IF EXISTS telemetria_activa          CASCADE;
DROP FUNCTION IF EXISTS limpiar_telemetria_antigua();

-- 1. Habilitar extensión PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Tabla de telemetría activa (esquema final HU14)
CREATE TABLE telemetria_activa (
  id_telemetria   BIGSERIAL     PRIMARY KEY,
  id_sesion       BIGINT        NOT NULL
                    REFERENCES sesiones_operativas(id_sesion) ON DELETE CASCADE,
  geom_actual     GEOMETRY(Point, 4326) NOT NULL,  -- POINT(longitud latitud) WGS-84
  altitud_m       DOUBLE PRECISION,                -- Altitud sobre el nivel del mar (m)
  precision_m     DOUBLE PRECISION,                -- Precisión horizontal GNSS (m)
  velocidad_kmh   DOUBLE PRECISION,                -- Velocidad (km/h)
  rumbo_grados    DOUBLE PRECISION,                -- Heading 0–360°
  timestamp_gps   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  timestamp_srv   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 3. Índice espacial GIST
CREATE INDEX idx_telemetria_geom
  ON telemetria_activa USING GIST (geom_actual);

-- 4. Índice compuesto para consultas del último ping por sesión
CREATE INDEX idx_telemetria_sesion
  ON telemetria_activa (id_sesion, timestamp_gps DESC);

-- 5. Vista: posición actual de cada unidad operativa
--    ST_Y(point) = latitud  |  ST_X(point) = longitud
CREATE VIEW v_posicion_actual_unidades AS
SELECT DISTINCT ON (t.id_sesion)
  t.id_sesion,
  s.identificador_unidad,
  s.tipo_transporte,
  s.estado_operativo,
  s.rut_conductor,
  u.nombre_completo     AS nombre_funcionario,
  ST_Y(t.geom_actual)   AS latitud,
  ST_X(t.geom_actual)   AS longitud,
  t.altitud_m,
  t.precision_m,
  t.velocidad_kmh,
  t.rumbo_grados,
  t.timestamp_gps,
  t.timestamp_srv
FROM   telemetria_activa t
JOIN   sesiones_operativas s ON s.id_sesion    = t.id_sesion
JOIN   usuarios            u ON u.rut_usuario  = s.rut_conductor
WHERE  s.fecha_cierre IS NULL
ORDER  BY t.id_sesion, t.timestamp_gps DESC;

-- 6. Función de limpieza (retiene las últimas 24 h)
CREATE FUNCTION limpiar_telemetria_antigua()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM telemetria_activa
  WHERE  timestamp_srv < NOW() - INTERVAL '24 hours';
END;
$$;

-- 7. Comentarios
COMMENT ON TABLE  telemetria_activa             IS 'Pings GPS de unidades móviles en turno activo (HU14)';
COMMENT ON COLUMN telemetria_activa.geom_actual IS 'POINT(longitud latitud) en WGS-84 (SRID 4326)';
COMMENT ON COLUMN telemetria_activa.precision_m IS 'Precisión horizontal GNSS en metros (< 10 m = alta calidad)';
