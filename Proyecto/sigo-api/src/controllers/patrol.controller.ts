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

    // 0. Verificar tipo de transporte y límite de dotación
    const { data: sesionActual } = await supabaseAdmin
      .from('sesiones_operativas')
      .select('id_sesion, tipo_transporte')
      .eq('id_sesion', patrol_id)
      .maybeSingle();

    if (sesionActual && sesionActual.tipo_transporte !== 'PATRULLA') {
      res.status(400).json({
        error: `El medio de transporte ${sesionActual.tipo_transporte} opera de forma individual (sin acompañantes).`,
        code: 'TRANSPORT_NO_COMPANIONS',
      } as any);
      return;
    }

    const { count: crewCount } = await supabaseAdmin
      .from('tripulacion_sesion')
      .select('*', { count: 'exact', head: true })
      .eq('id_sesion', patrol_id);

    if ((crewCount ?? 0) >= 2) {
      res.status(400).json({
        error: 'Radio Patrulla ya cuenta con el límite máximo de 2 acompañantes.',
        code: 'CREW_LIMIT_REACHED',
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

// ── POST /api/v1/patrol/telemetry  — Ingestar ping GNSS completo ────────────
export async function updateTelemetry(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { patrol_id } = req.tacticalUser!;
  const {
    latitude,
    longitude,
    altitude,        // metros sobre el nivel del mar
    accuracy,        // precisión horizontal en metros
    speed,           // velocidad en m/s → convertir a km/h
    heading,         // rumbo en grados (0–360)
    timestamp_gps,   // timestamp ISO del fix GNSS en el dispositivo
  } = req.body;

  try {
    if (latitude == null || longitude == null) {
      res.status(400).json({ error: 'latitude y longitude son requeridos', code: 'NO_COORDS' });
      return;
    }

    const velocidad_kmh = speed != null ? Math.round(speed * 3.6 * 10) / 10 : null;

    // Retomar la sesión si fue cerrada automáticamente por inactividad
    const { data: ses } = await supabaseAdmin
      .from('sesiones_operativas')
      .select('fecha_cierre, rut_conductor')
      .eq('id_sesion', patrol_id)
      .maybeSingle();
    if (ses?.fecha_cierre) {
      const { data: otra } = await supabaseAdmin
        .from('sesiones_operativas')
        .select('id_sesion')
        .eq('rut_conductor', ses.rut_conductor)
        .is('fecha_cierre', null)
        .limit(1)
        .maybeSingle();
      if (!otra) {
        const { data: asig } = await supabaseAdmin
          .from('asignaciones_tacticas')
          .select('estado_mision, hora_ingreso_zona')
          .eq('id_sesion', patrol_id)
          .not('estado_mision', 'in', '("COMPLETADA","CANCELADA")')
          .order('hora_despacho', { ascending: false })
          .limit(1)
          .maybeSingle();

        const recoveredEstado = asig?.hora_ingreso_zona || asig?.estado_mision === 'PATRULLANDO'
          ? 'PATRULLANDO_ZONA'
          : asig ? 'EN_RUTA_HOTSPOT' : 'DISPONIBLE';

        await supabaseAdmin
          .from('sesiones_operativas')
          .update({ fecha_cierre: null, estado_operativo: recoveredEstado })
          .eq('id_sesion', patrol_id);
      }
    }

    const { error } = await supabaseAdmin.from('telemetria_activa').insert({
      id_sesion:     patrol_id,
      geom_actual:   `SRID=4326;POINT(${longitude} ${latitude})`,
      altitud_m:     altitude ?? null,
      precision_m:   accuracy ?? null,
      velocidad_kmh,
      rumbo_grados:  heading ?? null,
      timestamp_gps: timestamp_gps ?? new Date().toISOString(),
      timestamp_srv: new Date().toISOString(),
    });

    if (error) throw error;

    // ── Detección Automática de Llegada a la Zona Asignada ──────────────────
    try {
      const { data: asignacionActiva } = await supabaseAdmin
        .from('asignaciones_tacticas')
        .select('id_asignacion, centro_lat, centro_lng, radio_m, estado_mision, hora_despacho, hora_ingreso_zona')
        .eq('id_sesion', patrol_id)
        .is('hora_ingreso_zona', null)
        .not('estado_mision', 'in', '("COMPLETADA","CANCELADA")')
        .order('hora_despacho', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (asignacionActiva && asignacionActiva.centro_lat != null && asignacionActiva.centro_lng != null) {
        // Cálculo de distancia en metros (Haversine)
        const R = 6371e3;
        const φ1 = (latitude * Math.PI) / 180;
        const φ2 = (Number(asignacionActiva.centro_lat) * Math.PI) / 180;
        const Δφ = ((Number(asignacionActiva.centro_lat) - latitude) * Math.PI) / 180;
        const Δλ = ((Number(asignacionActiva.centro_lng) - longitude) * Math.PI) / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distMetros = R * c;

        // Radio exacto de la zona (mínimo 50m) con margen GPS de 20m
        const radioTolerancia = Math.max(Number(asignacionActiva.radio_m) || 50, 50) + 20;

        if (distMetros <= radioTolerancia) {
          console.log(`[AUTOGEOFENCE] Sesión ${patrol_id} ingresó a zona asignada ${asignacionActiva.id_asignacion} (dist: ${Math.round(distMetros)}m <= ${radioTolerancia}m). Transicionando a PATRULLANDO_ZONA.`);
          await supabaseAdmin
            .from('asignaciones_tacticas')
            .update({
              estado_mision: 'PATRULLANDO',
              hora_ingreso_zona: new Date().toISOString(),
            })
            .eq('id_asignacion', asignacionActiva.id_asignacion);

          await supabaseAdmin
            .from('sesiones_operativas')
            .update({ estado_operativo: 'PATRULLANDO_ZONA' })
            .eq('id_sesion', patrol_id);
        }
      }
    } catch (geofenceErr) {
      console.warn('[AUTOGEOFENCE] Error evaluando geocerca:', geofenceErr);
    }

    res.json({
      ok: true,
      patrol_id,
      timestamp_srv: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/patrol/telemetry/status  — Último ping registrado ────────────
export async function getTelemetryStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { patrol_id } = req.tacticalUser!;

  try {
    // Consultamos la vista que extrae lat/lon vía ST_Y / ST_X
    const { data, error } = await supabaseAdmin
      .from('v_posicion_actual_unidades')
      .select('latitud, longitud, altitud_m, precision_m, velocidad_kmh, rumbo_grados, timestamp_gps, timestamp_srv')
      .eq('id_sesion', patrol_id)
      .maybeSingle();

    if (error) throw error;

    res.json({ patrol_id, ultimo_ping: data ?? null });
  } catch (err) {
    next(err);
  }
}
