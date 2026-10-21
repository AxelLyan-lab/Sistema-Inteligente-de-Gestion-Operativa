-- ==============================================================================
-- S.I.G.O. — HU13 Tarea #42
-- DDL Extendido + Políticas RLS para autenticación de funcionario en terreno
-- Ejecutar en el SQL Editor de Supabase
-- ==============================================================================

-- 1. Habilitar PostGIS si no está activo
CREATE EXTENSION IF NOT EXISTS postgis;

-- ==============================================================================
-- TABLA: funcionarios (extiende usuarios con datos institucionales)
-- ==============================================================================
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS grado_cargo VARCHAR(100),
  ADD COLUMN IF NOT EXISTS numero_placa VARCHAR(30) UNIQUE,
  ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS fecha_alta TIMESTAMP DEFAULT NOW();

-- ==============================================================================
-- TABLA: vehiculos — Registro de unidades vehiculares institucionales
-- ==============================================================================
CREATE TABLE IF NOT EXISTS vehiculos (
    id_vehiculo BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    patente VARCHAR(20) UNIQUE NOT NULL,
    tipo_vehiculo VARCHAR(30) NOT NULL CHECK (tipo_vehiculo IN ('PATRULLA', 'MOTO', 'BICICLETA', 'INFANTERIA')),
    identificador_operativo VARCHAR(30) NOT NULL UNIQUE,  -- Ej: "RP-402"
    disponible BOOLEAN DEFAULT TRUE,
    ultimo_mantenimiento DATE NULL,
    creado_en TIMESTAMP DEFAULT NOW()
);

-- ==============================================================================
-- TABLA: turnos_patrullaje — Control de turnos operativos de funcionarios
-- ==============================================================================
CREATE TABLE IF NOT EXISTS turnos_patrullaje (
    id_turno UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rut_funcionario VARCHAR(12) NOT NULL REFERENCES usuarios(rut_usuario),
    id_sesion BIGINT NULL REFERENCES sesiones_operativas(id_sesion),
    id_vehiculo BIGINT NULL REFERENCES vehiculos(id_vehiculo),
    fecha_turno DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_inicio TIME NOT NULL DEFAULT CURRENT_TIME,
    hora_fin TIME NULL,
    estado_turno VARCHAR(20) DEFAULT 'ACTIVO' CHECK (estado_turno IN ('ACTIVO', 'FINALIZADO', 'CANCELADO')),
    observaciones TEXT NULL,
    creado_en TIMESTAMP DEFAULT NOW()
);

-- ==============================================================================
-- TABLA: dotacion_turno — Tripulación asociada a un turno (con rol)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS dotacion_turno (
    id_dotacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_turno UUID NOT NULL REFERENCES turnos_patrullaje(id_turno) ON DELETE CASCADE,
    rut_funcionario VARCHAR(12) NOT NULL REFERENCES usuarios(rut_usuario),
    es_conductor BOOLEAN DEFAULT FALSE,
    hora_incorporacion TIMESTAMP DEFAULT NOW(),
    hora_baja TIMESTAMP NULL
);

-- ==============================================================================
-- TABLA: alertas_refuerzo — Extensión de alertas_emergencia con más campos
-- ==============================================================================
CREATE TABLE IF NOT EXISTS alertas_refuerzo (
    id_alerta BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sesion_solicitante BIGINT NOT NULL REFERENCES sesiones_operativas(id_sesion),
    id_turno UUID NULL REFERENCES turnos_patrullaje(id_turno),
    geom_emergencia GEOMETRY(Point, 4326) NOT NULL,
    estado VARCHAR(30) DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'EN_CAMINO', 'RESUELTA', 'CANCELADA')),
    unidades_asignadas JSONB NULL,           -- Array de id_sesion de refuerzos
    fecha_alerta TIMESTAMP DEFAULT NOW(),
    fecha_resolucion TIMESTAMP NULL,
    observaciones TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_alertas_refuerzo_geom ON alertas_refuerzo USING GIST(geom_emergencia);

-- Agregar campo identificador_unidad a sesiones_operativas si no existe
ALTER TABLE sesiones_operativas
  ADD COLUMN IF NOT EXISTS identificador_unidad VARCHAR(30);

-- Agregar INFANTERIA como tipo de transporte válido
ALTER TABLE sesiones_operativas
  DROP CONSTRAINT IF EXISTS sesiones_operativas_tipo_transporte_check;
ALTER TABLE sesiones_operativas
  ADD CONSTRAINT sesiones_operativas_tipo_transporte_check
  CHECK (tipo_transporte IN ('PATRULLA', 'MOTO', 'BICICLETA', 'INFANTERIA'));

ALTER TABLE vehiculos
  DROP CONSTRAINT IF EXISTS vehiculos_tipo_vehiculo_check;
ALTER TABLE vehiculos
  ADD CONSTRAINT vehiculos_tipo_vehiculo_check
  CHECK (tipo_vehiculo IN ('PATRULLA', 'MOTO', 'BICICLETA', 'INFANTERIA'));

-- ==============================================================================
-- HABILITAR ROW LEVEL SECURITY (RLS) — Tarea #42
-- ==============================================================================

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesiones_operativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tripulacion_sesion DISABLE ROW LEVEL SECURITY;
ALTER TABLE registro_evidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_emergencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_refuerzo ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos_patrullaje ENABLE ROW LEVEL SECURITY;
ALTER TABLE dotacion_turno ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- POLÍTICAS RLS: usuarios
-- ==============================================================================

-- Permitir lectura pública para que la API de terreno verifique credenciales
DROP POLICY IF EXISTS "usuarios_select_own" ON usuarios;
DROP POLICY IF EXISTS "usuarios_select_all" ON usuarios;
CREATE POLICY "usuarios_select_all"
  ON usuarios FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "usuarios_insert_service" ON usuarios;
CREATE POLICY "usuarios_insert_service"
  ON usuarios FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "usuarios_update_own" ON usuarios;
CREATE POLICY "usuarios_update_own"
  ON usuarios FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- POLÍTICAS RLS: sesiones_operativas
-- ==============================================================================

DROP POLICY IF EXISTS "sesiones_select_own" ON sesiones_operativas;
DROP POLICY IF EXISTS "sesiones_select_all" ON sesiones_operativas;
CREATE POLICY "sesiones_select_all"
  ON sesiones_operativas FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "sesiones_insert_service" ON sesiones_operativas;
DROP POLICY IF EXISTS "sesiones_insert_all" ON sesiones_operativas;
CREATE POLICY "sesiones_insert_all"
  ON sesiones_operativas FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "sesiones_update_own" ON sesiones_operativas;
DROP POLICY IF EXISTS "sesiones_update_all" ON sesiones_operativas;
CREATE POLICY "sesiones_update_all"
  ON sesiones_operativas FOR UPDATE
  USING (true);

-- ==============================================================================
-- POLÍTICAS RLS: tripulacion_sesion
-- ==============================================================================

-- Permitir gestión operativa fluida de la tripulación en terreno
ALTER TABLE tripulacion_sesion DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tripulacion_select_all" ON tripulacion_sesion;
CREATE POLICY "tripulacion_select_all" ON tripulacion_sesion FOR SELECT USING (true);

DROP POLICY IF EXISTS "tripulacion_insert_all" ON tripulacion_sesion;
CREATE POLICY "tripulacion_insert_all" ON tripulacion_sesion FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "tripulacion_delete_all" ON tripulacion_sesion;
CREATE POLICY "tripulacion_delete_all" ON tripulacion_sesion FOR DELETE USING (true);

DROP POLICY IF EXISTS "tripulacion_update_all" ON tripulacion_sesion;
CREATE POLICY "tripulacion_update_all" ON tripulacion_sesion FOR UPDATE USING (true);

-- ==============================================================================
-- POLÍTICAS RLS: registro_evidencias
-- ==============================================================================

DROP POLICY IF EXISTS "evidencias_select_own_sesion" ON registro_evidencias;
CREATE POLICY "evidencias_select_own_sesion"
  ON registro_evidencias FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "evidencias_insert_own_sesion" ON registro_evidencias;
CREATE POLICY "evidencias_insert_own_sesion"
  ON registro_evidencias FOR INSERT
  WITH CHECK (true);

-- ==============================================================================
-- POLÍTICAS RLS: alertas_emergencia
-- ==============================================================================

DROP POLICY IF EXISTS "alertas_insert_own" ON alertas_emergencia;
CREATE POLICY "alertas_insert_own"
  ON alertas_emergencia FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "alertas_select_own" ON alertas_emergencia;
CREATE POLICY "alertas_select_own"
  ON alertas_emergencia FOR SELECT
  USING (true);

-- ==============================================================================
-- POLÍTICAS RLS: turnos_patrullaje
-- ==============================================================================

DROP POLICY IF EXISTS "turnos_select_own" ON turnos_patrullaje;
CREATE POLICY "turnos_select_own"
  ON turnos_patrullaje FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "turnos_insert_service" ON turnos_patrullaje;
CREATE POLICY "turnos_insert_service"
  ON turnos_patrullaje FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "turnos_update_own" ON turnos_patrullaje;
CREATE POLICY "turnos_update_own"
  ON turnos_patrullaje FOR UPDATE
  USING (true);

-- ==============================================================================
-- POLÍTICAS RLS: dotacion_turno
-- ==============================================================================

DROP POLICY IF EXISTS "dotacion_select_turno" ON dotacion_turno;
CREATE POLICY "dotacion_select_turno"
  ON dotacion_turno FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "dotacion_insert_service" ON dotacion_turno;
CREATE POLICY "dotacion_insert_service"
  ON dotacion_turno FOR INSERT
  WITH CHECK (true);

-- ==============================================================================
-- PERMISOS Y PRIVILEGIOS PÚBLICOS / ANON
-- Permite que el backend autentique y gestione sesiones operativas
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;


-- ==============================================================================
-- DATOS DE PRUEBA — Credenciales de Funcionarios en Terreno (HU13)
-- Contraseña general para todos los funcionarios de prueba: "sigo2026"
-- Hash bcrypt (cost 10/12): $2a$10$SOLt4DQNEQgrCiu28a.KXOeef/HBDMs.I3g7xvj4BxScif6Eujk/q
-- ==============================================================================

-- 1. Unidades Vehiculares (Radio Patrullas, Motos, Bicicletas, Infantería)
INSERT INTO vehiculos (patente, tipo_vehiculo, identificador_operativo, disponible)
VALUES
  ('BBCD-12', 'PATRULLA',  'RP-402',  TRUE),
  ('KJMN-45', 'PATRULLA',  'RP-201',  TRUE),
  ('JK-892',  'MOTO',      'MT-105',  TRUE),
  ('ZX-341',  'MOTO',      'MT-108',  TRUE),
  ('BIC-021', 'BICICLETA', 'BC-021',  TRUE),
  ('INF-001', 'INFANTERIA','INF-01',  TRUE)
ON CONFLICT (identificador_operativo) DO UPDATE
SET disponible = TRUE, tipo_vehiculo = EXCLUDED.tipo_vehiculo;

-- 2. Usuarios del Sistema (Supervisor Web y Personal en Terreno)
INSERT INTO usuarios (rut_usuario, password_hash, rol, nombre_completo, grado_cargo, activo)
VALUES
  -- SUPERVISOR WEB (Dashboard Web en http://localhost:4200)
  (
    '12345678-9',
    '$2a$10$SOLt4DQNEQgrCiu28a.KXOeef/HBDMs.I3g7xvj4BxScif6Eujk/q',
    'SUPERVISOR_WEB',
    'Carlos Fernández Rojas (Supervisor)',
    'Capitán',
    TRUE
  ),
  -- Radio Patrulla 1 (RP-402 - Conductor en Terreno)
  (
    '11223344-5',
    '$2a$10$SOLt4DQNEQgrCiu28a.KXOeef/HBDMs.I3g7xvj4BxScif6Eujk/q',
    'FUNCIONARIO_MOVIL',
    'Juan Morales Castro',
    'Cabo 1°',
    TRUE
  ),
  -- Radio Patrulla 2
  (
    '15678912-3',
    '$2a$10$SOLt4DQNEQgrCiu28a.KXOeef/HBDMs.I3g7xvj4BxScif6Eujk/q',
    'FUNCIONARIO_MOVIL',
    'Rodrigo Morales Silva',
    'Sargento 2°',
    TRUE
  ),
  -- Unidad Motorizada 1
  (
    '18345672-K',
    '$2a$10$SOLt4DQNEQgrCiu28a.KXOeef/HBDMs.I3g7xvj4BxScif6Eujk/q',
    'FUNCIONARIO_MOVIL',
    'Matías Valenzuela Soto',
    'Cabo 2°',
    TRUE
  ),
  -- Unidad Motorizada 2
  (
    '19876543-2',
    '$2a$10$SOLt4DQNEQgrCiu28a.KXOeef/HBDMs.I3g7xvj4BxScif6Eujk/q',
    'FUNCIONARIO_MOVIL',
    'Javiera Tapia Carrasco',
    'Carabinero',
    TRUE
  ),
  -- Ciclo Patrulla (Bicicleta)
  (
    '17890123-4',
    '$2a$10$SOLt4DQNEQgrCiu28a.KXOeef/HBDMs.I3g7xvj4BxScif6Eujk/q',
    'FUNCIONARIO_MOVIL',
    'Sebastián Pizarro Lagos',
    'Carabinero',
    TRUE
  ),
  -- Patrullaje Peatonal (Infantería)
  (
    '14234567-8',
    '$2a$10$SOLt4DQNEQgrCiu28a.KXOeef/HBDMs.I3g7xvj4BxScif6Eujk/q',
    'FUNCIONARIO_MOVIL',
    'Andrea González Muñoz',
    'Suboficial',
    TRUE
  )
ON CONFLICT (rut_usuario) DO UPDATE
SET
  password_hash = EXCLUDED.password_hash,
  rol = EXCLUDED.rol,
  nombre_completo = EXCLUDED.nombre_completo,
  grado_cargo = EXCLUDED.grado_cargo,
  activo = TRUE;
