import { Router } from 'express';
import {
  iniciarSesionPatrulla,
  seleccionarZonasRotativas,
  despacharRefuerzosUve,
  listarZonasRiesgo,
  guardarZonaRiesgo,
  eliminarZonaRiesgo,
  registrarDelitoEnZona,
  eliminarDelitoDeZona,
  obtenerBalanceUve,
} from '../controllers/uve.controller';

export const uveRouter = Router();

// 1. Patrullaje y Capacidad U.V.E.
/** POST /api/patrulla/iniciar-sesion — Valida dotación (FZ, RPT, RPD, MTT, CB, INF) y asigna valor_uve */
uveRouter.post('/patrulla/iniciar-sesion', iniciarSesionPatrulla);

/** GET /api/patrulla/balance-uve — Balance de Capacidad U.V.E. del cuadrante en tiempo real */
uveRouter.get('/patrulla/balance-uve', obtenerBalanceUve);

// 2. Zonas de Riesgo Calibradas y Rotación Anti-Fijación
/** POST /api/zonas/seleccionar-rotativas — Algoritmo anti-fijación para k zonas (1 a 5) */
uveRouter.post('/zonas/seleccionar-rotativas', seleccionarZonasRotativas);

/** GET /api/zonas/riesgo — Lista zonas de riesgo calibradas con polígonos y delitos */
uveRouter.get('/zonas/riesgo', listarZonasRiesgo);

/** POST /api/zonas/riesgo — Crea o edita una zona de riesgo con polígono */
uveRouter.post('/zonas/riesgo', guardarZonaRiesgo);

/** DELETE /api/zonas/riesgo/:id — Elimina una zona de riesgo */
uveRouter.delete('/zonas/riesgo/:id', eliminarZonaRiesgo);

/** POST /api/zonas/:id/delitos — Registra delito (50, 20, 10, 5, 2, 1 pts) y recalcula score_gravedad */
uveRouter.post('/zonas/:id/delitos', registrarDelitoEnZona);

/** DELETE /api/zonas/:id/delitos/:delitoId — Elimina delito y recalcula score_gravedad */
uveRouter.delete('/zonas/:id/delitos/:delitoId', eliminarDelitoDeZona);

// 3. Despacho de Refuerzos por Demanda U.V.E.
/** POST /api/refuerzos/despachar — Algoritmo de despacho por U.V.E. y menor ETA */
uveRouter.post('/refuerzos/despachar', despacharRefuerzosUve);

