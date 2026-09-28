import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  requestReinforcements,
  addCrewMember,
  removeCrewMember,
  getCrew,
  updateTelemetry,
} from '../controllers/patrol.controller';

export const patrolRouter = Router();

// Todas las rutas de patrullaje requieren JWT
patrolRouter.use(authenticateToken);

/** POST /api/v1/patrol/sos — Solicitar refuerzos */
patrolRouter.post('/sos', requestReinforcements);

/** GET /api/v1/patrol/crew — Ver tripulación */
patrolRouter.get('/crew', getCrew);

/** POST /api/v1/patrol/crew/add — Agregar miembro */
patrolRouter.post('/crew/add', addCrewMember);

/** DELETE /api/v1/patrol/crew/:rut — Eliminar miembro */
patrolRouter.delete('/crew/:rut', removeCrewMember);

/** POST /api/v1/patrol/telemetry — Enviar posición GPS */
patrolRouter.post('/telemetry', updateTelemetry);
