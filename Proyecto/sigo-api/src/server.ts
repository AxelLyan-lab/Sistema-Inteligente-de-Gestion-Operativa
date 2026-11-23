// ── WebSocket polyfill para Node.js 18-20 (requerido por @supabase/supabase-js v2)
import { WebSocket } from 'ws';
if (!global.WebSocket) {
  (global as any).WebSocket = WebSocket;
}

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { authRouter } from './routes/auth.routes';
import { patrolRouter } from './routes/patrol.routes';
import { evidenceRouter } from './routes/evidence.routes';
import { sesionesRouter } from './routes/sesiones.routes';
import { uveRouter } from './routes/uve.routes';
import { configRouter } from './routes/config.routes';
import { tacticoRouter } from './routes/tactico.routes';
import { errorHandler } from './middleware/error.middleware';
import { startSessionSweeper } from './utils/sessionSweeper';
import { tacticalEngine } from './utils/tacticalEngine';

const app = express();
const PORT = process.env.PORT ?? 3000;

// ── Seguridad y utilidades ────────────────────────────────
app.use(helmet());
const allowedOrigins = process.env.NODE_ENV === 'development'
  ? true
  : (process.env.CORS_ORIGIN
      ? (process.env.CORS_ORIGIN.includes(',')
          ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
          : process.env.CORS_ORIGIN)
      : '*');

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rutas de la API ───────────────────────────────────────
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/patrol', patrolRouter);
app.use('/api/v1/evidence', evidenceRouter);
app.use('/api/v1/sesiones', sesionesRouter);
app.use('/api/v1/config', configRouter);
app.use('/api/v1/tactico', tacticoRouter);
app.use('/api/v1', uveRouter);
app.use('/api', uveRouter);

// ── Health check ──────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'SIGO Patrol API', timestamp: new Date().toISOString() });
});

// ── Manejador de errores global ───────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n🚔 S.I.G.O. Patrol API corriendo en http://localhost:${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV ?? 'development'}\n`);
  startSessionSweeper();
  tacticalEngine.start().catch(err => console.error('[TacticalEngine] Error al iniciar:', err));
});

export default app;
