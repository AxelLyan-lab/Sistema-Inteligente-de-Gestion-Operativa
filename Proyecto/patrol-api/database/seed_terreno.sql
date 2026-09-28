-- ==============================================================================
-- S.I.G.O. — HU13: SEMILLA DE CREDENCIALES PARA FUNCIONARIOS EN TERRENO
-- Ejecutar en el SQL Editor de Supabase (https://supabase.com/dashboard)
-- Contraseña para todos los funcionarios de prueba: "sigo2026"
-- ==============================================================================

-- 1. Permisos para que la API de patrullaje pueda autenticar y operar
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 2. Políticas RLS permisivas para el backend
DROP POLICY IF EXISTS "usuarios_select_all" ON usuarios;
CREATE POLICY "usuarios_select_all" ON usuarios FOR SELECT USING (true);

DROP POLICY IF EXISTS "sesiones_insert_all" ON sesiones_operativas;
CREATE POLICY "sesiones_insert_all" ON sesiones_operativas FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "sesiones_update_all" ON sesiones_operativas;
CREATE POLICY "sesiones_update_all" ON sesiones_operativas FOR UPDATE USING (true);

DROP POLICY IF EXISTS "sesiones_select_all" ON sesiones_operativas;
CREATE POLICY "sesiones_select_all" ON sesiones_operativas FOR SELECT USING (true);

-- Permitir gestión total de la tripulación en sesiones operativas
ALTER TABLE tripulacion_sesion DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tripulacion_select_all" ON tripulacion_sesion;
CREATE POLICY "tripulacion_select_all" ON tripulacion_sesion FOR SELECT USING (true);
DROP POLICY IF EXISTS "tripulacion_insert_all" ON tripulacion_sesion;
CREATE POLICY "tripulacion_insert_all" ON tripulacion_sesion FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "tripulacion_delete_all" ON tripulacion_sesion;
CREATE POLICY "tripulacion_delete_all" ON tripulacion_sesion FOR DELETE USING (true);
DROP POLICY IF EXISTS "tripulacion_update_all" ON tripulacion_sesion;
CREATE POLICY "tripulacion_update_all" ON tripulacion_sesion FOR UPDATE USING (true);

-- 3. Estructura de Sesiones y Vehículos Operativos
ALTER TABLE sesiones_operativas
  ADD COLUMN IF NOT EXISTS identificador_unidad VARCHAR(30);

ALTER TABLE vehiculos
  DROP CONSTRAINT IF EXISTS vehiculos_tipo_vehiculo_check;
ALTER TABLE vehiculos
  ADD CONSTRAINT vehiculos_tipo_vehiculo_check
  CHECK (tipo_vehiculo IN ('PATRULLA', 'MOTO', 'BICICLETA', 'INFANTERIA'));

INSERT INTO vehiculos (patente, tipo_vehiculo, identificador_operativo, disponible)
VALUES
  ('BBCD-12', 'PATRULLA',   'RP-402', TRUE),
  ('KJMN-45', 'PATRULLA',   'RP-201', TRUE),
  ('JK-892',  'MOTO',       'MT-105', TRUE),
  ('ZX-341',  'MOTO',       'MT-108', TRUE),
  ('BIC-021', 'BICICLETA',  'BC-021', TRUE),
  ('INF-001', 'INFANTERIA', 'INF-01', TRUE)
ON CONFLICT (identificador_operativo) DO UPDATE
SET disponible = TRUE, tipo_vehiculo = EXCLUDED.tipo_vehiculo;

-- 4. Usuarios del Sistema (Supervisor Web y Personal en Terreno)
-- Hash bcrypt correspondiente a la clave: "sigo2026"
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
  -- Radio Patrulla (RP-201)
  (
    '15678912-3',
    '$2a$10$SOLt4DQNEQgrCiu28a.KXOeef/HBDMs.I3g7xvj4BxScif6Eujk/q',
    'FUNCIONARIO_MOVIL',
    'Rodrigo Morales Silva',
    'Sargento 2°',
    TRUE
  ),
  -- Unidad Motorizada (MT-105)
  (
    '18345672-K',
    '$2a$10$SOLt4DQNEQgrCiu28a.KXOeef/HBDMs.I3g7xvj4BxScif6Eujk/q',
    'FUNCIONARIO_MOVIL',
    'Matías Valenzuela Soto',
    'Cabo 2°',
    TRUE
  ),
  -- Unidad Motorizada (MT-108)
  (
    '19876543-2',
    '$2a$10$SOLt4DQNEQgrCiu28a.KXOeef/HBDMs.I3g7xvj4BxScif6Eujk/q',
    'FUNCIONARIO_MOVIL',
    'Javiera Tapia Carrasco',
    'Carabinero',
    TRUE
  ),
  -- Ciclo Patrulla (BC-021)
  (
    '17890123-4',
    '$2a$10$SOLt4DQNEQgrCiu28a.KXOeef/HBDMs.I3g7xvj4BxScif6Eujk/q',
    'FUNCIONARIO_MOVIL',
    'Sebastián Pizarro Lagos',
    'Carabinero',
    TRUE
  ),
  -- Infantería / Patrullaje Peatonal (INF-01)
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
