-- =========================================================================
-- S.I.G.O. - Activar Supabase Realtime en tablas críticas
-- Ejecutar en: https://supabase.com/dashboard/project/cjyrlgpnqkahhyqgyyvu/sql/new
-- =========================================================================

-- 1. Habilitar Realtime en sesiones_operativas (para detectar login desde el teléfono)
ALTER PUBLICATION supabase_realtime ADD TABLE public.sesiones_operativas;

-- 2. Habilitar Realtime en telemetria_activa (para recibir pings GPS)
ALTER PUBLICATION supabase_realtime ADD TABLE public.telemetria_activa;

-- 3. REPLICA IDENTITY FULL: necesario para que Realtime transmita el contenido completo
--    de cada fila en los eventos INSERT/UPDATE/DELETE
ALTER TABLE public.sesiones_operativas REPLICA IDENTITY FULL;
ALTER TABLE public.telemetria_activa   REPLICA IDENTITY FULL;
