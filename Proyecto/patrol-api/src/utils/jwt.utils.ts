import jwt from 'jsonwebtoken';
import { TacticalJwtPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET ?? 'sigo_fallback_secret_dev_only';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '8h';

/**
 * Genera un JWT con claims tácticos de terreno (Tarea #43)
 */
export function generateTacticalToken(payload: Omit<TacticalJwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

/**
 * Verifica y decodifica un JWT táctico
 */
export function verifyTacticalToken(token: string): TacticalJwtPayload {
  return jwt.verify(token, JWT_SECRET) as TacticalJwtPayload;
}
