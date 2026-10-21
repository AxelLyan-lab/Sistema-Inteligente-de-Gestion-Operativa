import { Router } from 'express';
import {
  patrolLogin,
  patrolLogout,
  getMe,
  verifyCredentials,
  validateCompanionEndpoint,
  getVehicles,
} from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth.middleware';

export const authRouter = Router();

/**
 * POST /api/v1/auth/verify-credentials
 * Valida RUT y contraseña del funcionario sin iniciar sesión operativa
 */
authRouter.post('/verify-credentials', verifyCredentials);

/**
 * POST /api/v1/auth/validate-companion
 * Verifica disponibilidad de un compañero para tripular
 */
authRouter.post('/validate-companion', validateCompanionEndpoint);

/**
 * GET /api/v1/auth/vehicles
 * Lista vehículos institucionales disponibles
 */
authRouter.get('/vehicles', getVehicles);

/**
 * POST /api/v1/auth/patrol-login
 * Inicia la sesión operativa y genera JWT táctico (Tarea #43)
 */
authRouter.post('/patrol-login', patrolLogin);

/**
 * POST /api/v1/auth/logout
 * Finaliza el turno y cierra la sesión operativa
 */
authRouter.post('/logout', authenticateToken, patrolLogout);

/**
 * GET /api/v1/auth/me
 * Retorna datos del funcionario autenticado
 */
authRouter.get('/me', authenticateToken, getMe);
