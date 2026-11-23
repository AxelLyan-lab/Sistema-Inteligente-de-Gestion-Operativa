-- ==============================================================================
-- S.I.G.O. — Migración Integral: Patrullaje Preventivo, Configuración U.V.E.,
-- Clasificación Calibrada de Zonas por Gravedad Delictual y Despacho de Refuerzos
-- PostgreSQL 15+ / PostGIS (Supabase)
-- ==============================================================================

-- 1. Habilitar extensiones requeridas
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==============================================================================
-- 2. TIPOS ENUMERADOS (ENUMS)
-- ==============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_medio_enum') THEN
        CREATE TYPE tipo_medio_enum AS ENUM ('RPT', 'RPD', 'FZ', 'MTT', 'CB', 'INF');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_sesion_patrullaje_enum') THEN
        CREATE TYPE estado_sesion_patrullaje_enum AS ENUM (
            'DISPONIBLE',
            'PATRULLANDO',
            'EN_ZONA_RIESGO',
            'SOLICITANDO_REFUERZO',
            'EN_REFUERZO'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nivel_riesgo_zona_enum') THEN
        CREATE TYPE nivel_riesgo_zona_enum AS ENUM ('ALTO', 'MEDIO', 'BAJO');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_zona_riesgo_enum') THEN
        CREATE TYPE estado_zona_riesgo_enum AS ENUM ('LIBRE', 'ASIGNADA', 'EN_ENFRIAMIENTO');
    END IF;
END $$;

-- ==============================================================================
-- 3. EXTENSIÓN DE TABLAS EXISTENTES PARA COMPATIBILIDAD U.V.E. Y FURGÓN Z
-- ==============================================================================

-- Asegurar identificador UUID en tabla usuarios para FK UUID (lider_id, acompanante_1_id, acompanante_2_id)
ALTER TABLE IF EXISTS usuarios
    ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid() UNIQUE;

-- Actualizar constraint de tipo_transporte en sesiones_operativas para soportar FURGON_Z y códigos U.V.E.
ALTER TABLE IF EXISTS sesiones_operativas
    DROP CONSTRAINT IF EXISTS sesiones_operativas_tipo_transporte_check;

ALTER TABLE IF EXISTS sesiones_operativas
    ADD COLUMN IF NOT EXISTS tipo_medio VARCHAR(10) DEFAULT 'RPD',
    ADD COLUMN IF NOT EXISTS valor_uve NUMERIC(3,2) DEFAULT 0.80,
    ADD COLUMN IF NOT EXISTS sesion_patrullaje_id UUID NULL;

ALTER TABLE IF EXISTS sesiones_operativas
    ADD CONSTRAINT sesiones_operativas_tipo_transporte_check
    CHECK (tipo_transporte IN (
        'PATRULLA', 'FURGON_Z', 'MOTO', 'BICICLETA', 'INFANTERIA',
        'RPT', 'RPD', 'FZ', 'MTT', 'CB', 'INF'
    ));

-- Actualizar constraint en tabla vehiculos
ALTER TABLE IF EXISTS vehiculos
    DROP CONSTRAINT IF EXISTS vehiculos_tipo_vehiculo_check;

ALTER TABLE IF EXISTS vehiculos
    ADD CONSTRAINT vehiculos_tipo_vehiculo_check
    CHECK (tipo_vehiculo IN (
        'PATRULLA', 'FURGON_Z', 'MOTO', 'BICICLETA', 'INFANTERIA',
        'RPT', 'RPD', 'FZ', 'MTT', 'CB', 'INF'
    ));

-- ==============================================================================
-- 4. TABLA: sesiones_patrullaje (Modelo U.V.E. y Telemetría PostGIS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS sesiones_patrullaje (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lider_id            UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    acompanante_1_id    UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    acompanante_2_id    UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    lider_rut           VARCHAR(12) NULL REFERENCES usuarios(rut_usuario) ON DELETE SET NULL,
    acompanante_1_rut   VARCHAR(12) NULL REFERENCES usuarios(rut_usuario) ON DELETE SET NULL,
    acompanante_2_rut   VARCHAR(12) NULL REFERENCES usuarios(rut_usuario) ON DELETE SET NULL,
    id_sesion_operativa BIGINT NULL REFERENCES sesiones_operativas(id_sesion) ON DELETE SET NULL,
    identificador_unidad VARCHAR(30) NULL,
    tipo_medio          tipo_medio_enum NOT NULL,
    valor_uve           NUMERIC(3,2) NOT NULL CHECK (valor_uve IN (1.00, 0.80, 0.45, 0.30, 0.20)),
    ubicacion_actual    GEOMETRY(Point, 4326) NULL,
    estado              estado_sesion_patrullaje_enum NOT NULL DEFAULT 'DISPONIBLE',
    activa              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Regla de negocio a nivel de BD: Furgón Z (FZ) exige mínimo 1 acompañante; RPT exige 2 acompañantes; RPD exige 1 acompañante
    CONSTRAINT chk_reglas_tripulacion_uve CHECK (
        (tipo_medio = 'FZ'  AND (acompanante_1_id IS NOT NULL OR acompanante_1_rut IS NOT NULL) AND valor_uve = 1.00) OR
        (tipo_medio = 'RPT' AND (acompanante_1_id IS NOT NULL OR acompanante_1_rut IS NOT NULL)
                            AND (acompanante_2_id IS NOT NULL OR acompanante_2_rut IS NOT NULL) AND valor_uve = 1.00) OR
        (tipo_medio = 'RPD' AND (acompanante_1_id IS NOT NULL OR acompanante_1_rut IS NOT NULL) AND valor_uve = 0.80) OR
        (tipo_medio = 'MTT' AND valor_uve = 0.45) OR
        (tipo_medio = 'CB'  AND valor_uve = 0.30) OR
        (tipo_medio = 'INF' AND valor_uve = 0.20)
    )
);

CREATE INDEX IF NOT EXISTS idx_sesiones_patrullaje_geom ON sesiones_patrullaje USING GIST (ubicacion_actual);
CREATE INDEX IF NOT EXISTS idx_sesiones_patrullaje_estado ON sesiones_patrullaje (estado) WHERE activa = TRUE;

-- ==============================================================================
-- 5. TABLA: zonas_riesgo (Polígonos PostGIS y Clasificación Calibrada)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS zonas_riesgo (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id_zona_patrullaje      BIGINT NULL REFERENCES zonas_patrullaje(id_zona) ON DELETE SET NULL,
    nombre                  TEXT NOT NULL,
    direccion               TEXT NULL,
    cuadrante_id            UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
    geom                    GEOMETRY(Geometry, 4326) NOT NULL,
    score_gravedad          INTEGER NOT NULL DEFAULT 0,
    nivel_riesgo            nivel_riesgo_zona_enum NOT NULL DEFAULT 'BAJO',
    estado                  estado_zona_riesgo_enum NOT NULL DEFAULT 'LIBRE',
    minutos_patrullados_hoy INTEGER NOT NULL DEFAULT 0,
    ultimo_patrullaje       TIMESTAMPTZ NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zonas_riesgo_geom ON zonas_riesgo USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_zonas_riesgo_estado ON zonas_riesgo (estado, nivel_riesgo);

-- Extender zonas_patrullaje existente para mantener sincronización bidireccional
ALTER TABLE IF EXISTS zonas_patrullaje
    ADD COLUMN IF NOT EXISTS zona_riesgo_id UUID NULL,
    ADD COLUMN IF NOT EXISTS score_gravedad INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS nivel_riesgo VARCHAR(10) NOT NULL DEFAULT 'BAJO',
    ADD COLUMN IF NOT EXISTS estado_rotacion VARCHAR(20) NOT NULL DEFAULT 'LIBRE',
    ADD COLUMN IF NOT EXISTS minutos_patrullados_hoy INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ultimo_patrullaje TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS poligono_coords JSONB NULL;

-- ==============================================================================
-- 6. TABLA: delitos_registro (Severidad Intrínseca Directa sin Decaimiento)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS delitos_registro (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    zona_id         UUID NOT NULL REFERENCES zonas_riesgo(id) ON DELETE CASCADE,
    tipo_delito     VARCHAR(150) NOT NULL,
    categoria_peso  INTEGER NOT NULL CHECK (categoria_peso IN (50, 20, 10, 5, 2, 1)),
    fecha_hora      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delitos_registro_zona ON delitos_registro (zona_id, fecha_hora DESC);

-- Extender alertas_emergencia con demanda U.V.E. y unidades despachadas
ALTER TABLE IF EXISTS alertas_emergencia
    ADD COLUMN IF NOT EXISTS uve_requerida NUMERIC(3,2) DEFAULT 1.00,
    ADD COLUMN IF NOT EXISTS uve_despachada NUMERIC(4,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS patrullas_asignadas JSONB DEFAULT '[]'::JSONB;

-- ==============================================================================
-- 7. TRIGGER Y FUNCIÓN SQL: Recálculo de score_gravedad y nivel_riesgo
-- ==============================================================================
CREATE OR REPLACE FUNCTION fn_recalcular_score_gravedad()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_zona_id     UUID;
    v_total_score INTEGER;
    v_nivel       nivel_riesgo_zona_enum;
BEGIN
    v_zona_id := COALESCE(NEW.zona_id, OLD.zona_id);

    SELECT COALESCE(SUM(categoria_peso), 0)::INTEGER
      INTO v_total_score
      FROM delitos_registro
     WHERE zona_id = v_zona_id;

    -- Regla de calibración actualizada:
    -- > 80: ALTO (Requiere >= 1.00 U.V.E. continua: RPT o FZ)
    -- 40..80: MEDIO (Requiere 0.45 a 0.80 U.V.E.: MTT o RPD)
    -- < 40: BAJO (Requiere 0.20 a 0.30 U.V.E.: INF o CB)
    IF v_total_score > 80 THEN
        v_nivel := 'ALTO';
    ELSIF v_total_score >= 40 THEN
        v_nivel := 'MEDIO';
    ELSE
        v_nivel := 'BAJO';
    END IF;

    UPDATE zonas_riesgo
       SET score_gravedad = v_total_score,
           nivel_riesgo   = v_nivel,
           updated_at     = NOW()
     WHERE id = v_zona_id;

    -- Sincronizar también en zonas_patrullaje si existe vínculo
    UPDATE zonas_patrullaje
       SET score_gravedad = v_total_score,
           nivel_riesgo   = v_nivel::TEXT
     WHERE zona_riesgo_id = v_zona_id;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalcular_score_gravedad ON delitos_registro;
CREATE TRIGGER trg_recalcular_score_gravedad
AFTER INSERT OR UPDATE OR DELETE ON delitos_registro
FOR EACH ROW
EXECUTE FUNCTION fn_recalcular_score_gravedad();

-- ==============================================================================
-- 8. FUNCIÓN ESPACIAL: actualizar_telemetria_patrulla(p_sesion_id, p_lat, p_lon)
-- ==============================================================================
CREATE OR REPLACE FUNCTION actualizar_telemetria_patrulla(
    p_sesion_id UUID,
    p_lat       DOUBLE PRECISION,
    p_lon       DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_punto       GEOMETRY(Point, 4326);
    v_zona        RECORD;
    v_estado_ant  estado_sesion_patrullaje_enum;
    v_nuevo_est   estado_sesion_patrullaje_enum;
BEGIN
    v_punto := ST_SetSRID(ST_Point(p_lon, p_lat), 4326);

    SELECT estado INTO v_estado_ant
      FROM sesiones_patrullaje
     WHERE id = p_sesion_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'Sesión de patrullaje no encontrada'
        );
    END IF;

    -- 1. Actualizar ubicación actual de la patrulla
    UPDATE sesiones_patrullaje
       SET ubicacion_actual = v_punto,
           updated_at       = NOW()
     WHERE id = p_sesion_id;

    -- 2. Evaluar si ST_Contains(z.geom, ST_SetSRID(ST_Point(p_lon, p_lat), 4326)) coincide con una zona asignada
    SELECT z.id, z.nombre, z.nivel_riesgo, z.score_gravedad, z.minutos_patrullados_hoy
      INTO v_zona
      FROM zonas_riesgo z
     WHERE z.estado = 'ASIGNADA'
       AND ST_Contains(z.geom, v_punto)
     ORDER BY z.score_gravedad DESC
     LIMIT 1;

    IF FOUND THEN
        v_nuevo_est := 'EN_ZONA_RIESGO';

        UPDATE sesiones_patrullaje
           SET estado     = v_nuevo_est,
               updated_at = NOW()
         WHERE id = p_sesion_id
           AND estado NOT IN ('SOLICITANDO_REFUERZO', 'EN_REFUERZO');

        UPDATE zonas_riesgo
           SET minutos_patrullados_hoy = minutos_patrullados_hoy + 1,
               ultimo_patrullaje       = NOW(),
               updated_at              = NOW()
         WHERE id = v_zona.id;

        UPDATE zonas_patrullaje
           SET minutos_patrullados_hoy = minutos_patrullados_hoy + 1,
               ultimo_patrullaje       = NOW()
         WHERE zona_riesgo_id = v_zona.id;

        RETURN jsonb_build_object(
            'ok', true,
            'en_zona_riesgo', true,
            'estado_sesion', v_nuevo_est,
            'zona', jsonb_build_object(
                'id', v_zona.id,
                'nombre', v_zona.nombre,
                'nivel_riesgo', v_zona.nivel_riesgo,
                'score_gravedad', v_zona.score_gravedad,
                'minutos_patrullados_hoy', v_zona.minutos_patrullados_hoy + 1
            )
        );
    ELSE
        -- Si estaba en EN_ZONA_RIESGO y salió del polígono, pasa a PATRULLANDO
        IF v_estado_ant = 'EN_ZONA_RIESGO' THEN
            UPDATE sesiones_patrullaje
               SET estado     = 'PATRULLANDO',
                   updated_at = NOW()
             WHERE id = p_sesion_id;
            v_nuevo_est := 'PATRULLANDO';
        ELSE
            v_nuevo_est := v_estado_ant;
        END IF;

        RETURN jsonb_build_object(
            'ok', true,
            'en_zona_riesgo', false,
            'estado_sesion', v_nuevo_est,
            'zona', NULL
        );
    END IF;
END;
$$;

-- ==============================================================================
-- 9. VISTAS ESPACIALES PARA CONSULTA RÁPIDA EN BACKEND Y DASHBOARD
-- ==============================================================================
DROP VIEW IF EXISTS v_zonas_riesgo_geojson;
CREATE VIEW v_zonas_riesgo_geojson AS
SELECT
    z.id,
    z.id_zona_patrullaje,
    z.nombre,
    z.direccion,
    z.cuadrante_id,
    z.score_gravedad,
    z.nivel_riesgo,
    z.estado,
    z.minutos_patrullados_hoy,
    z.ultimo_patrullaje,
    ROUND((z.score_gravedad::NUMERIC / (1.0 + (0.02 * z.minutos_patrullados_hoy))), 2) AS score_ajustado,
    ST_Y(ST_Centroid(z.geom)) AS centro_lat,
    ST_X(ST_Centroid(z.geom)) AS centro_lng,
    ST_AsGeoJSON(z.geom)::JSONB AS geojson,
    CASE
        WHEN z.score_gravedad > 80 THEN 1.00
        WHEN z.score_gravedad >= 40 THEN 0.80
        ELSE 0.30
    END AS uve_objetivo_max,
    CASE
        WHEN z.score_gravedad > 80 THEN 1.00
        WHEN z.score_gravedad >= 40 THEN 0.45
        ELSE 0.20
    END AS uve_objetivo_min,
    z.created_at,
    z.updated_at
FROM zonas_riesgo z;

DROP VIEW IF EXISTS v_sesiones_patrullaje_activas;
CREATE VIEW v_sesiones_patrullaje_activas AS
SELECT
    sp.id,
    sp.id_sesion_operativa,
    sp.identificador_unidad,
    sp.lider_id,
    sp.acompanante_1_id,
    sp.acompanante_2_id,
    sp.lider_rut,
    sp.acompanante_1_rut,
    sp.acompanante_2_rut,
    sp.tipo_medio,
    sp.valor_uve,
    sp.estado,
    sp.activa,
    CASE WHEN sp.ubicacion_actual IS NOT NULL THEN ST_Y(sp.ubicacion_actual) ELSE NULL END AS lat,
    CASE WHEN sp.ubicacion_actual IS NOT NULL THEN ST_X(sp.ubicacion_actual) ELSE NULL END AS lng,
    sp.created_at,
    sp.updated_at,
    ul.nombre_completo AS lider_nombre,
    ul.grado_cargo     AS lider_grado,
    ua1.nombre_completo AS acompanante_1_nombre,
    ua2.nombre_completo AS acompanante_2_nombre
FROM sesiones_patrullaje sp
LEFT JOIN usuarios ul  ON ul.rut_usuario = sp.lider_rut OR ul.id = sp.lider_id
LEFT JOIN usuarios ua1 ON ua1.rut_usuario = sp.acompanante_1_rut OR ua1.id = sp.acompanante_1_id
LEFT JOIN usuarios ua2 ON ua2.rut_usuario = sp.acompanante_2_rut OR ua2.id = sp.acompanante_2_id
WHERE sp.activa = TRUE;

-- ==============================================================================
-- 10. POLÍTICAS RLS Y PERMISOS
-- ==============================================================================
ALTER TABLE sesiones_patrullaje ENABLE ROW LEVEL SECURITY;
ALTER TABLE zonas_riesgo        ENABLE ROW LEVEL SECURITY;
ALTER TABLE delitos_registro    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sesiones_patrullaje_all" ON sesiones_patrullaje;
CREATE POLICY "sesiones_patrullaje_all" ON sesiones_patrullaje FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "zonas_riesgo_all" ON zonas_riesgo;
CREATE POLICY "zonas_riesgo_all" ON zonas_riesgo FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delitos_registro_all" ON delitos_registro;
CREATE POLICY "delitos_registro_all" ON delitos_registro FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION actualizar_telemetria_patrulla(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated, service_role;

-- ==============================================================================
-- 11. SEED DE UNIDADES FURGÓN Z Y ZONAS DE RIESGO CALIBRADAS (VIÑA DEL MAR)
-- ==============================================================================
INSERT INTO vehiculos (patente, tipo_vehiculo, identificador_operativo, disponible)
VALUES
    ('FZ-4010', 'FURGON_Z', 'FZ-101', TRUE),
    ('FZ-4022', 'FURGON_Z', 'FZ-102', TRUE)
ON CONFLICT (identificador_operativo) DO UPDATE
SET disponible = TRUE, tipo_vehiculo = EXCLUDED.tipo_vehiculo;

-- Crear polígonos iniciales en zonas_riesgo si la tabla está vacía
DO $$
DECLARE
    v_z1 UUID;
    v_z2 UUID;
    v_z3 UUID;
    v_z4 UUID;
    v_z5 UUID;
    v_z6 UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM zonas_riesgo LIMIT 1) THEN
        -- Z1: Chonta 3544, Miraflores (Riesgo ALTO > 80 pts)
        INSERT INTO zonas_riesgo (nombre, direccion, geom, estado, minutos_patrullados_hoy)
        VALUES (
            'Z1 - Miraflores (Chonta)',
            'Chonta 3544, Miraflores, Viña del Mar',
            ST_Buffer(ST_SetSRID(ST_Point(-71.51398, -33.01840), 4326)::geography, 160)::geometry,
            'LIBRE',
            15
        ) RETURNING id INTO v_z1;

        INSERT INTO delitos_registro (zona_id, tipo_delito, categoria_peso) VALUES
            (v_z1, 'Delito con arma de fuego / Homicidio frustrado', 50),
            (v_z1, 'Robo con violencia / intimidación', 20),
            (v_z1, 'Robo en lugar habitado', 10),
            (v_z1, 'Robo por sorpresa', 5);
        -- Total Z1 = 85 pts -> ALTO

        -- Z2: 1 Norte / 1 Poniente (Riesgo ALTO > 80 pts)
        INSERT INTO zonas_riesgo (nombre, direccion, geom, estado, minutos_patrullados_hoy)
        VALUES (
            'Z2 - Eje 1 Norte / 1 Poniente',
            '1 Norte / 1 Poniente, Plan de Viña del Mar',
            ST_Buffer(ST_SetSRID(ST_Point(-71.55278, -33.02229), 4326)::geography, 160)::geometry,
            'LIBRE',
            25
        ) RETURNING id INTO v_z2;

        INSERT INTO delitos_registro (zona_id, tipo_delito, categoria_peso) VALUES
            (v_z2, 'Porte ilegal de arma / Asalto armado', 50),
            (v_z2, 'Robo con intimidación a peatón', 20),
            (v_z2, 'Robo de vehículo motorizado', 10),
            (v_z2, 'Receptación de especies', 5),
            (v_z2, 'Hurto simple en comercio', 2);
        -- Total Z2 = 87 pts -> ALTO

        -- Z3: Av. Valparaíso / Plaza Vergara (Riesgo MEDIO 40..80 pts)
        INSERT INTO zonas_riesgo (nombre, direccion, geom, estado, minutos_patrullados_hoy)
        VALUES (
            'Z3 - Plaza Vergara / Av. Valparaíso',
            'Av. Valparaíso / Plaza Vergara, Viña del Mar',
            ST_Buffer(ST_SetSRID(ST_Point(-71.55237, -33.02500), 4326)::geography, 160)::geometry,
            'LIBRE',
            10
        ) RETURNING id INTO v_z3;

        INSERT INTO delitos_registro (zona_id, tipo_delito, categoria_peso) VALUES
            (v_z3, 'Robo con violencia', 20),
            (v_z3, 'Robo de accesorio de vehículo', 10),
            (v_z3, 'Robo por sorpresa (lanzazo)', 5),
            (v_z3, 'Robo por sorpresa en paradero', 5),
            (v_z3, 'Hurto simple', 2);
        -- Total Z3 = 42 pts -> MEDIO

        -- Z4: 8 Norte / Av. Libertad (Riesgo MEDIO 40..80 pts)
        INSERT INTO zonas_riesgo (nombre, direccion, geom, estado, minutos_patrullados_hoy)
        VALUES (
            'Z4 - 8 Norte / Av. Libertad',
            '8 Norte con Av. Libertad, Población Vergara',
            ST_Buffer(ST_SetSRID(ST_Point(-71.55008, -33.01533), 4326)::geography, 160)::geometry,
            'LIBRE',
            20
        ) RETURNING id INTO v_z4;

        INSERT INTO delitos_registro (zona_id, tipo_delito, categoria_peso) VALUES
            (v_z4, 'Robo con intimidación', 20),
            (v_z4, 'Robo con violencia nocturno', 20),
            (v_z4, 'Robo en lugar habitado', 10),
            (v_z4, 'Robo por sorpresa', 5),
            (v_z4, 'Consumo de alcohol en vía pública', 1);
        -- Total Z4 = 56 pts -> MEDIO

        -- Z5: 15 Norte / Av. Libertad (Riesgo BAJO < 40 pts)
        INSERT INTO zonas_riesgo (nombre, direccion, geom, estado, minutos_patrullados_hoy)
        VALUES (
            'Z5 - 15 Norte / Mall Marina',
            '15 Norte / Av. Libertad, Viña del Mar',
            ST_Buffer(ST_SetSRID(ST_Point(-71.54849, -33.00800), 4326)::geography, 160)::geometry,
            'LIBRE',
            5
        ) RETURNING id INTO v_z5;

        INSERT INTO delitos_registro (zona_id, tipo_delito, categoria_peso) VALUES
            (v_z5, 'Robo de vehículo en estacionamiento', 10),
            (v_z5, 'Robo por sorpresa', 5),
            (v_z5, 'Hurto simple en tienda', 2),
            (v_z5, 'Lesiones leves', 2),
            (v_z5, 'Incivilidad en vía pública', 1);
        -- Total Z5 = 20 pts -> BAJO

        -- Z6: Av. Perú / 8 Norte (Riesgo BAJO < 40 pts)
        INSERT INTO zonas_riesgo (nombre, direccion, geom, estado, minutos_patrullados_hoy)
        VALUES (
            'Z6 - Borde Costero Av. Perú',
            'Av. Perú / 8 Norte, Viña del Mar',
            ST_Buffer(ST_SetSRID(ST_Point(-71.55655, -33.01439), 4326)::geography, 160)::geometry,
            'LIBRE',
            0
        ) RETURNING id INTO v_z6;

        INSERT INTO delitos_registro (zona_id, tipo_delito, categoria_peso) VALUES
            (v_z6, 'Robo por sorpresa', 5),
            (v_z6, 'Hurto simple', 2),
            (v_z6, 'Consumo de alcohol / drogas en vía pública', 1),
            (v_z6, 'Consumo de alcohol en vía pública', 1);
        -- Total Z6 = 9 pts -> BAJO
    END IF;
END $$;

-- Publicar nuevas tablas en Supabase Realtime
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['sesiones_patrullaje', 'zonas_riesgo', 'delitos_registro']
    LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    END LOOP;
END $$;

