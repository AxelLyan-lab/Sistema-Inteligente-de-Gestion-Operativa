import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';

// ── POST /api/v1/patrol/sos  — Solicitud de refuerzos ─────────────────────
export async function requestReinforcements(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { patrol_id, user_id } = req.tacticalUser!;
  const { latitude, longitude } = req.body;

  try {
    if (!latitude || !longitude) {
      res.status(400).json({ error: 'Coordenadas GPS requeridas', code: 'NO_COORDS' } as any);
      return;
    }

    // Registrar alerta de emergencia
    const { data: alerta, error } = await supabaseAdmin
      .from('alertas_emergencia')
      .insert({
        id_sesion_solicitante: patrol_id,
        geom_emergencia: `SRID=4326;POINT(${longitude} ${latitude})`,
        estado: 'ACTIVA',
        fecha_alerta: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Actualizar estado de la sesión solicitante
    await supabaseAdmin
      .from('sesiones_operativas')
      .update({ estado_operativo: 'OCUPADO_EMERGENCIA' })
      .eq('id_sesion', patrol_id);

    res.status(201).json({
      message: '🚨 Alerta de refuerzos enviada',
      alerta_id: alerta.id_emergencia,
      patrol_id,
      rut_solicitante: user_id,
      coordenadas: { latitude, longitude },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/v1/patrol/crew/add  — Agregar miembro a la tripulación ────────
export async function addCrewMember(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { patrol_id, user_id } = req.tacticalUser!;
  const { rut_acompanante } = req.body;

  try {
    if (!rut_acompanante || !rut_acompanante.trim()) {
      res.status(400).json({ error: 'RUT de acompañante es requerido', code: 'MISSING_RUT' } as any);
      return;
    }

    const rutLimpio = rut_acompanante.trim();

    if (rutLimpio === user_id) {
      res.status(400).json({
        error: 'No puedes agregarte a ti mismo como acompañante.',
        code: 'SELF_COMPANION',
      } as any);
      return;
    }

    // 1. Verificar existencia y rol del funcionario
    const { data: usuario, error: userError } = await supabaseAdmin
      .from('usuarios')
      .select('rut_usuario, nombre_completo, grado_cargo, rol, activo')
      .eq('rut_usuario', rutLimpio)
      .maybeSingle();

    if (userError || !usuario) {
      res.status(404).json({ error: 'Funcionario no encontrado con este RUT.', code: 'USER_NOT_FOUND' } as any);
      return;
    }

    if (usuario.rol !== 'FUNCIONARIO_MOVIL') {
      res.status(403).json({
        error: `El funcionario ${usuario.nombre_completo} tiene rol ${usuario.rol} y no puede operar en terreno.`,
        code: 'NOT_FIELD_OFFICER',
      } as any);
      return;
    }

    // 2. Verificar que no tenga sesión activa como conductor
    const { data: activeAsConductor } = await supabaseAdmin
      .from('sesiones_operativas')
      .select('id_sesion, identificador_unidad, tipo_transporte')
      .eq('rut_conductor', rutLimpio)
      .is('fecha_cierre', null)
      .maybeSingle();

    if (activeAsConductor) {
      const unidad = activeAsConductor.identificador_unidad ?? activeAsConductor.tipo_transporte;
      res.status(409).json({
        error: `El funcionario ${usuario.nombre_completo} ya tiene un turno activo en el móvil ${unidad}.`,
        code: 'COMPANION_ALREADY_ACTIVE',
      } as any);
      return;
    }

    // 3. Verificar que no esté en tripulacion de otra sesion activa
    const { data: activeCrewMember } = await supabaseAdmin
      .from('tripulacion_sesion')
      .select('id_tripulacion, id_sesion, sesiones_operativas!inner(id_sesion, identificador_unidad, fecha_cierre)')
      .eq('rut_acompanante', rutLimpio)
      .is('sesiones_operativas.fecha_cierre', null)
      .maybeSingle();

    if (activeCrewMember) {
      res.status(409).json({
        error: `El funcionario ${usuario.nombre_completo} ya está operando en otra patrulla activa.`,
        code: 'COMPANION_ALREADY_IN_CREW',
      } as any);
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('tripulacion_sesion')
      .insert({ id_sesion: patrol_id, rut_acompanante: rutLimpio })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      message: 'Miembro agregado a la dotación',
      data,
      funcionario: {
        rut_usuario: usuario.rut_usuario,
        nombre_completo: usuario.nombre_completo,
        grado_cargo: usuario.grado_cargo,
      },
    } as any);
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/v1/patrol/crew/:rut  — Eliminar miembro de la tripulación ───
export async function removeCrewMember(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { patrol_id } = req.tacticalUser!;
  const { rut } = req.params;

  try {
    const rutLimpio = decodeURIComponent(rut).trim();
    console.log(`[CREW REMOVE] Desvinculando compañero ${rutLimpio} de sesión operativa ${patrol_id}`);

    const { error, count } = await supabaseAdmin
      .from('tripulacion_sesion')
      .delete({ count: 'exact' })
      .eq('id_sesion', patrol_id)
      .eq('rut_acompanante', rutLimpio);

    if (error) {
      console.error('[CREW REMOVE ERROR]:', error);
      res.status(500).json({ error: 'Error al eliminar acompañante de la sesión.', code: 'DELETE_ERROR' } as any);
      return;
    }

    console.log(`[CREW REMOVE SUCCESS] Filas eliminadas: ${count}`);
    res.json({ message: 'Compañero eliminado de la dotación correctamente', rut: rutLimpio });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/patrol/crew  — Obtener tripulación actual ───────────────────
export async function getCrew(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { patrol_id } = req.tacticalUser!;

  try {
    const { data, error } = await supabaseAdmin
      .from('tripulacion_sesion')
      .select('id_tripulacion, rut_acompanante, usuarios(nombre_completo, grado_cargo)')
      .eq('id_sesion', patrol_id);

    if (error) {
      console.error('[GET CREW ERROR]:', error);
      throw error;
    }

    res.json({ patrol_id, tripulacion: data ?? [] });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/v1/patrol/telemetry  — Enviar posición GPS ────────────────────
export async function updateTelemetry(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { patrol_id } = req.tacticalUser!;
  const { latitude, longitude } = req.body;

  try {
    await supabaseAdmin.from('telemetria_activa').insert({
      id_sesion: patrol_id,
      geom_actual: `SRID=4326;POINT(${longitude} ${latitude})`,
      timestamp_gps: new Date().toISOString(),
    });

    res.json({ message: 'Telemetría registrada', patrol_id, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}
