import { supabaseAdmin } from '../config/supabase';

/**
 * Cierra automáticamente las sesiones operativas que dejaron de enviar telemetría
 * (app cerrada, sin señal, teléfono apagado). Al volver a abrir la app, el siguiente
 * ping de telemetría reabre la sesión (ver updateTelemetry).
 */
const STALE_MINUTES = Number(process.env.STALE_SESSION_MINUTES ?? 15);
const SWEEP_EVERY_MS = 30_000;

export async function sweepStaleSessions(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();

    const { data: abiertas, error } = await supabaseAdmin
      .from('sesiones_operativas')
      .select('id_sesion, fecha_inicio')
      .is('fecha_cierre', null);

    if (error || !abiertas?.length) return;

    for (const s of abiertas as { id_sesion: number; fecha_inicio: string }[]) {
      const { data: ping } = await supabaseAdmin
        .from('telemetria_activa')
        .select('timestamp_srv')
        .eq('id_sesion', s.id_sesion)
        .order('timestamp_srv', { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastSeen = ping?.timestamp_srv ?? s.fecha_inicio;
      if (lastSeen && lastSeen < cutoff) {
        await supabaseAdmin
          .from('sesiones_operativas')
          .update({ estado_operativo: 'INACTIVO', fecha_cierre: new Date().toISOString() })
          .eq('id_sesion', s.id_sesion)
          .is('fecha_cierre', null);

        // Cerrar también asignaciones abiertas de la sesión
        await supabaseAdmin
          .from('asignaciones_tacticas')
          .update({ estado_mision: 'COMPLETADA', hora_liberacion: new Date().toISOString() })
          .eq('id_sesion', s.id_sesion)
          .in('estado_mision', ['PENDIENTE', 'PATRULLANDO']);

        console.log(`[SWEEPER] Sesión ${s.id_sesion} cerrada por inactividad (> ${STALE_MINUTES} min sin señal)`);
      }
    }
  } catch (err) {
    console.warn('[SWEEPER] Error:', err);
  }
}

export function startSessionSweeper(): void {
  sweepStaleSessions();
  setInterval(sweepStaleSessions, SWEEP_EVERY_MS);
}
