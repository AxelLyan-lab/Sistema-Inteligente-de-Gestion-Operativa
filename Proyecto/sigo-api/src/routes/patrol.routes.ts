import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../config/supabase';
import { tacticalEngine } from '../utils/tacticalEngine';
import {
  requestReinforcements,
  addCrewMember,
  removeCrewMember,
  getCrew,
  updateTelemetry,
  getTelemetryStatus,
} from '../controllers/patrol.controller';
import {
  getActiveAssignment,
  markAssignmentArrived,
  getMessages,
  sendMessage,
  sendAudioMessage,
  audioUploadMiddleware,
} from '../controllers/mission.controller';

export const patrolRouter = Router();

// Todas las rutas de patrullaje requieren JWT
patrolRouter.use(authenticateToken);

/** POST /api/v1/patrol/sos — Solicitar refuerzos */
patrolRouter.post('/sos', requestReinforcements);

const ZONE_ADDRESS_MAP: Record<string, string> = {
  Z1: 'Chonta 3544, Miraflores, Viña del Mar',
  Z2: '1 Norte / 1 Poniente, Viña del Mar',
  Z3: '8 Norte / Av. Libertad, Viña del Mar',
  Z4: 'Av. Valparaíso / Plaza Vergara, Viña del Mar',
  Z5: '2 Norte / 4 Poniente, Viña del Mar',
  Z6: '15 Norte / Av. Libertad, Viña del Mar',
  Z7: '4 Norte / 2 Oriente, Viña del Mar',
  Z8: 'Av. Perú / 8 Norte, Viña del Mar',
  Z9: 'Álvarez / Traslaviña, Viña del Mar',
  UNAB: 'Quillota 980, Viña del Mar',
};

function parseUtcMs(raw: any): number | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw.getTime();
  const s = String(raw).trim();
  const iso = /(Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : s.replace(' ', 'T') + 'Z';
  const ms = new Date(iso).getTime();
  return isNaN(ms) ? null : ms;
}

function formatChileTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('es-CL', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** GET /api/v1/patrol/retrasos — Detecta automáticamente zonas con retraso del turno (login) actual */
patrolRouter.get('/retrasos', async (req, res) => {
  const patrolId = req.tacticalUser?.patrol_id;
  if (!patrolId) {
    res.json({ retrasos: [] });
    return;
  }

  const [{ data: asigs, error: errAsig }, { data: evidencias }] = await Promise.all([
    supabaseAdmin
      .from('asignaciones_tacticas')
      .select('*')
      .eq('id_sesion', patrolId)
      .order('id_asignacion', { ascending: false }),
    supabaseAdmin
      .from('registro_evidencias')
      .select('id_evidencia, id_asignacion, descripcion_texto, tipo_evidencia')
      .eq('id_sesion', patrolId)
      .eq('tipo_evidencia', 'JUSTIFICACION_ATRASO'),
  ]);

  if (errAsig) {
    console.warn('[retrasos] Error consultando asignaciones:', errAsig.message);
  }

  const justifs = Array.isArray(evidencias) ? evidencias : [];
  const ahoraMs = Date.now();
  const retrasos: Array<{
    id_asignacion: number;
    nombre_zona: string;
    direccion_zona: string;
    hora_asignacion: string;
    segundos_retraso: number;
    minutos_retraso: number;
    texto_retraso: string;
    estado_mision: string;
    justificada: boolean;
  }> = [];

  for (const a of (asigs ?? [])) {
    const isSos = typeof a.instrucciones === 'string' && a.instrucciones.includes('Código Rojo');
    const etaMatch = isSos && typeof a.instrucciones === 'string'
      ? a.instrucciones.match(/\[ETA:(\d+(?:\.\d+)?)\]/i)
      : null;
    const limiteMin = Number(a.tiempo_limite_min) || (etaMatch ? Number(etaMatch[1]) : tacticalEngine.getTiempoLlegadaMin());
    const fechaDespachoRaw = a.hora_despacho || a.fecha_asignacion || a.created_at;
    const inicioMs = parseUtcMs(fechaDespachoRaw);
    if (!inicioMs) continue;

    const ingresoMs = parseUtcMs(a.hora_ingreso_zona || a.fecha_llegada);
    const liberacionMs = parseUtcMs(a.hora_liberacion);
    // Si llegó a la zona, medimos hasta su llegada; si fue cancelada/finalizada sin llegar, hasta su liberación; si sigue activa, hasta ahora
    const finMs = ingresoMs ?? liberacionMs ?? ahoraMs;
    const limiteMs = limiteMin * 60000;
    const diffMs = finMs - inicioMs;

    // Apenas pasa del tiempo dispuesto (incluso por 1 segundo), queda registrado el atraso en este login
    if (diffMs > limiteMs) {
      const tag = `#ASIG-${a.id_asignacion}`;
      const yaJustificada = justifs.some(
        (ev: any) =>
          Number(ev.id_asignacion) === Number(a.id_asignacion) ||
          (ev.descripcion_texto || '').includes(tag)
      );
      const segsRetraso = Math.max(1, Math.floor((diffMs - limiteMs) / 1000));
      const minsRetraso = Math.max(1, Math.ceil(segsRetraso / 60));
      const textoRetraso =
        segsRetraso < 60
          ? `${segsRetraso} seg`
          : `${Math.floor(segsRetraso / 60)} min ${segsRetraso % 60} seg`;

      const nombreZona = (a.nombre_zona || 'Zona asignada').trim();
      const baseAddr = ZONE_ADDRESS_MAP[nombreZona.toUpperCase()] || '';
      const instruccionLimpia = (a.instrucciones || '')
        .replace(/\[ETA:\d+(?:\.\d+)?\]\s*/gi, '')
        .replace(/Desplazamiento táctico prioritario\.?/gi, '')
        .trim();
      const direccionFinal =
        baseAddr ||
        instruccionLimpia ||
        (a.centro_lat && a.centro_lng
          ? `Coord: ${Number(a.centro_lat).toFixed(4)}, ${Number(a.centro_lng).toFixed(4)} (Viña del Mar)`
          : nombreZona);

      retrasos.push({
        id_asignacion: a.id_asignacion,
        nombre_zona: nombreZona,
        direccion_zona: direccionFinal,
        hora_asignacion: formatChileTime(inicioMs),
        segundos_retraso: segsRetraso,
        minutos_retraso: minsRetraso,
        texto_retraso: textoRetraso,
        estado_mision: a.estado_mision || 'PENDIENTE',
        justificada: yaJustificada,
      });
    }
  }

  res.json({ retrasos });
});

/** POST /api/v1/patrol/justificar-retraso — Guarda justificación (solo texto, sin archivo) en Evidencias */
patrolRouter.post('/justificar-retraso', async (req, res) => {
  const patrolId = req.tacticalUser?.patrol_id;
  const { descripcion_texto, id_asignacion } = req.body as {
    descripcion_texto?: string;
    id_asignacion?: number | null;
  };
  if (!patrolId || !descripcion_texto?.trim()) {
    res.status(400).json({ error: 'La justificación escrita es obligatoria.' });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('registro_evidencias')
    .insert({
      id_sesion: patrolId,
      id_asignacion: id_asignacion ?? null,
      origen: 'MOVIL',
      subido_por: req.tacticalUser?.nombre ?? 'Funcionario en Terreno',
      tipo_evidencia: 'JUSTIFICACION_ATRASO',
      es_obligatoria: true,
      url_fotografia: null,
      descripcion_texto: descripcion_texto.trim(),
      fecha_subida: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json({ ok: true, evidencia: data });
});

/** GET /api/v1/patrol/sos/estado — Verifica si la sesión tiene una alerta SOS ACTIVA */
patrolRouter.get('/sos/estado', async (req, res) => {
  const patrolId = req.tacticalUser?.patrol_id;
  if (!patrolId) {
    res.json({ activa: false });
    return;
  }
  const { data } = await supabaseAdmin
    .from('alertas_emergencia')
    .select('id_emergencia, estado')
    .eq('id_sesion_solicitante', patrolId)
    .eq('estado', 'ACTIVA')
    .limit(1);
  res.json({ activa: Array.isArray(data) && data.length > 0 });
});

/** GET /api/v1/patrol/crew — Ver tripulación */
patrolRouter.get('/crew', getCrew);

/** POST /api/v1/patrol/crew/add — Agregar miembro */
patrolRouter.post('/crew/add', addCrewMember);

/** DELETE /api/v1/patrol/crew/:rut — Eliminar miembro */
patrolRouter.delete('/crew/:rut', removeCrewMember);

/** POST /api/v1/patrol/telemetry — Ingestar ping GNSS completo */
patrolRouter.post('/telemetry', updateTelemetry);

/** GET /api/v1/patrol/telemetry/status — Último ping registrado */
patrolRouter.get('/telemetry/status', getTelemetryStatus);

/** GET /api/v1/patrol/assignment - Misión (zona) asignada por el supervisor */
patrolRouter.get('/assignment', getActiveAssignment);

/** POST /api/v1/patrol/assignment/arrived - Notificar ingreso a la zona */
patrolRouter.post('/assignment/arrived', markAssignmentArrived);

/** GET /api/v1/patrol/messages - Conversación con la central */
patrolRouter.get('/messages', getMessages);

/** POST /api/v1/patrol/message - Enviar mensaje a la central */
patrolRouter.post('/message', sendMessage);

/** POST /api/v1/patrol/message/audio - Enviar nota de voz a la central */
patrolRouter.post('/message/audio', audioUploadMiddleware, sendAudioMessage);


