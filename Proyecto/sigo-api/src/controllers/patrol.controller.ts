import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { validarYCalcularUve, calcularDistanciaMetros, calcularEtaPatrulla } from '../utils/uve.utils';
import { evaluarGeocercaZonasRiesgo, memorySesionesUve, memoryHistorialDespachosRefuerzo } from './uve.controller';

// ── POST /api/v1/patrol/sos  — Solicitud de refuerzos con demanda U.V.E. ────
export async function requestReinforcements(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { patrol_id, user_id } = req.tacticalUser!;
  const { latitude, longitude, uve_requerida } = req.body;

  try {
    if (!latitude || !longitude) {
      res.status(400).json({ error: 'Coordenadas GPS requeridas', code: 'NO_COORDS' } as any);
      return;
    }

    const uveReq = uve_requerida != null ? Number(uve_requerida) : 1.00;

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

    const mem = memorySesionesUve.get(String(patrol_id));
    if (mem) {
      mem.estado = 'SOLICITANDO_REFUERZO';
    }

    // Ejecutar algoritmo de selección de refuerzos por U.V.E. y menor ETA
    const unidadesAsignadas: any[] = [];
    let uveAcumulada = 0;

    try {
      const [{ data: sesionesActivas }, { data: posiciones }] = await Promise.all([
        supabaseAdmin
          .from('sesiones_operativas')
          .select('id_sesion, identificador_unidad, tipo_transporte, tipo_medio, valor_uve, estado_operativo, rut_conductor, tripulacion:tripulacion_sesion(rut_acompanante)')
          .is('fecha_cierre', null)
          .in('estado_operativo', ['DISPONIBLE', 'PATRULLANDO_ZONA', 'EN_RUTA_HOTSPOT'])
          .neq('id_sesion', patrol_id),
        supabaseAdmin
          .from('v_posicion_actual_unidades')
          .select('id_sesion, latitud, longitud'),
      ]);

      const posMap = new Map<number, { lat: number; lng: number }>();
      for (const p of posiciones ?? []) {
        posMap.set(Number(p.id_sesion), { lat: Number(p.latitud), lng: Number(p.longitud) });
      }

      const candidatos = (sesionesActivas ?? []).map((s: any) => {
        const numComp = Array.isArray(s.tripulacion) ? s.tripulacion.length : 0;
        const esFz = (s.identificador_unidad || '').startsWith('FZ') || s.tipo_transporte === 'FURGON_Z';
        const calc = validarYCalcularUve(esFz ? 'FZ' : (s.tipo_medio || s.tipo_transporte || 'PATRULLA'), numComp, false);
        const pos = posMap.get(s.id_sesion) ?? { lat: -33.0205, lng: -71.5495 };
        const distancia_m = calcularDistanciaMetros(Number(latitude), Number(longitude), pos.lat, pos.lng);
        const { eta_segundos, eta_minutos } = calcularEtaPatrulla(distancia_m, calc.tipo_medio);

        return {
          id_sesion: s.id_sesion,
          identificador_unidad: s.identificador_unidad || `${calc.tipo_medio}-${s.id_sesion}`,
          tipo_medio: calc.tipo_medio,
          valor_uve: Number(s.valor_uve ?? calc.valor_uve),
          distancia_m,
          distancia_km: Math.round((distancia_m / 1000) * 100) / 100,
          eta_segundos,
          eta_minutos,
        };
      });

      candidatos.sort((a, b) => a.eta_segundos - b.eta_segundos);

      for (const c of candidatos) {
        if (uveAcumulada >= uveReq) break;
        unidadesAsignadas.push({ ...c, estado: 'EN_REFUERZO' });
        uveAcumulada = Math.round((uveAcumulada + c.valor_uve) * 100) / 100;
      }

      if (unidadesAsignadas.length > 0) {
        memoryHistorialDespachosRefuerzo.unshift({
          id_despacho: `sos-${alerta.id_emergencia}`,
          patrulla_origen_id: patrol_id,
          identificador_origen: `Móvil #${patrol_id}`,
          uve_requerida: uveReq,
          uve_acumulada: uveAcumulada,
          coordenadas_emergencia: { latitude: Number(latitude), longitude: Number(longitude) },
          unidades_asignadas: unidadesAsignadas,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (dispErr) {
      console.warn('[SOS UVE DISPATCH] Error calculando candidatos:', dispErr);
    }

    res.status(201).json({
      message: `🚨 Alerta de refuerzos enviada (+${uveReq.toFixed(1)} U.V.E.)`,
      alerta_id: alerta.id_emergencia,
      patrol_id,
      rut_solicitante: user_id,
      uve_requerida: Number(uveReq.toFixed(2)),
      uve_acumulada: Number(uveAcumulada.toFixed(2)),
      unidades_asignadas: unidadesAsignadas,
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
      .select('id_sesion, tipo_transporte, identificador_unidad')
      .eq('id_sesion', patrol_id)
      .maybeSingle();

    const memUve = memorySesionesUve.get(String(patrol_id));
    const esFurgon =
      (sesionActual?.identificador_unidad || '').startsWith('FZ') ||
      sesionActual?.tipo_transporte === 'FURGON_Z' ||
      memUve?.tipo_medio === 'FZ';
    const tipoEfectivo = esFurgon ? 'FURGON_Z' : (sesionActual?.tipo_transporte ?? 'PATRULLA');

    if (tipoEfectivo === 'MOTO' || tipoEfectivo === 'MTT') {
      res.status(400).json({
        error: 'Moto Todo Terreno (MTT) opera de forma individual (sin acompañantes).',
        code: 'TRANSPORT_NO_COMPANIONS',
      } as any);
      return;
    }

    const { count: crewCount } = await supabaseAdmin
      .from('tripulacion_sesion')
      .select('*', { count: 'exact', head: true })
      .eq('id_sesion', patrol_id);

    const maxPermitidos = (tipoEfectivo === 'PATRULLA' || tipoEfectivo === 'FURGON_Z') ? 2 : 1;
    if ((crewCount ?? 0) >= maxPermitidos) {
      res.status(400).json({
        error: `Este medio ya cuenta con el límite máximo de ${maxPermitidos} acompañante(s).`,
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

    // Recalcular U.V.E. dinámica tras agregar acompañante
    const nuevoCount = (crewCount ?? 0) + 1;
    const calcUve = validarYCalcularUve(esFurgon ? 'FZ' : tipoEfectivo, nuevoCount, false);
    if (memUve) {
      memUve.tipo_medio = calcUve.tipo_medio;
      memUve.valor_uve = calcUve.valor_uve;
      if (!memUve.acompanante_1_id) memUve.acompanante_1_id = rutLimpio;
      else memUve.acompanante_2_id = rutLimpio;
    }
    try {
      await supabaseAdmin
        .from('sesiones_operativas')
        .update({ tipo_medio: calcUve.tipo_medio, valor_uve: calcUve.valor_uve })
        .eq('id_sesion', patrol_id);
    } catch { }

    res.status(201).json({
      message: 'Miembro agregado a la dotación',
      data,
      tipo_medio: calcUve.tipo_medio,
      valor_uve: calcUve.valor_uve,
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

    // Verificar regla de negocio Furgón Z: mínimo obligatorio 2 tripulantes (Líder + 1 acompañante)
    const { data: sesionActual } = await supabaseAdmin
      .from('sesiones_operativas')
      .select('id_sesion, tipo_transporte, identificador_unidad')
      .eq('id_sesion', patrol_id)
      .maybeSingle();

    const { count: crewCount } = await supabaseAdmin
      .from('tripulacion_sesion')
      .select('*', { count: 'exact', head: true })
      .eq('id_sesion', patrol_id);

    const memUve = memorySesionesUve.get(String(patrol_id));
    const esFurgon =
      (sesionActual?.identificador_unidad || '').startsWith('FZ') ||
      sesionActual?.tipo_transporte === 'FURGON_Z' ||
      memUve?.tipo_medio === 'FZ';

    if (esFurgon && (crewCount ?? 0) <= 1) {
      res.status(400).json({
        error: 'Furgón Z (FZ) exige un MÍNIMO obligatorio de 2 tripulantes (Líder + 1 acompañante). No se puede desvincular al único acompañante.',
        code: 'FZ_MIN_CREW_REQUIRED',
      } as any);
      return;
    }

    const { error } = await supabaseAdmin
      .from('tripulacion_sesion')
      .delete({ count: 'exact' })
      .eq('id_sesion', patrol_id)
      .eq('rut_acompanante', rutLimpio);

    if (error) {
      console.error('[CREW REMOVE ERROR]:', error);
      res.status(500).json({ error: 'Error al eliminar acompañante de la sesión.', code: 'DELETE_ERROR' } as any);
      return;
    }

    const nuevoCount = Math.max(0, (crewCount ?? 1) - 1);
    const calcUve = validarYCalcularUve(
      esFurgon ? 'FZ' : (sesionActual?.tipo_transporte ?? 'PATRULLA'),
      nuevoCount,
      false
    );

    if (memUve) {
      memUve.tipo_medio = calcUve.tipo_medio;
      memUve.valor_uve = calcUve.valor_uve;
    }
    try {
      await supabaseAdmin
        .from('sesiones_operativas')
        .update({ tipo_medio: calcUve.tipo_medio, valor_uve: calcUve.valor_uve })
        .eq('id_sesion', patrol_id);
    } catch { }

    res.json({
      message: 'Compañero eliminado de la dotación correctamente',
      rut: rutLimpio,
      tipo_medio: calcUve.tipo_medio,
      valor_uve: calcUve.valor_uve,
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/patrol/crew  — Obtener tripulación actual y U.V.E. ──────────
export async function getCrew(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { patrol_id } = req.tacticalUser!;

  try {
    const [{ data, error }, { data: sesionActual }] = await Promise.all([
      supabaseAdmin
        .from('tripulacion_sesion')
        .select('id_tripulacion, rut_acompanante, usuarios(nombre_completo, grado_cargo)')
        .eq('id_sesion', patrol_id),
      supabaseAdmin
        .from('sesiones_operativas')
        .select('tipo_transporte, identificador_unidad')
        .eq('id_sesion', patrol_id)
        .maybeSingle(),
    ]);

    if (error) {
      console.error('[GET CREW ERROR]:', error);
      throw error;
    }

    const tripulacion = data ?? [];
    const memUve = memorySesionesUve.get(String(patrol_id));
    const esFurgon =
      (sesionActual?.identificador_unidad || '').startsWith('FZ') ||
      sesionActual?.tipo_transporte === 'FURGON_Z' ||
      memUve?.tipo_medio === 'FZ';
    const calcUve = validarYCalcularUve(
      esFurgon ? 'FZ' : (sesionActual?.tipo_transporte ?? 'PATRULLA'),
      tripulacion.length,
      false
    );

    res.json({
      patrol_id,
      tripulacion,
      tipo_medio: calcUve.tipo_medio,
      valor_uve: calcUve.valor_uve,
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/v1/patrol/telemetry  — Ingestar ping GNSS + ST_Contains ────────
export async function updateTelemetry(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { patrol_id, sesion_patrullaje_id } = req.tacticalUser!;
  const {
    latitude,
    longitude,
    altitude,
    accuracy,
    speed,
    heading,
    timestamp_gps,
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
      id_sesion: patrol_id,
      geom_actual: `SRID=4326;POINT(${longitude} ${latitude})`,
      altitud_m: altitude ?? null,
      precision_m: accuracy ?? null,
      velocidad_kmh,
      rumbo_grados: heading ?? null,
      timestamp_gps: timestamp_gps ?? new Date().toISOString(),
      timestamp_srv: new Date().toISOString(),
    });

    if (error) throw error;

    // Actualizar ubicación en memoria U.V.E.
    const mem = memorySesionesUve.get(String(patrol_id));
    if (mem) {
      mem.ubicacion_actual = { latitude: Number(latitude), longitude: Number(longitude) };
      mem.updated_at = new Date().toISOString();
    }

    // ── Evaluación espacial ST_Contains contra zonas_riesgo (actualizar_telemetria_patrulla) ──
    let geofenceZonaRiesgo: any = null;
    try {
      const evalResult = await evaluarGeocercaZonasRiesgo(
        sesion_patrullaje_id ?? patrol_id,
        Number(latitude),
        Number(longitude)
      );
      if (evalResult.en_zona_riesgo && evalResult.zona) {
        geofenceZonaRiesgo = evalResult.zona;
        if (mem) {
          mem.estado = 'EN_ZONA_RIESGO';
          mem.zona_actual = evalResult.zona;
        }
      } else if (mem && mem.estado === 'EN_ZONA_RIESGO') {
        mem.estado = 'PATRULLANDO';
        mem.zona_actual = null;
      }
    } catch { }

    // ── Detección Automática de Llegada a la Zona Asignada (asignaciones_tacticas) ──
    try {
      const { data: asignacionActiva } = await supabaseAdmin
        .from('asignaciones_tacticas')
        .select('id_asignacion, centro_lat, centro_lng, radio_m, estado_mision, hora_despacho, hora_ingreso_zona, nombre_zona')
        .eq('id_sesion', patrol_id)
        .not('estado_mision', 'in', '("COMPLETADA","CANCELADA")')
        .order('hora_despacho', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (asignacionActiva && asignacionActiva.centro_lat != null && asignacionActiva.centro_lng != null) {
        const distMetros = calcularDistanciaMetros(
          Number(latitude),
          Number(longitude),
          Number(asignacionActiva.centro_lat),
          Number(asignacionActiva.centro_lng)
        );
        const radioCircunferencia = Math.max(20, Number(asignacionActiva.radio_m) || 160);

        if (distMetros <= radioCircunferencia) {
          if (!asignacionActiva.hora_ingreso_zona) {
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

          if (!geofenceZonaRiesgo) {
            geofenceZonaRiesgo = {
              id: String(asignacionActiva.id_asignacion),
              nombre: asignacionActiva.nombre_zona ?? 'Zona Asignada',
              nivel_riesgo: 'ALTO',
              score_gravedad: 85,
              centro_lat: Number(asignacionActiva.centro_lat),
              centro_lng: Number(asignacionActiva.centro_lng),
              radio_m: radioCircunferencia,
            };
          }
        }
      }
    } catch (geofenceErr) {
      console.warn('[AUTOGEOFENCE] Error evaluando geocerca:', geofenceErr);
    }

    res.json({
      ok: true,
      patrol_id,
      en_zona_riesgo: !!geofenceZonaRiesgo,
      zona_riesgo: geofenceZonaRiesgo,
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
