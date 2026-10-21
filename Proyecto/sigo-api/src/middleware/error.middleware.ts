import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const message = err.message ?? 'Error interno del servidor';

  if (process.env.NODE_ENV !== 'production') {
    console.error('❌ Error:', err);
  }

  res.status(statusCode).json({
    error: message,
    code: err.code ?? 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}
