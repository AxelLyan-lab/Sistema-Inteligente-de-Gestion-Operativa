-- ==============================================================================
-- S.I.G.O. — Motor Táctico 24/7 (Estado Global y Patrullas en Servidor)
-- Permite que el patrullaje, la rotación de zonas y los modos AUTO/OPTIMIZADO
-- sigan funcionando 24/7 en sigo-api aunque se cierre el navegador.
-- Ejecutar en el SQL Editor de Supabase.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.estado_operacion_global (
    id                      INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    modo_despacho           VARCHAR(20) NOT NULL DEFAULT 'MANUAL'
                            CHECK (modo_despacho IN ('MANUAL', 'AUTO', 'OPTIMIZADO')),
    k_zonas                 INTEGER NOT NULL DEFAULT 3 CHECK (k_zonas BETWEEN 1 AND 9),
    intervalo_rotacion_seg  INTEGER NOT NULL DEFAULT 60 CHECK (intervalo_rotacion_seg >= 10),
    zonas_activas_ids       JSONB NOT NULL DEFAULT '[]'::jsonb,
    proximo_ciclo_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 seconds'),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.estado_operacion_global (id, modo_despacho, k_zonas, intervalo_rotacion_seg)
VALUES (1, 'MANUAL', 3, 60)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.patrullas_tacticas (
    id                  TEXT PRIMARY KEY,
    nombre              TEXT NOT NULL,
    tipo_medio          VARCHAR(10) NOT NULL DEFAULT 'RPD',
    valor_uve           NUMERIC(3,2) NOT NULL DEFAULT 0.80,
    dotacion_total      INTEGER NOT NULL DEFAULT 2,
    estado              VARCHAR(20) NOT NULL DEFAULT 'DISPONIBLE'
                        CHECK (estado IN ('DISPONIBLE', 'EN_RUTA', 'PATRULLANDO')),
    lat                 DOUBLE PRECISION NOT NULL DEFAULT -33.0153,
    lng                 DOUBLE PRECISION NOT NULL DEFAULT -71.5500,
    destino_zona_id     INTEGER NULL,
    destino_zona_json   JSONB NULL,
    is_manual           BOOLEAN NOT NULL DEFAULT FALSE,
    angulo_orbita       DOUBLE PRECISION NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS (lectura controlada; escritura exclusiva desde sigo-api)
ALTER TABLE public.estado_operacion_global ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrullas_tacticas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_estado_operacion" ON public.estado_operacion_global;
CREATE POLICY "anon_read_estado_operacion"
  ON public.estado_operacion_global FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "anon_read_patrullas_tacticas" ON public.patrullas_tacticas;
CREATE POLICY "anon_read_patrullas_tacticas"
  ON public.patrullas_tacticas FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.estado_operacion_global FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.patrullas_tacticas FROM anon;

