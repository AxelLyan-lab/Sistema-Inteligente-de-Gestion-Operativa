import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';

/**
 * GET /api/v1/sesiones/activas
 * Retorna todas las sesiones operativas activas con conductor,
 * tripulación y asignación activa joinadas.
 * Usado por el dashboard web supervisor.
 */
export async function getSesionesActivas(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from('sesiones_operativas')
      .select(`
        id_sesion,
        imei_simcard,
        rut_conductor,
        tipo_transporte,
        identificador_unidad,
        estado_operativo,
        fecha_inicio,
        fecha_cierre,
        conductor:usuarios!rut_conductor (
          rut_usuario,
          nombre_completo,
          rol
        ),
        tripulacion:tripulacion_sesion (
          id_tripulacion,
          rut_acompanante,
          acompanante:usuarios!rut_acompanante (
            rut_usuario,
            nombre_completo
          )
        ),
        asignacion_activa:asignaciones_tacticas (
          id_asignacion,
          origen_asignacion,
          estado_mision,
          hora_despacho,
          hora_ingreso_zona,
          hora_liberacion,
          geom_destino
        )
      `)
      .is('fecha_cierre', null)
      .order('fecha_inicio', { ascending: false });

    if (error) throw error;

    // Filtrar: asignación activa = la que no está COMPLETADA/CANCELADA
    const sesiones = (data ?? []).map((s: any) => ({
      ...s,
      asignacion_activa: s.asignacion_activa?.find(
        (a: any) => !['COMPLETADA', 'CANCELADA'].includes(a.estado_mision)
      ) ?? null,
    }));

    res.json(sesiones);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/sesiones/:idSesion
 * Retorna el detalle de una sesión específica.
 */
export async function getSesionDetalle(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const idSesion = parseInt(req.params.idSesion, 10);

  try {
    const { data, error } = await supabaseAdmin
      .from('sesiones_operativas')
      .select(`
        id_sesion,
        imei_simcard,
        rut_conductor,
        tipo_transporte,
        identificador_unidad,
        estado_operativo,
        fecha_inicio,
        fecha_cierre,
        conductor:usuarios!rut_conductor (
          rut_usuario,
          nombre_completo,
          rol
        ),
        tripulacion:tripulacion_sesion (
          id_tripulacion,
          rut_acompanante,
          acompanante:usuarios!rut_acompanante (
            rut_usuario,
            nombre_completo
          )
        )
      `)
      .eq('id_sesion', idSesion)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'Sesión no encontrada', code: 'NOT_FOUND' });
      return;
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
}
