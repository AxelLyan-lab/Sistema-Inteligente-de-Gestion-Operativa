import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';

// ── GET /api/v1/patrol/assignment — Misión activa asignada a la sesión ───────
export async function getActiveAssignment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { patrol_id } = req.tacticalUser!;

  try {
    const { data, error } = await supabaseAdmin
      .from('asignaciones_tacticas')
      .select(
        'id_asignacion, origen_asignacion, estado_mision, hora_despacho, hora_ingreso_zona, centro_lat, centro_lng, radio_m, nombre_zona, instrucciones'
      )
      .eq('id_sesion', patrol_id)
      .not('estado_mision', 'in', '("COMPLETADA","CANCELADA")')
      .order('hora_despacho', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    let tiempo_limite_minutos = 15;
    if (data?.instrucciones) {
      const match = data.instrucciones.match(/\[ETA:(\d+)\]/);
      if (match) {
        tiempo_limite_minutos = parseInt(match[1], 10);
      }
    }

    const asignacionResponse = data ? { ...data, tiempo_limite_minutos } : null;
    res.json({ patrol_id, asignacion: asignacionResponse });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/v1/patrol/assignment/arrived — Ingreso a la zona asignada ──────
export async function markAssignmentArrived(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { patrol_id } = req.tacticalUser!;
  const { id_asignacion } = req.body;

  try {
    if (!id_asignacion) {
      res.status(400).json({ error: 'id_asignacion requerido', code: 'NO_ASSIGNMENT' });
      return;
    }

    const { error } = await supabaseAdmin
      .from('asignaciones_tacticas')
      .update({ estado_mision: 'PATRULLANDO', hora_ingreso_zona: new Date().toISOString() })
      .eq('id_asignacion', id_asignacion)
      .eq('id_sesion', patrol_id)
      .is('hora_ingreso_zona', null);

    if (error) throw error;

    await supabaseAdmin
      .from('sesiones_operativas')
      .update({ estado_operativo: 'PATRULLANDO_ZONA' })
      .eq('id_sesion', patrol_id);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/patrol/messages — Conversación con el supervisor ─────────────
export async function getMessages(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { patrol_id } = req.tacticalUser!;

  try {
    const { data, error } = await supabaseAdmin
      .from('mensajes')
      .select('id_mensaje, remitente, texto, fecha, leido')
      .eq('id_sesion', patrol_id)
      .order('fecha', { ascending: true })
      .limit(300);

    if (error) throw error;

    // Marcar como leídos los mensajes del supervisor
    await supabaseAdmin
      .from('mensajes')
      .update({ leido: true })
      .eq('id_sesion', patrol_id)
      .eq('remitente', 'SUPERVISOR')
      .eq('leido', false);

    res.json({ patrol_id, mensajes: data ?? [] });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/v1/patrol/message — Enviar mensaje al supervisor ───────────────
export async function sendMessage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { patrol_id, user_id } = req.tacticalUser!;
  const texto: string = (req.body?.texto ?? '').toString().trim();

  try {
    if (!texto) {
      res.status(400).json({ error: 'El mensaje no puede estar vacío', code: 'EMPTY_MESSAGE' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('mensajes')
      .insert({
        id_sesion: patrol_id,
        remitente: 'FUNCIONARIO',
        rut_remitente: user_id,
        texto: texto.slice(0, 1000),
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ message: 'Mensaje enviado', mensaje: data });
  } catch (err) {
    next(err);
  }
}

// ── Middleware y Controlador de Nota de Voz ──────────────────────────────────
import multer from 'multer';

const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});
export const audioUploadMiddleware = uploadAudio.single('audio');

export async function sendAudioMessage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { patrol_id, user_id } = req.tacticalUser!;
  const file = req.file;

  try {
    if (!file) {
      res.status(400).json({ error: 'Archivo de audio no recibido', code: 'NO_AUDIO' });
      return;
    }

    const fileName = `audios/${patrol_id}/${Date.now()}_voz.m4a`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('sigo-evidencias')
      .upload(fileName, file.buffer, {
        contentType: 'audio/mp4',
        upsert: false,
      });

    let audioUrl = '';
    if (uploadError) {
      console.error('Error subiendo audio a storage:', uploadError);
      throw uploadError;
    } else {
      const { data: publicUrl } = supabaseAdmin.storage
        .from('sigo-evidencias')
        .getPublicUrl(uploadData.path);
      audioUrl = publicUrl.publicUrl;
    }

    const { data, error } = await supabaseAdmin
      .from('mensajes')
      .insert({
        id_sesion: patrol_id,
        remitente: 'FUNCIONARIO',
        rut_remitente: user_id,
        texto: `[AUDIO] ${audioUrl}`,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ message: 'Nota de voz enviada', mensaje: data });
  } catch (err) {
    next(err);
  }
}
