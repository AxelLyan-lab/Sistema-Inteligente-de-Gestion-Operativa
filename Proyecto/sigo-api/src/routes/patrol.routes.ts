import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  requestReinforcements,
  addCrewMember,
  removeCrewMember,
  getCrew,
  updateTelemetry,
  getTelemetryStatus,
} from '../controllers/patrol.controller';
import {
  getActiveAssignment,
  markAssignmentArrived,
  getMessages,
  sendMessage,
  sendAudioMessage,
  audioUploadMiddleware,
} from '../controllers/mission.controller';

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

/** POST /api/v1/patrol/telemetry — Ingestar ping GNSS completo */
patrolRouter.post('/telemetry', updateTelemetry);

/** GET /api/v1/patrol/telemetry/status — Último ping registrado */
patrolRouter.get('/telemetry/status', getTelemetryStatus);

/** GET /api/v1/patrol/assignment - Misión (zona) asignada por el supervisor */
patrolRouter.get('/assignment', getActiveAssignment);

/** POST /api/v1/patrol/assignment/arrived - Notificar ingreso a la zona */
patrolRouter.post('/assignment/arrived', markAssignmentArrived);

/** GET /api/v1/patrol/messages - Conversación con la central */
patrolRouter.get('/messages', getMessages);

/** POST /api/v1/patrol/message - Enviar mensaje a la central */
patrolRouter.post('/message', sendMessage);

/** POST /api/v1/patrol/message/audio - Enviar nota de voz a la central */
patrolRouter.post('/message/audio', audioUploadMiddleware, sendAudioMessage);


