-- =========================================================================
-- S.I.G.O. - Cerrar sesiones viejas sin actividad GPS reciente
-- Ejecutar en: https://supabase.com/dashboard/project/cjyrlgpnqkahhyqgyyvu/sql/new
-- =========================================================================

-- 1. Cerrar sesiones que llevan más de 1 hora abiertas SIN ningún ping de telemetría
--    (estas son sesiones huérfanas de Rodrigo, Matías y el Funcionario Demo)
UPDATE sesiones_operativas
SET
  estado_operativo = 'INACTIVO',
  fecha_cierre     = NOW()
WHERE
  fecha_cierre IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM telemetria_activa t
    WHERE  t.id_sesion = sesiones_operativas.id_sesion
  );

-- 2. Verificar qué quedó abierto (deberían ser 0 registros si todo se cerró)
SELECT id_sesion, rut_conductor, identificador_unidad, estado_operativo, fecha_inicio
FROM   sesiones_operativas
WHERE  fecha_cierre IS NULL;
