import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { generateTacticalToken } from '../utils/jwt.utils';
import { validarYCalcularUve, CONFIG_MEDIOS_UVE } from '../utils/uve.utils';
import { memorySesionesUve } from './uve.controller';
import {
  PatrolLoginBody,
  PatrolLoginResponse,
  UsuarioDB,
  SesionOperativaDB,
  TipoTransporte,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/patrol-login  —  Tarea #43 + U.V.E. y Furgón Z
// Autentica al funcionario, valida dotación U.V.E. y crea su sesión operativa
// ─────────────────────────────────────────────────────────────────────────────
export async function patrolLogin(
  req: Request<{}, PatrolLoginResponse, PatrolLoginBody>,
  res: Response,
  next: NextFunction
): Promise<void> {
  const {
    rut,
    password,
    tipo_transporte,
    tipo_medio,
    identificador_unidad,
    imei_simcard,
    tripulacion,
  } = req.body;

  try {
    const medioInput = (tipo_medio ?? tipo_transporte ?? '').toString().trim();

    // ── 1. Validar campos requeridos ────────────────────────────────────────
    if (!rut || !password || !medioInput || !identificador_unidad) {
      res.status(400).json({
        error: 'Campos requeridos: rut, password, tipo_transporte/tipo_medio, identificador_unidad',
        code: 'MISSING_FIELDS',
      } as any);
      return;
    }

    const activeTrip = Array.isArray(tripulacion)
      ? tripulacion.filter((r: any) => typeof r === 'string' && r.trim().length > 0).map(r => r.trim())
      : [];

    // Validar reglas de tripulación y calcular U.V.E.
    // Furgón Z (FZ / FURGON_Z) exige estrictamente mínimo 1 acompañante (2 tripulantes).
    const esModoEstricto =
      medioInput.toUpperCase() === 'FZ' ||
      medioInput.toUpperCase() === 'FURGON_Z' ||
      medioInput.toUpperCase() === 'RPT' ||
      medioInput.toUpperCase() === 'RPD';

    const validacionUve = validarYCalcularUve(medioInput, activeTrip.length, esModoEstricto);
    if (!validacionUve.valid) {
      res.status(400).json({
        error: validacionUve.error,
        code: validacionUve.code ?? 'INVALID_CREW_RULES',
        regla_uve: CONFIG_MEDIOS_UVE[validacionUve.tipo_medio],
      } as any);
      return;
    }

    console.log('[LOGIN ATTEMPT]', {
      rut,
      tipo_medio: validacionUve.tipo_medio,
      valor_uve: validacionUve.valor_uve,
      identificador_unidad,
      acompanantes: activeTrip.length,
    });

    // ── 2. Buscar funcionario en base de datos ──────────────────────────────
    const { data: usuario, error: userError } = await supabaseAdmin
      .from('usuarios')
      .select('rut_usuario, password_hash, rol, nombre_completo, grado_cargo')
      .eq('rut_usuario', rut.trim())
      .single<UsuarioDB>();

    if (userError || !usuario) {
      console.error('[LOGIN ERROR] User lookup failed for RUT:', rut, 'Error:', userError);
      res.status(401).json({ error: 'Credenciales inválidas', code: 'INVALID_CREDENTIALS' } as any);
      return;
    }

    // ── 3. Verificar contraseña con bcrypt o texto plano (fallback seguro) ──
    const passwordValid =
      password.trim() === usuario.password_hash ||
      (await bcrypt.compare(password.trim(), usuario.password_hash).catch(() => false));

    if (!passwordValid) {
      console.error('[LOGIN ERROR] Password invalid for RUT:', rut);
      res.status(401).json({ error: 'Credenciales inválidas', code: 'INVALID_CREDENTIALS' } as any);
      return;
    }

    // ── 4. Verificar que el rol permite acceso móvil (Exclusivo funcionarios) ──
    if (usuario.rol !== 'FUNCIONARIO_MOVIL') {
      res.status(403).json({
        error: 'Acceso denegado. Este acceso es exclusivo para funcionarios en terreno.',
        code: 'WRONG_ROLE',
      } as any);
      return;
    }

    // ── 5. Cerrar sesiones activas anteriores del mismo funcionario ─────────
    await supabaseAdmin
      .from('sesiones_operativas')
      .update({ estado_operativo: 'INACTIVO', fecha_cierre: new Date().toISOString() })
      .eq('rut_conductor', rut)
      .is('fecha_cierre', null);

    // ── 6. Crear nueva sesión operativa ─────────────────────────────────────
    const transporteCompatible = normalizeTransporteDb(validacionUve.transporte_base);
    const imei = imei_simcard ?? `APP-${uuidv4().slice(0, 8).toUpperCase()}`;
    const sesionPatrullajeUuid = uuidv4();

    const sesionPayload: any = {
      imei_simcard: imei,
      rut_conductor: rut,
      tipo_transporte: transporteCompatible,
      tipo_medio: validacionUve.tipo_medio,
      valor_uve: validacionUve.valor_uve,
      sesion_patrullaje_id: sesionPatrullajeUuid,
      estado_operativo: 'DISPONIBLE',
      fecha_inicio: new Date().toISOString(),
    };

    if (identificador_unidad) {
      sesionPayload.identificador_unidad = identificador_unidad.trim().toUpperCase();
    }

    let { data: nuevaSesion, error: sesionError } = await supabaseAdmin
      .from('sesiones_operativas')
      .insert(sesionPayload)
      .select()
      .single<SesionOperativaDB>();

    // Fallback si las columnas nuevas (tipo_medio, valor_uve, sesion_patrullaje_id) aún no han sido migradas en Supabase
    if (sesionError) {
      console.warn('Reintentando crear sesión con columnas base compatibles...', sesionError.message);
      delete sesionPayload.tipo_medio;
      delete sesionPayload.valor_uve;
      delete sesionPayload.sesion_patrullaje_id;
      if (sesionPayload.tipo_transporte === 'FURGON_Z') {
        sesionPayload.tipo_transporte = 'PATRULLA';
      }
      const retry = await supabaseAdmin
        .from('sesiones_operativas')
        .insert(sesionPayload)
        .select()
        .single<SesionOperativaDB>();
      nuevaSesion = retry.data;
      sesionError = retry.error;
    }

    if (sesionError || !nuevaSesion) {
      console.error('Error creando sesión:', sesionError);
      res.status(500).json({ error: 'Error al crear sesión operativa', code: 'SESSION_ERROR' } as any);
      return;
    }

    // ── 7. Registrar tripulación si aplica ──────────────────────────────────
    if (activeTrip.length > 0) {
      const tripulacionRecords = activeTrip.map((rut_comp: string) => ({
        id_sesion: nuevaSesion!.id_sesion,
        rut_acompanante: rut_comp,
      }));

      const { error: tripError } = await supabaseAdmin
        .from('tripulacion_sesion')
        .insert(tripulacionRecords);

      if (tripError) {
        console.error('[CREW INSERT ERROR]:', tripError);
      }
    }

    // ── 7b. Registrar sesión en sesiones_patrullaje (PostGIS + U.V.E.) y en memoria ──
    const nowIso = new Date().toISOString();
    memorySesionesUve.set(String(nuevaSesion.id_sesion), {
      id: sesionPatrullajeUuid,
      id_sesion_operativa: nuevaSesion.id_sesion,
      lider_id: usuario.rut_usuario,
      acompanante_1_id: activeTrip[0] ?? null,
      acompanante_2_id: activeTrip[1] ?? null,
      identificador_unidad: nuevaSesion.identificador_unidad,
      tipo_medio: validacionUve.tipo_medio,
      valor_uve: validacionUve.valor_uve,
      estado: 'PATRULLANDO',
      ubicacion_actual: null,
      created_at: nowIso,
      updated_at: nowIso,
    });

    try {
      await supabaseAdmin.from('sesiones_patrullaje').insert({
        id: sesionPatrullajeUuid,
        id_sesion_operativa: nuevaSesion.id_sesion,
        lider_rut: usuario.rut_usuario,
        acompanante_1_rut: activeTrip[0] ?? null,
        acompanante_2_rut: activeTrip[1] ?? null,
        identificador_unidad: nuevaSesion.identificador_unidad,
        tipo_medio: validacionUve.tipo_medio,
        valor_uve: validacionUve.valor_uve,
        estado: 'PATRULLANDO',
      });
    } catch { }

    // ── 8. Generar JWT táctico con claims de terreno y U.V.E. ───────────────
    const shiftId = uuidv4();
    const token = generateTacticalToken({
      user_id: usuario.rut_usuario,
      patrol_id: nuevaSesion.id_sesion,
      sesion_patrullaje_id: sesionPatrullajeUuid,
      role: usuario.rol,
      shift_id: shiftId,
      is_lead: true,
      nombre: usuario.nombre_completo,
      tipo_transporte: validacionUve.transporte_base,
      tipo_medio: validacionUve.tipo_medio,
      valor_uve: validacionUve.valor_uve,
    });

    // ── 9. Responder con token, sesión y U.V.E. asignada ────────────────────
    const response: PatrolLoginResponse = {
      token,
      patrol_id: nuevaSesion.id_sesion,
      sesion_patrullaje_id: sesionPatrullajeUuid,
      funcionario: {
        rut: usuario.rut_usuario,
        nombre_completo: usuario.nombre_completo,
        grado_cargo: usuario.grado_cargo,
        rol: usuario.rol,
      },
      sesion: {
        id_sesion: nuevaSesion.id_sesion,
        sesion_patrullaje_id: sesionPatrullajeUuid,
        tipo_transporte: validacionUve.transporte_base,
        tipo_medio: validacionUve.tipo_medio,
        valor_uve: Number(validacionUve.valor_uve.toFixed(2)),
        identificador_unidad: nuevaSesion.identificador_unidad,
        estado_operativo: nuevaSesion.estado_operativo,
        fecha_inicio: nuevaSesion.fecha_inicio,
      },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/logout  —  Cierra la sesión operativa activa
// ─────────────────────────────────────────────────────────────────────────────
export async function patrolLogout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { patrol_id } = req.tacticalUser!;

  try {
    await supabaseAdmin
      .from('sesiones_operativas')
      .update({ estado_operativo: 'INACTIVO', fecha_cierre: new Date().toISOString() })
      .eq('id_sesion', patrol_id);

    memorySesionesUve.delete(String(patrol_id));
    try {
      await supabaseAdmin
        .from('sesiones_patrullaje')
        .update({ activa: false, updated_at: new Date().toISOString() })
        .eq('id_sesion_operativa', patrol_id);
    } catch { }

    res.json({ message: 'Turno finalizado correctamente', patrol_id });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/auth/me  —  Obtiene datos del funcionario autenticado y su U.V.E.
// ─────────────────────────────────────────────────────────────────────────────
export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { user_id, patrol_id } = req.tacticalUser!;

  try {
    const [{ data: usuario }, { data: sesion, error: sesionError }] = await Promise.all([
      supabaseAdmin
        .from('usuarios')
        .select('rut_usuario, nombre_completo, rol, grado_cargo')
        .eq('rut_usuario', user_id)
        .single(),
      supabaseAdmin
        .from('sesiones_operativas')
        .select('*, tripulacion_sesion(rut_acompanante, usuarios(nombre_completo))')
        .eq('id_sesion', patrol_id)
        .single(),
    ]);

    if (sesionError || !sesion) {
      res.status(404).json({ error: 'Sesión no encontrada', code: 'SESSION_NOT_FOUND' } as any);
      return;
    }

    if (sesion.fecha_cierre) {
      await supabaseAdmin
        .from('sesiones_operativas')
        .update({
          fecha_cierre: null,
          estado_operativo: sesion.estado_operativo === 'INACTIVO' ? 'DISPONIBLE' : sesion.estado_operativo,
        })
        .eq('id_sesion', patrol_id);
      sesion.fecha_cierre = null;
      if (sesion.estado_operativo === 'INACTIVO') {
        sesion.estado_operativo = 'DISPONIBLE';
      }
    }

    const memUve = memorySesionesUve.get(String(patrol_id));
    const numComp = Array.isArray(sesion.tripulacion_sesion) ? sesion.tripulacion_sesion.length : 0;
    const esFurgon = (sesion.identificador_unidad || '').startsWith('FZ') || sesion.tipo_transporte === 'FURGON_Z' || memUve?.tipo_medio === 'FZ';
    const baseTipo = esFurgon ? 'FZ' : (sesion.tipo_medio || memUve?.tipo_medio || sesion.tipo_transporte || 'PATRULLA');
    const calcUve = validarYCalcularUve(baseTipo, numComp, false);

    res.json({
      funcionario: usuario,
      sesion: {
        ...sesion,
        tipo_transporte: esFurgon ? 'FURGON_Z' : sesion.tipo_transporte,
        tipo_medio: calcUve.tipo_medio,
        valor_uve: Number(calcUve.valor_uve.toFixed(2)),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/verify-credentials  — Valida identidad del funcionario
// ─────────────────────────────────────────────────────────────────────────────
export async function verifyCredentials(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { rut, password } = req.body;

  try {
    if (!rut || !password) {
      res.status(400).json({ error: 'RUT y contraseña requeridos', code: 'MISSING_FIELDS' } as any);
      return;
    }

    const { data: usuario, error: userError } = await supabaseAdmin
      .from('usuarios')
      .select('rut_usuario, password_hash, rol, nombre_completo, grado_cargo, activo')
      .eq('rut_usuario', rut.trim())
      .single<UsuarioDB>();

    if (userError || !usuario) {
      res.status(401).json({ error: 'Credenciales inválidas', code: 'INVALID_CREDENTIALS' } as any);
      return;
    }

    const passwordValid =
      password.trim() === usuario.password_hash ||
      (await bcrypt.compare(password.trim(), usuario.password_hash).catch(() => false));

    if (!passwordValid) {
      res.status(401).json({ error: 'Credenciales inválidas', code: 'INVALID_CREDENTIALS' } as any);
      return;
    }

    if (usuario.rol !== 'FUNCIONARIO_MOVIL') {
      res.status(403).json({
        error: 'Acceso denegado. Este acceso es exclusivo para funcionarios en terreno. Los supervisores deben acceder al Dashboard Web.',
        code: 'WRONG_ROLE',
      } as any);
      return;
    }

    res.json({
      valid: true,
      funcionario: {
        rut_usuario: usuario.rut_usuario,
        nombre_completo: usuario.nombre_completo,
        grado_cargo: usuario.grado_cargo ?? 'Oficial en Terreno',
        rol: usuario.rol,
      },
    } as any);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/validate-companion — Verifica disponibilidad de compañero
// ─────────────────────────────────────────────────────────────────────────────
export async function validateCompanionEndpoint(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { rut_acompanante, rut_conductor } = req.body;

  try {
    if (!rut_acompanante || !rut_acompanante.trim()) {
      res.status(400).json({ error: 'RUT de acompañante es requerido', code: 'MISSING_RUT' } as any);
      return;
    }

    const rutLimpio = rut_acompanante.trim();

    if (rut_conductor && rutLimpio === rut_conductor.trim()) {
      res.status(400).json({
        error: 'No puedes asignarte a ti mismo como acompañante.',
        code: 'SELF_COMPANION',
      } as any);
      return;
    }

    const { data: usuario, error: userError } = await supabaseAdmin
      .from('usuarios')
      .select('rut_usuario, nombre_completo, grado_cargo, rol, activo')
      .eq('rut_usuario', rutLimpio)
      .maybeSingle<UsuarioDB>();

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

    const { data: activeCrewMember } = await supabaseAdmin
      .from('tripulacion_sesion')
      .select('id_tripulacion, id_sesion, sesiones_operativas!inner(id_sesion, identificador_unidad, fecha_cierre)')
      .eq('rut_acompanante', rutLimpio)
      .is('sesiones_operativas.fecha_cierre', null)
      .maybeSingle();

    if (activeCrewMember) {
      res.status(409).json({
        error: `El funcionario ${usuario.nombre_completo} ya está operando como tripulante en otra patrulla activa.`,
        code: 'COMPANION_ALREADY_IN_CREW',
      } as any);
      return;
    }

    res.json({
      disponible: true,
      funcionario: {
        rut_usuario: usuario.rut_usuario,
        nombre_completo: usuario.nombre_completo,
        grado_cargo: usuario.grado_cargo ?? 'Oficial en Terreno',
      },
    } as any);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/auth/vehicles — Unidades registradas (incluyendo Furgón Z)
// ─────────────────────────────────────────────────────────────────────────────
export async function getVehicles(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { data: vehiculos, error } = await supabaseAdmin
      .from('vehiculos')
      .select('patente, tipo_vehiculo, identificador_operativo, disponible')
      .order('identificador_operativo');

    const fallbackList = [
      { tipo_vehiculo: 'PATRULLA', identificador_operativo: 'RP-402' },
      { tipo_vehiculo: 'PATRULLA', identificador_operativo: 'RP-201' },
      { tipo_vehiculo: 'FURGON_Z', identificador_operativo: 'FZ-101' },
      { tipo_vehiculo: 'FURGON_Z', identificador_operativo: 'FZ-102' },
      { tipo_vehiculo: 'MOTO', identificador_operativo: 'MT-105' },
      { tipo_vehiculo: 'MOTO', identificador_operativo: 'MT-108' },
      { tipo_vehiculo: 'BICICLETA', identificador_operativo: 'BC-021' },
      { tipo_vehiculo: 'INFANTERIA', identificador_operativo: 'INF-01' },
    ];

    if (error || !vehiculos || vehiculos.length === 0) {
      res.json({ vehiculos: fallbackList } as any);
      return;
    }

    const tieneFurgon = vehiculos.some((v: any) => v.tipo_vehiculo === 'FURGON_Z' || v.tipo_vehiculo === 'FZ');
    const listaFinal = tieneFurgon
      ? vehiculos
      : [
        ...vehiculos,
        { tipo_vehiculo: 'FURGON_Z', identificador_operativo: 'FZ-101', disponible: true },
        { tipo_vehiculo: 'FURGON_Z', identificador_operativo: 'FZ-102', disponible: true },
      ];

    res.json({ vehiculos: listaFinal } as any);
  } catch (err) {
    next(err);
  }
}

function normalizeTransporteDb(tipo: string): TipoTransporte {
  const map: Record<string, TipoTransporte> = {
    PATRULLA: 'PATRULLA',
    RADIO_PATRULLA: 'PATRULLA',
    RPT: 'PATRULLA',
    RPD: 'PATRULLA',
    AUTO: 'PATRULLA',
    FURGON_Z: 'FURGON_Z',
    FZ: 'FURGON_Z',
    MOTO: 'MOTO',
    MTT: 'MOTO',
    BICICLETA: 'BICICLETA',
    CB: 'BICICLETA',
    INFANTERIA: 'INFANTERIA',
    INF: 'INFANTERIA',
    PIE: 'INFANTERIA',
  };
  return map[tipo.toUpperCase()] ?? 'INFANTERIA';
}
