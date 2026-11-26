import { Router, Request, Response } from 'express';
import { tacticalEngine, ModoDespacho, PatrullaTactica, ZonaTactica, DelitoCalibrado } from '../utils/tacticalEngine';

export const tacticoRouter = Router();

tacticoRouter.get('/estado', (_req: Request, res: Response) => {
  res.json(tacticalEngine.getEstado());
});

tacticoRouter.post('/config', async (req: Request, res: Response) => {
  const { k_zonas, intervalo_rotacion_seg, tiempo_llegada_min } = req.body as {
    k_zonas?: number;
    intervalo_rotacion_seg?: number;
    tiempo_llegada_min?: number;
  };
  const estado = await tacticalEngine.updateConfig(k_zonas, intervalo_rotacion_seg, tiempo_llegada_min);
  res.json(estado);
});

tacticoRouter.post('/modo', async (req: Request, res: Response) => {
  const { modo_despacho, k_zonas, intervalo_rotacion_seg, zonas_activas_ids, tiempo_llegada_min } = req.body as {
    modo_despacho: ModoDespacho;
    k_zonas?: number;
    intervalo_rotacion_seg?: number;
    zonas_activas_ids?: number[];
    tiempo_llegada_min?: number;
  };
  if (!['MANUAL', 'AUTO', 'OPTIMIZADO'].includes(modo_despacho)) {
    res.status(400).json({ error: 'modo_despacho inválido' });
    return;
  }
  const estado = await tacticalEngine.setModo(
    modo_despacho,
    k_zonas,
    intervalo_rotacion_seg,
    zonas_activas_ids,
    tiempo_llegada_min
  );
  res.json(estado);
});

tacticoRouter.post('/zonas-calibrar', async (req: Request, res: Response) => {
  const { id_zona, delitos } = req.body as { id_zona: number; delitos?: DelitoCalibrado[] };
  if (id_zona == null) {
    await tacticalEngine.loadZonesFromSupabase();
    res.json({ ok: true, zonas_catalogo: tacticalEngine.getEstado().zonas_catalogo });
    return;
  }
  const zonas_catalogo = await tacticalEngine.updateZoneCalibration(Number(id_zona), delitos, true);
  res.json({ ok: true, zonas_catalogo });
});

// NOTA: /zonas-sync y /reales-sync ahora son NO-OP para lecturas pasivas desde navegadores,
// evitando que el localStorage viejo de una pestaña pise los puntajes globales o cause reasignaciones.
tacticoRouter.post('/zonas-sync', (_req: Request, res: Response) => {
  res.json({ ok: true, zonas_catalogo: tacticalEngine.getEstado().zonas_catalogo });
});

tacticoRouter.post('/reales-sync', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

tacticoRouter.post('/patrullas', async (req: Request, res: Response) => {
  const patrulla = req.body as PatrullaTactica;
  if (!patrulla?.id || !patrulla?.nombre) {
    res.status(400).json({ error: 'id y nombre son obligatorios' });
    return;
  }
  const saved = await tacticalEngine.upsertPatrol(patrulla);
  res.json(saved);
});

tacticoRouter.delete('/patrullas/:id', async (req: Request, res: Response) => {
  await tacticalEngine.deletePatrol(req.params.id);
  res.json({ ok: true });
});

tacticoRouter.post('/patrullas/:id/despachar', async (req: Request, res: Response) => {
  const { zona } = req.body as { zona: ZonaTactica };
  if (!zona?.id) {
    res.status(400).json({ error: 'zona es obligatoria' });
    return;
  }
  const updated = await tacticalEngine.despacharManual(req.params.id, zona);
  if (!updated) {
    res.status(404).json({ error: 'Patrulla no encontrada' });
    return;
  }
  res.json(updated);
});

tacticoRouter.post('/patrullas/:id/terminar', async (req: Request, res: Response) => {
  const updated = await tacticalEngine.terminarRonda(req.params.id);
  if (!updated) {
    res.status(404).json({ error: 'Patrulla no encontrada' });
    return;
  }
  res.json(updated);
});
