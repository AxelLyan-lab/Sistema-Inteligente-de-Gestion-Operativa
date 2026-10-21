import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { uploadEvidence, listEvidence, uploadMiddleware } from '../controllers/evidence.controller';

export const evidenceRouter = Router();

evidenceRouter.use(authenticateToken);

/** POST /api/v1/evidence/upload — Cargar evidencia (multipart/form-data) */
evidenceRouter.post('/upload', uploadMiddleware, uploadEvidence);

/** GET /api/v1/evidence/list — Listar evidencias de la sesión */
evidenceRouter.get('/list', listEvidence);
