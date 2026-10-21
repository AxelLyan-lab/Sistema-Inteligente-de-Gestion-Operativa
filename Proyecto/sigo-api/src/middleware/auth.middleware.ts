import { Request, Response, NextFunction } from 'express';
import { verifyTacticalToken } from '../utils/jwt.utils';
import { TacticalJwtPayload } from '../types';

// Extiende el Request de Express con el payload táctico
declare global {
  namespace Express {
    interface Request {
      tacticalUser?: TacticalJwtPayload;
    }
  }
}

/**
 * Middleware de autenticación JWT — extrae y valida el Bearer token
 * e inyecta los claims tácticos en req.tacticalUser
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Token de acceso requerido', code: 'NO_TOKEN' });
    return;
  }

  try {
    const payload = verifyTacticalToken(token);
    req.tacticalUser = payload;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Token inválido o expirado', code: 'INVALID_TOKEN' });
  }
}

/**
 * Middleware de autorización por rol
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.tacticalUser || !roles.includes(req.tacticalUser.role)) {
      res.status(403).json({ error: 'Acceso denegado — rol insuficiente', code: 'FORBIDDEN' });
      return;
    }
    next();
  };
}
