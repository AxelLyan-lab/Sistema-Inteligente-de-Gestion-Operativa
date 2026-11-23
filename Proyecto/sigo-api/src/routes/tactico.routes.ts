import { Router, Request, Response } from 'express';
import { tacticalEngine, ModoDespacho, PatrullaTactica, ZonaTactica } from '../utils/tacticalEngine';

export const tacticoRouter = Router();

tacticoRouter.get('/estado', (_req: Request, res: Response) => {
  res.json(tacticalEngine.getEstado());
});

tacticoRouter.post('/modo', async (req: Request, res: Response) => {
  const { modo_despacho, k_zonas, intervalo_rotacion_seg } = req.body as {
    modo_despacho: ModoDespacho;
    k_zonas?: number;
    intervalo_rotacion_seg?: number;
  };
  if (!['MANUAL', 'AUTO', 'OPTIMIZADO'].includes(modo_despacho)) {
    res.status(400).json({ error: 'modo_despacho inválido' });
    return;
  }
  const estado = await tacticalEngine.setModo(modo_despacho, k_zonas, intervalo_rotacion_seg);
  res.json(estado);
});

tacticoRouter.post('/zonas-sync', (req: Request, res: Response) => {
  const { zonas } = req.body as { zonas: ZonaTactica[] };
  tacticalEngine.syncZonasCatalogo(zonas);
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

