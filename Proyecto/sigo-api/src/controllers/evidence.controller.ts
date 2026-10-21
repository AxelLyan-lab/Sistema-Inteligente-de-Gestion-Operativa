import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
export const uploadMiddleware = upload.single('evidencia');

// ── POST /api/v1/evidence/upload  — Carga de evidencia táctica ──────────────
export async function uploadEvidence(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { patrol_id } = req.tacticalUser!;
  const { descripcion_texto, tipo_evidencia, latitude, longitude } = req.body;
  const file = req.file;

  try {
    let url_fotografia: string | null = null;

    // Subir archivo a Supabase Storage si se adjuntó
    if (file) {
      const fileName = `evidencias/${patrol_id}/${Date.now()}_${file.originalname}`;
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('sigo-evidencias')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (uploadError) {
        console.error('Error subiendo archivo:', uploadError);
      } else {
        const { data: publicUrl } = supabaseAdmin.storage
          .from('sigo-evidencias')
          .getPublicUrl(uploadData.path);
        url_fotografia = publicUrl.publicUrl;
      }
    }

    // Vincular a la misión activa (si existe)
    const { data: asignacion } = await supabaseAdmin
      .from('asignaciones_tacticas')
      .select('id_asignacion')
      .eq('id_sesion', patrol_id)
      .not('estado_mision', 'in', '("COMPLETADA","CANCELADA")')
      .order('hora_despacho', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Registrar evidencia en la base de datos
    const { data, error } = await supabaseAdmin
      .from('registro_evidencias')
      .insert({
        id_sesion: patrol_id,
        id_asignacion: asignacion?.id_asignacion ?? null,
        origen: 'MOVIL',
        subido_por: req.tacticalUser!.nombre,
        tipo_evidencia: tipo_evidencia ?? 'EVIDENCIA_BASICA',
        es_obligatoria: false,
        url_fotografia,
        descripcion_texto: descripcion_texto ?? null,
        fecha_subida: new Date().toISOString(),
        ...(latitude && longitude && {
          geom_evidencia: `SRID=4326;POINT(${longitude} ${latitude})`,
        }),
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ message: 'Evidencia registrada', evidencia: data });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/evidence/list  — Listar evidencias de la sesión ───────────────
export async function listEvidence(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { patrol_id } = req.tacticalUser!;

  try {
    const { data, error } = await supabaseAdmin
      .from('registro_evidencias')
      .select('*')
      .eq('id_sesion', patrol_id)
      .order('fecha_subida', { ascending: false });

    if (error) throw error;

    res.json({ patrol_id, evidencias: data ?? [] });
  } catch (err) {
    next(err);
  }
}
