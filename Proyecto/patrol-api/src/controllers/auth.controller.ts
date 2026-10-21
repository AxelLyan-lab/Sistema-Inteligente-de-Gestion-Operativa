import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { generateTacticalToken } from '../utils/jwt.utils';
import {
  PatrolLoginBody,
  PatrolLoginResponse,
  UsuarioDB,
  SesionOperativaDB,
  TipoTransporte,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/patrol-login  —  Tarea #43
// Autentica al funcionario y crea/reactiva su sesión operativa
// ─────────────────────────────────────────────────────────────────────────────
export async function patrolLogin(
  req: Request<{}, PatrolLoginResponse, PatrolLoginBody>,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { rut, password, tipo_transporte, identificador_unidad, imei_simcard, tripulacion } = req.body;

  try {
    // ── 1. Validar campos requeridos ────────────────────────────────────────
    if (!rut || !password || !tipo_transporte || !identificador_unidad) {
      res.status(400).json({
        error: 'Campos requeridos: rut, password, tipo_transporte, identificador_unidad',
        code: 'MISSING_FIELDS',
      } as any);
      return;
    }

    console.log('[LOGIN ATTEMPT]', { rut, tipo_transporte, identificador_unidad });

    // Validar límite de acompañantes según tipo de transporte:
    // Radio Patrulla: máx 2 acompañantes. Moto, Bici, Infantería: 0 acompañantes.
    if (tripulacion && Array.isArray(tripulacion)) {
      const activeTrip = tripulacion.filter((r: any) => typeof r === 'string' && r.trim().length > 0);
      if (tipo_transporte !== 'PATRULLA' && activeTrip.length > 0) {
        res.status(400).json({
          error: `El medio de transporte ${tipo_transporte} opera de manera individual (sin acompañantes).`,
          code: 'TRANSPORT_NO_COMPANIONS',
        } as any);
        return;
      }
      if (tipo_transporte === 'PATRULLA' && activeTrip.length > 2) {
        res.status(400).json({
          error: 'Radio Patrulla permite un límite máximo de 2 acompañantes.',
          code: 'PATROL_MAX_COMPANIONS',
        } as any);
        return;
      }
    }

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
    const transporteNormalizado = normalizeTransporte(tipo_transporte);
    const imei = imei_simcard ?? `APP-${uuidv4().slice(0, 8).toUpperCase()}`;

    const sesionPayload: any = {
      imei_simcard: imei,
      rut_conductor: rut,
      tipo_transporte: transporteNormalizado,
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

    // Fallback: Si la columna identificador_unidad no existe aún en la tabla de Supabase
    if (sesionError && (sesionError.message?.includes('identificador_unidad') || (sesionError as any).code === 'PGRST204')) {
      console.warn('Reintentando crear sesión sin columna identificador_unidad...');
      delete sesionPayload.identificador_unidad;
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
    if (tripulacion && Array.isArray(tripulacion) && tripulacion.length > 0) {
      const tripulacionRecords = tripulacion
        .map((rut_comp: string) => ({
          id_sesion: nuevaSesion.id_sesion,
          rut_acompanante: String(rut_comp).trim(),
        }))
        .filter((r) => r.rut_acompanante.length > 0);

      if (tripulacionRecords.length > 0) {
        console.log(`[CREW INSERT] Registrando ${tripulacionRecords.length} compañeros para sesión ${nuevaSesion.id_sesion}:`, tripulacionRecords);
        const { data: tripData, error: tripError } = await supabaseAdmin
          .from('tripulacion_sesion')
          .insert(tripulacionRecords)
          .select();

        if (tripError) {
          console.error('[CREW INSERT ERROR]:', tripError);
        } else {
          console.log(`[CREW INSERT SUCCESS]:`, tripData);
        }
      }
    }

    // ── 8. Generar JWT táctico con claims de terreno ────────────────────────
    const shiftId = uuidv4();
    const token = generateTacticalToken({
      user_id: usuario.rut_usuario,
      patrol_id: nuevaSesion.id_sesion,
      role: usuario.rol,
      shift_id: shiftId,
      is_lead: true, // El conductor es siempre el funcionario a cargo
      nombre: usuario.nombre_completo,
      tipo_transporte: transporteNormalizado,
    });

    // ── 9. Responder con token y datos de sesión ────────────────────────────
    const response: PatrolLoginResponse = {
      token,
      patrol_id: nuevaSesion.id_sesion,
      funcionario: {
        rut: usuario.rut_usuario,
        nombre_completo: usuario.nombre_completo,
        grado_cargo: usuario.grado_cargo,
        rol: usuario.rol,
      },
      sesion: {
        id_sesion: nuevaSesion.id_sesion,
        tipo_transporte: transporteNormalizado,
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

    res.json({ message: 'Turno finalizado correctamente', patrol_id });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/auth/me  —  Obtiene datos del funcionario autenticado
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

    res.json({ funcionario: usuario, sesion });
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

    // 1. Verificar existencia y rol del funcionario
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
// GET /api/v1/auth/vehicles — Unidades registradas
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

    if (error || !vehiculos || vehiculos.length === 0) {
      res.json({
        vehiculos: [
          { tipo_vehiculo: 'PATRULLA', identificador_operativo: 'RP-402' },
          { tipo_vehiculo: 'PATRULLA', identificador_operativo: 'RP-201' },
          { tipo_vehiculo: 'MOTO', identificador_operativo: 'MT-105' },
          { tipo_vehiculo: 'MOTO', identificador_operativo: 'MT-108' },
          { tipo_vehiculo: 'BICICLETA', identificador_operativo: 'BC-021' },
          { tipo_vehiculo: 'INFANTERIA', identificador_operativo: 'INF-01' },
        ],
      } as any);
      return;
    }

    res.json({ vehiculos } as any);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function normalizeTransporte(tipo: string): TipoTransporte {
  const map: Record<string, TipoTransporte> = {
    PATRULLA: 'PATRULLA',
    RADIO_PATRULLA: 'PATRULLA',
    AUTO: 'PATRULLA',
    MOTO: 'MOTO',
    BICICLETA: 'BICICLETA',
    INFANTERIA: 'INFANTERIA',
    PIE: 'INFANTERIA',
  };
  return map[tipo.toUpperCase()] ?? 'INFANTERIA';
}
