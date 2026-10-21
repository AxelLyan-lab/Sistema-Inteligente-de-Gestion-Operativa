import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { getSesionesActivas, getSesionDetalle } from '../controllers/sesiones.controller';

export const sesionesRouter = Router();

// El dashboard supervisor requiere autenticación JWT de SUPERVISOR_WEB
sesionesRouter.use(authenticateToken);

/** GET /api/v1/sesiones/activas — Lista todas las sesiones en turno */
sesionesRouter.get('/activas', getSesionesActivas);

/** GET /api/v1/sesiones/:idSesion — Detalle de una sesión */
sesionesRouter.get('/:idSesion', getSesionDetalle);
