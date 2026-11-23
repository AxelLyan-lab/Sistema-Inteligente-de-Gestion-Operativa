import { Router, Request, Response } from 'express';

export const configRouter = Router();

/**
 * GET /api/v1/config/maps-key
 * Entrega la Google Maps API Key desde el backend para evitar exponerla
 * estáticamente en el bundle del frontend.
 */
configRouter.get('/maps-key', (_req: Request, res: Response) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      error: 'GOOGLE_MAPS_API_KEY no configurada en el servidor.',
    });
    return;
  }

  res.setHeader('Cache-Control', 'no-store');
  res.json({ googleMapsApiKey: apiKey });
});

