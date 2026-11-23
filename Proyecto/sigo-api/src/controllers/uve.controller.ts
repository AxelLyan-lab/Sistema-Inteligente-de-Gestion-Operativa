import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import {
  TipoMedio,
  EstadoZonaRiesgo,
  CONFIG_MEDIOS_UVE,
  CATALOGO_GRAVEDAD_DELITOS,
  PESOS_DELITO_VALIDOS,
  validarYCalcularUve,
  clasificarZonaPorScore,
  calcularScoreAjustado,
  calcularDistanciaMetros,
  calcularEtaPatrulla,
  puntoEnPoligono,
  generarPoligonoCircular,
  coordsToPolygonWkt,
} from '../utils/uve.utils';
import { ZonaRiesgo, DelitoRegistro } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Estado híbrido en memoria (sincronizado con Supabase PostGIS)
// Garantiza operación inmediata incluso antes de ejecutar la migración SQL manual
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CUADRANTE_ID = '00000000-0000-0000-0000-000000000001';

const INITIAL_CALIBRATED_ZONES: ZonaRiesgo[] = [
  {
    id: 'a1000000-0000-4000-8000-000000000001',
    id_zona_patrullaje: 1,
    nombre: 'Z1 - Miraflores (Chonta)',
    direccion: 'Chonta 3544, Miraflores, Viña del Mar',
    cuadrante_id: DEFAULT_CUADRANTE_ID,
    centro_lat: -33.01840,
    centro_lng: -71.51398,
    radio_m: 160,
    poligono: generarPoligonoCircular(-33.01840, -71.51398, 160, 12),
    score_gravedad: 85,
    score_ajustado: calcularScoreAjustado(85, 15),
    nivel_riesgo: 'ALTO',
    estado: 'LIBRE',
    minutos_patrullados_hoy: 15,
    ultimo_patrullaje: null,
    uve_objetivo_min: 1.00,
    uve_objetivo_max: 1.00,
    medios_sugeridos: ['RPT', 'FZ'],
    etiqueta_demanda: 'Mín. 1.00 U.V.E. continua (RPT o FZ)',
    delitos: [
      { id: 'd1-1', zona_id: 'a1000000-0000-4000-8000-000000000001', tipo_delito: 'Crítico / Delito con arma de fuego', categoria_peso: 50, fecha_hora: new Date().toISOString() },
      { id: 'd1-2', zona_id: 'a1000000-0000-4000-8000-000000000001', tipo_delito: 'Robo con violencia / intimidación', categoria_peso: 20, fecha_hora: new Date().toISOString() },
      { id: 'd1-3', zona_id: 'a1000000-0000-4000-8000-000000000001', tipo_delito: 'Robo en lugar habitado', categoria_peso: 10, fecha_hora: new Date().toISOString() },
      { id: 'd1-4', zona_id: 'a1000000-0000-4000-8000-000000000001', tipo_delito: 'Robo por sorpresa', categoria_peso: 5, fecha_hora: new Date().toISOString() },
    ],
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002',
    id_zona_patrullaje: 2,
    nombre: 'Z2 - Eje 1 Norte / 1 Poniente',
    direccion: '1 Norte / 1 Poniente, Plan de Viña del Mar',
    cuadrante_id: DEFAULT_CUADRANTE_ID,
    centro_lat: -33.02229,
    centro_lng: -71.55278,
    radio_m: 160,
    poligono: generarPoligonoCircular(-33.02229, -71.55278, 160, 12),
    score_gravedad: 87,
    score_ajustado: calcularScoreAjustado(87, 25),
    nivel_riesgo: 'ALTO',
    estado: 'LIBRE',
    minutos_patrullados_hoy: 25,
    ultimo_patrullaje: null,
    uve_objetivo_min: 1.00,
    uve_objetivo_max: 1.00,
    medios_sugeridos: ['RPT', 'FZ'],
    etiqueta_demanda: 'Mín. 1.00 U.V.E. continua (RPT o FZ)',
    delitos: [
      { id: 'd2-1', zona_id: 'a1000000-0000-4000-8000-000000000002', tipo_delito: 'Porte de arma / Asalto armado', categoria_peso: 50, fecha_hora: new Date().toISOString() },
      { id: 'd2-2', zona_id: 'a1000000-0000-4000-8000-000000000002', tipo_delito: 'Robo con intimidación a peatón', categoria_peso: 20, fecha_hora: new Date().toISOString() },
      { id: 'd2-3', zona_id: 'a1000000-0000-4000-8000-000000000002', tipo_delito: 'Robo de vehículo motorizado', categoria_peso: 10, fecha_hora: new Date().toISOString() },
      { id: 'd2-4', zona_id: 'a1000000-0000-4000-8000-000000000002', tipo_delito: 'Receptación de especies', categoria_peso: 5, fecha_hora: new Date().toISOString() },
      { id: 'd2-5', zona_id: 'a1000000-0000-4000-8000-000000000002', tipo_delito: 'Hurto simple en comercio', categoria_peso: 2, fecha_hora: new Date().toISOString() },
    ],
  },
  {
    id: 'a1000000-0000-4000-8000-000000000003',
    id_zona_patrullaje: 3,
    nombre: 'Z3 - 8 Norte / Av. Libertad',
    direccion: '8 Norte / Av. Libertad, Viña del Mar',
    cuadrante_id: DEFAULT_CUADRANTE_ID,
    centro_lat: -33.01533,
    centro_lng: -71.55008,
    radio_m: 160,
    poligono: generarPoligonoCircular(-33.01533, -71.55008, 160, 12),
    score_gravedad: 56,
    score_ajustado: calcularScoreAjustado(56, 20),
    nivel_riesgo: 'MEDIO',
    estado: 'LIBRE',
    minutos_patrullados_hoy: 20,
    ultimo_patrullaje: null,
    uve_objetivo_min: 0.45,
    uve_objetivo_max: 0.80,
    medios_sugeridos: ['MTT', 'RPD'],
    etiqueta_demanda: '0.45 - 0.80 U.V.E. (MTT o RPD)',
    delitos: [
      { id: 'd3-1', zona_id: 'a1000000-0000-4000-8000-000000000003', tipo_delito: 'Robo con intimidación', categoria_peso: 20, fecha_hora: new Date().toISOString() },
      { id: 'd3-2', zona_id: 'a1000000-0000-4000-8000-000000000003', tipo_delito: 'Robo con violencia nocturno', categoria_peso: 20, fecha_hora: new Date().toISOString() },
      { id: 'd3-3', zona_id: 'a1000000-0000-4000-8000-000000000003', tipo_delito: 'Robo en lugar habitado', categoria_peso: 10, fecha_hora: new Date().toISOString() },
      { id: 'd3-4', zona_id: 'a1000000-0000-4000-8000-000000000003', tipo_delito: 'Robo por sorpresa', categoria_peso: 5, fecha_hora: new Date().toISOString() },
      { id: 'd3-5', zona_id: 'a1000000-0000-4000-8000-000000000003', tipo_delito: 'Consumo de alcohol en vía pública', categoria_peso: 1, fecha_hora: new Date().toISOString() },
    ],
  },
  {
    id: 'a1000000-0000-4000-8000-000000000004',
    id_zona_patrullaje: 4,
    nombre: 'Z4 - Plaza Vergara / Av. Valparaíso',
    direccion: 'Av. Valparaíso / Plaza Vergara, Viña del Mar',
    cuadrante_id: DEFAULT_CUADRANTE_ID,
    centro_lat: -33.02500,
    centro_lng: -71.55237,
    radio_m: 160,
    poligono: generarPoligonoCircular(-33.02500, -71.55237, 160, 12),
    score_gravedad: 45,
    score_ajustado: calcularScoreAjustado(45, 10),
    nivel_riesgo: 'MEDIO',
    estado: 'LIBRE',
    minutos_patrullados_hoy: 10,
    ultimo_patrullaje: null,
    uve_objetivo_min: 0.45,
    uve_objetivo_max: 0.80,
    medios_sugeridos: ['MTT', 'RPD'],
    etiqueta_demanda: '0.45 - 0.80 U.V.E. (MTT o RPD)',
    delitos: [
      { id: 'd4-1', zona_id: 'a1000000-0000-4000-8000-000000000004', tipo_delito: 'Robo con violencia', categoria_peso: 20, fecha_hora: new Date().toISOString() },
      { id: 'd4-2', zona_id: 'a1000000-0000-4000-8000-000000000004', tipo_delito: 'Robo de vehículo', categoria_peso: 10, fecha_hora: new Date().toISOString() },
      { id: 'd4-3', zona_id: 'a1000000-0000-4000-8000-000000000004', tipo_delito: 'Robo por sorpresa (lanzazo)', categoria_peso: 5, fecha_hora: new Date().toISOString() },
      { id: 'd4-4', zona_id: 'a1000000-0000-4000-8000-000000000004', tipo_delito: 'Receptación', categoria_peso: 5, fecha_hora: new Date().toISOString() },
      { id: 'd4-5', zona_id: 'a1000000-0000-4000-8000-000000000004', tipo_delito: 'Robo por sorpresa en paradero', categoria_peso: 5, fecha_hora: new Date().toISOString() },
    ],
  },
  {
    id: 'a1000000-0000-4000-8000-000000000005',
    id_zona_patrullaje: 5,
    nombre: 'Z5 - 15 Norte / Av. Libertad',
    direccion: '15 Norte / Av. Libertad, Viña del Mar',
    cuadrante_id: DEFAULT_CUADRANTE_ID,
    centro_lat: -33.00800,
    centro_lng: -71.54849,
    radio_m: 160,
    poligono: generarPoligonoCircular(-33.00800, -71.54849, 160, 12),
    score_gravedad: 22,
    score_ajustado: calcularScoreAjustado(22, 5),
    nivel_riesgo: 'BAJO',
    estado: 'LIBRE',
    minutos_patrullados_hoy: 5,
    ultimo_patrullaje: null,
    uve_objetivo_min: 0.20,
    uve_objetivo_max: 0.30,
    medios_sugeridos: ['INF', 'CB'],
    etiqueta_demanda: '0.20 - 0.30 U.V.E. (INF o CB)',
    delitos: [
      { id: 'd5-1', zona_id: 'a1000000-0000-4000-8000-000000000005', tipo_delito: 'Robo de vehículo en estacionamiento', categoria_peso: 10, fecha_hora: new Date().toISOString() },
      { id: 'd5-2', zona_id: 'a1000000-0000-4000-8000-000000000005', tipo_delito: 'Robo por sorpresa', categoria_peso: 5, fecha_hora: new Date().toISOString() },
      { id: 'd5-3', zona_id: 'a1000000-0000-4000-8000-000000000005', tipo_delito: 'Hurto simple en tienda', categoria_peso: 2, fecha_hora: new Date().toISOString() },
      { id: 'd5-4', zona_id: 'a1000000-0000-4000-8000-000000000005', tipo_delito: 'Lesiones leves', categoria_peso: 2, fecha_hora: new Date().toISOString() },
      { id: 'd5-5', zona_id: 'a1000000-0000-4000-8000-000000000005', tipo_delito: 'Hurto simple', categoria_peso: 2, fecha_hora: new Date().toISOString() },
      { id: 'd5-6', zona_id: 'a1000000-0000-4000-8000-000000000005', tipo_delito: 'Consumo de alcohol en vía pública', categoria_peso: 1, fecha_hora: new Date().toISOString() },
    ],
  },
  {
    id: 'a1000000-0000-4000-8000-000000000006',
    id_zona_patrullaje: 6,
    nombre: 'Z6 - Borde Costero Av. Perú',
    direccion: 'Av. Perú / 8 Norte, Viña del Mar',
    cuadrante_id: DEFAULT_CUADRANTE_ID,
    centro_lat: -33.01439,
    centro_lng: -71.55655,
    radio_m: 160,
    poligono: generarPoligonoCircular(-33.01439, -71.55655, 160, 12),
    score_gravedad: 14,
    score_ajustado: calcularScoreAjustado(14, 0),
    nivel_riesgo: 'BAJO',
    estado: 'LIBRE',
    minutos_patrullados_hoy: 0,
    ultimo_patrullaje: null,
    uve_objetivo_min: 0.20,
    uve_objetivo_max: 0.30,
    medios_sugeridos: ['INF', 'CB'],
    etiqueta_demanda: '0.20 - 0.30 U.V.E. (INF o CB)',
    delitos: [
      { id: 'd6-1', zona_id: 'a1000000-0000-4000-8000-000000000006', tipo_delito: 'Robo por sorpresa', categoria_peso: 5, fecha_hora: new Date().toISOString() },
      { id: 'd6-2', zona_id: 'a1000000-0000-4000-8000-000000000006', tipo_delito: 'Robo por sorpresa en paseo peatonal', categoria_peso: 5, fecha_hora: new Date().toISOString() },
      { id: 'd6-3', zona_id: 'a1000000-0000-4000-8000-000000000006', tipo_delito: 'Hurto simple', categoria_peso: 2, fecha_hora: new Date().toISOString() },
      { id: 'd6-4', zona_id: 'a1000000-0000-4000-8000-000000000006', tipo_delito: 'Consumo de alcohol / drogas en vía pública', categoria_peso: 1, fecha_hora: new Date().toISOString() },
      { id: 'd6-5', zona_id: 'a1000000-0000-4000-8000-000000000006', tipo_delito: 'Incivilidad en vía pública', categoria_peso: 1, fecha_hora: new Date().toISOString() },
    ],
  },
];

// Memoria sincronizada de zonas calibradas y sesiones U.V.E.
export const memoryZonasRiesgo = new Map<string, ZonaRiesgo>(
  INITIAL_CALIBRATED_ZONES.map(z => [z.id, z])
);

export const memorySesionesUve = new Map<string, {
  id: string;
  id_sesion_operativa?: number;
  lider_id: string;
  acompanante_1_id: string | null;
  acompanante_2_id: string | null;
  identificador_unidad?: string;
  tipo_medio: TipoMedio;
  valor_uve: number;
  estado: 'DISPONIBLE' | 'PATRULLANDO' | 'EN_ZONA_RIESGO' | 'SOLICITANDO_REFUERZO' | 'EN_REFUERZO';
  ubicacion_actual: { latitude: number; longitude: number } | null;
  zona_actual?: { id: string; nombre: string; nivel_riesgo: string; score_gravedad: number } | null;
  created_at: string;
  updated_at: string;
}>();

export const memoryHistorialDespachosRefuerzo: Array<{
  id_despacho: string;
  patrulla_origen_id: string | number;
  identificador_origen?: string;
  uve_requerida: number;
  uve_acumulada: number;
  coordenadas_emergencia: { latitude: number; longitude: number };
  unidades_asignadas: Array<{
    id: string | number;
    identificador_unidad: string;
    conductor_nombre?: string;
    tipo_medio: TipoMedio;
    valor_uve: number;
    distancia_m: number;
    distancia_km: number;
    eta_segundos: number;
    eta_minutos: number;
    estado: 'EN_REFUERZO';
  }>;
  timestamp: string;
}> = [];

/**
 * Sincroniza zonas desde la tabla `zonas_riesgo` (o `v_zonas_riesgo_geojson`) de Supabase si existe,
 * manteniendo el fallback calibrado en memoria.
 */
export async function obtenerZonasRiesgoSincronizadas(): Promise<ZonaRiesgo[]> {
  try {
    const { data: dbZonas, error } = await supabaseAdmin
      .from('v_zonas_riesgo_geojson')
      .select('*')
      .order('score_gravedad', { ascending: false });

    if (!error && dbZonas && dbZonas.length > 0) {
      const { data: allDelitos } = await supabaseAdmin
        .from('delitos_registro')
        .select('*')
        .order('fecha_hora', { ascending: false });

      const delitosByZona = new Map<string, DelitoRegistro[]>();
      for (const d of allDelitos ?? []) {
        const list = delitosByZona.get(d.zona_id) ?? [];
        list.push(d as DelitoRegistro);
        delitosByZona.set(d.zona_id, list);
      }

      const mapped: ZonaRiesgo[] = dbZonas.map((row: any) => {
        const clasif = clasificarZonaPorScore(row.score_gravedad);
        let poligono: Array<{ lat: number; lng: number }> = [];
        if (row.geojson?.coordinates?.[0]) {
          const ring = row.geojson.type === 'MultiPolygon'
            ? row.geojson.coordinates[0][0]
            : row.geojson.coordinates[0];
          poligono = ring.map(([lng, lat]: [number, number]) => ({ lat, lng }));
        } else {
          poligono = generarPoligonoCircular(
            Number(row.centro_lat) || -33.0184,
            Number(row.centro_lng) || -71.5139,
            160,
            12
          );
        }

        const zonaObj: ZonaRiesgo = {
          id: row.id,
          id_zona_patrullaje: row.id_zona_patrullaje,
          nombre: row.nombre,
          direccion: row.direccion,
          cuadrante_id: row.cuadrante_id ?? DEFAULT_CUADRANTE_ID,
          poligono,
          centro_lat: Number(row.centro_lat) || poligono[0]?.lat || -33.0184,
          centro_lng: Number(row.centro_lng) || poligono[0]?.lng || -71.5139,
          radio_m: 160,
          score_gravedad: clasif.score_gravedad,
          score_ajustado: calcularScoreAjustado(clasif.score_gravedad, row.minutos_patrullados_hoy ?? 0),
          nivel_riesgo: clasif.nivel_riesgo,
          estado: row.estado ?? 'LIBRE',
          minutos_patrullados_hoy: row.minutos_patrullados_hoy ?? 0,
          ultimo_patrullaje: row.ultimo_patrullaje ?? null,
          uve_objetivo_min: clasif.uve_objetivo_min,
          uve_objetivo_max: clasif.uve_objetivo_max,
          medios_sugeridos: clasif.medios_sugeridos,
          etiqueta_demanda: clasif.etiqueta_demanda,
          delitos: delitosByZona.get(row.id) ?? [],
        };
        memoryZonasRiesgo.set(zonaObj.id, zonaObj);
        return zonaObj;
      });
      return mapped;
    }
  } catch {
    // Fallback a memoria sincronizada si la vista aún no fue creada en Supabase
  }

  return Array.from(memoryZonasRiesgo.values()).map(z => {
    const clasif = clasificarZonaPorScore(z.score_gravedad);
    return {
      ...z,
      nivel_riesgo: clasif.nivel_riesgo,
      score_ajustado: calcularScoreAjustado(z.score_gravedad, z.minutos_patrullados_hoy),
      uve_objetivo_min: clasif.uve_objetivo_min,
      uve_objetivo_max: clasif.uve_objetivo_max,
      medios_sugeridos: clasif.medios_sugeridos,
      etiqueta_demanda: clasif.etiqueta_demanda,
    };
  });
}

// ============================================================================
// 1. POST /api/patrulla/iniciar-sesion
// ============================================================================
export async function iniciarSesionPatrulla(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      lider_id,
      rut,
      acompanante_1_id,
      acompanante_2_id,
      tripulacion,
      tipo_medio,
      tipo_transporte,
      identificador_unidad,
      ubicacion_actual,
    } = req.body;

    const liderIdentificador = (lider_id ?? rut ?? req.tacticalUser?.user_id ?? '').toString().trim();
    if (!liderIdentificador) {
      res.status(400).json({
        error: 'El identificador del líder de patrulla (lider_id) es obligatorio.',
        code: 'MISSING_LEADER',
      });
      return;
    }

    // Construir lista de acompañantes desde acompanante_1_id / acompanante_2_id o arreglo tripulacion
    const listaAcompanantes: string[] = [];
    if (acompanante_1_id && String(acompanante_1_id).trim()) {
      listaAcompanantes.push(String(acompanante_1_id).trim());
    }
    if (acompanante_2_id && String(acompanante_2_id).trim()) {
      listaAcompanantes.push(String(acompanante_2_id).trim());
    }
    if (listaAcompanantes.length === 0 && Array.isArray(tripulacion)) {
      for (const c of tripulacion) {
        if (c && String(c).trim()) listaAcompanantes.push(String(c).trim());
      }
    }

    const medioSolicitado = (tipo_medio ?? tipo_transporte ?? '').toString().trim();
    if (!medioSolicitado) {
      res.status(400).json({
        error: 'El parámetro tipo_medio (RPT, RPD, FZ, MTT, CB, INF) es obligatorio.',
        code: 'MISSING_TIPO_MEDIO',
      });
      return;
    }

    // Validar reglas de negocio de tripulación y calcular U.V.E.
    const validacion = validarYCalcularUve(medioSolicitado, listaAcompanantes.length, true);
    if (!validacion.valid) {
      res.status(400).json({
        error: validacion.error,
        code: validacion.code ?? 'INVALID_CREW_RULES',
        regla_uve: CONFIG_MEDIOS_UVE[validacion.tipo_medio],
      });
      return;
    }

    const comp1 = listaAcompanantes[0] ?? null;
    const comp2 = listaAcompanantes[1] ?? null;
    const sesionId = uuidv4();
    const nowIso = new Date().toISOString();

    const isUuid = (val: string | null) =>
      !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

    // Intentar insertar en sesiones_patrullaje en Supabase
    let dbRecord: any = null;
    try {
      const insertPayload: any = {
        id: sesionId,
        lider_id: isUuid(liderIdentificador) ? liderIdentificador : null,
        acompanante_1_id: isUuid(comp1) ? comp1 : null,
        acompanante_2_id: isUuid(comp2) ? comp2 : null,
        lider_rut: !isUuid(liderIdentificador) ? liderIdentificador : null,
        acompanante_1_rut: comp1 && !isUuid(comp1) ? comp1 : null,
        acompanante_2_rut: comp2 && !isUuid(comp2) ? comp2 : null,
        identificador_unidad: identificador_unidad ? String(identificador_unidad).toUpperCase() : `${validacion.tipo_medio}-01`,
        tipo_medio: validacion.tipo_medio,
        valor_uve: validacion.valor_uve,
        estado: 'PATRULLANDO',
        ubicacion_actual:
          ubicacion_actual?.latitude != null && ubicacion_actual?.longitude != null
            ? `SRID=4326;POINT(${ubicacion_actual.longitude} ${ubicacion_actual.latitude})`
            : null,
      };

      const { data, error } = await supabaseAdmin
        .from('sesiones_patrullaje')
        .insert(insertPayload)
        .select()
        .single();

      if (!error && data) {
        dbRecord = data;
      }
    } catch {
      // Fallback limpio en memoria si la migración aún no se corre en Supabase
    }

    const sesionActiva = {
      id: dbRecord?.id ?? sesionId,
      lider_id: liderIdentificador,
      acompanante_1_id: comp1,
      acompanante_2_id: comp2,
      identificador_unidad: identificador_unidad ? String(identificador_unidad).toUpperCase() : `${validacion.tipo_medio}-01`,
      tipo_medio: validacion.tipo_medio,
      valor_uve: Number(validacion.valor_uve.toFixed(2)),
      dotacion_total: validacion.dotacion_total,
      estado: (dbRecord?.estado ?? 'PATRULLANDO') as 'PATRULLANDO',
      ubicacion_actual:
        ubicacion_actual?.latitude != null && ubicacion_actual?.longitude != null
          ? { latitude: Number(ubicacion_actual.latitude), longitude: Number(ubicacion_actual.longitude) }
          : null,
      created_at: dbRecord?.created_at ?? nowIso,
      updated_at: dbRecord?.updated_at ?? nowIso,
    };

    memorySesionesUve.set(sesionActiva.id, sesionActiva);

    res.status(201).json({
      message: 'Sesión de patrullaje iniciada con éxito',
      sesion: sesionActiva,
      configuracion_uve: CONFIG_MEDIOS_UVE[validacion.tipo_medio],
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// 2. POST /api/zonas/seleccionar-rotativas
// ============================================================================
export async function seleccionarZonasRotativas(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawK = req.body?.k ?? req.query?.k ?? 3;
    const k = parseInt(String(rawK), 10);

    if (isNaN(k) || k < 1 || k > 5) {
      res.status(400).json({
        error: 'El parámetro "k" debe ser un número entero entre 1 y 5.',
        code: 'INVALID_K_PARAMETER',
      });
      return;
    }

    const liberarPrevias = req.body?.rotar_ciclo !== false;
    const ahoraMs = Date.now();
    const COOLDOWN_MS = 90 * 60 * 1000; // 90 minutos en milisegundos

    const todasLasZonas = await obtenerZonasRiesgoSincronizadas();

    // 1. Filtrar zonas donde estado != 'ASIGNADA' y con cooldown cumplido (ultimo_patrullaje > 90 min o NULL)
    const candidatasEstrictas = todasLasZonas.filter(z => {
      if (z.estado === 'ASIGNADA') return false;
      if (!z.ultimo_patrullaje) return true;
      const transcurridoMs = ahoraMs - new Date(z.ultimo_patrullaje).getTime();
      return transcurridoMs > COOLDOWN_MS;
    });

    // Si el operador está rotando de ciclo y había zonas ASIGNADAS previamente,
    // las ponemos en EN_ENFRIAMIENTO después de separar las candidatas para garantizar que no se repitan
    if (liberarPrevias) {
      for (const z of todasLasZonas) {
        if (z.estado === 'ASIGNADA') {
          z.estado = 'EN_ENFRIAMIENTO';
          z.ultimo_patrullaje = z.ultimo_patrullaje ?? new Date().toISOString();
          memoryZonasRiesgo.set(z.id, z);
          try {
            await supabaseAdmin
              .from('zonas_riesgo')
              .update({ estado: 'EN_ENFRIAMIENTO', ultimo_patrullaje: z.ultimo_patrullaje })
              .eq('id', z.id);
          } catch { }
        }
      }
    }

    // Si por cantidad total de zonas en BD hay menos de k en candidatasEstrictas,
    // completamos con zonas LIBRE / EN_ENFRIAMIENTO no asignadas en el ciclo inmediato anterior
    let poolSeleccion = [...candidatasEstrictas];
    if (poolSeleccion.length < k) {
      const idsYaIncluidos = new Set(poolSeleccion.map(z => z.id));
      const adicionales = todasLasZonas
        .filter(z => !idsYaIncluidos.has(z.id))
        .sort((a, b) => {
          const tA = a.ultimo_patrullaje ? new Date(a.ultimo_patrullaje).getTime() : 0;
          const tB = b.ultimo_patrullaje ? new Date(b.ultimo_patrullaje).getTime() : 0;
          return tA - tB;
        });
      poolSeleccion = [...poolSeleccion, ...adicionales];
    }

    // 2. Calcular score_ajustado = score_gravedad / (1 + (0.02 * minutos_patrullados_hoy))
    const evaluadas = poolSeleccion.map(z => {
      const clasif = clasificarZonaPorScore(z.score_gravedad);
      const score_ajustado = calcularScoreAjustado(z.score_gravedad, z.minutos_patrullados_hoy);
      return {
        ...z,
        nivel_riesgo: clasif.nivel_riesgo,
        score_ajustado,
        uve_objetivo_min: clasif.uve_objetivo_min,
        uve_objetivo_max: clasif.uve_objetivo_max,
        medios_sugeridos: clasif.medios_sugeridos,
        etiqueta_demanda: clasif.etiqueta_demanda,
      };
    });

    // 3. Ordenar de mayor a menor score_ajustado y tomar las k zonas distintas
    evaluadas.sort((a, b) => b.score_ajustado - a.score_ajustado);
    const seleccionadas = evaluadas.slice(0, k);

    // 4. Actualizar su estado a 'ASIGNADA'
    const idsSeleccionados = seleccionadas.map(z => z.id);
    for (const z of seleccionadas) {
      z.estado = 'ASIGNADA';
      const mem = memoryZonasRiesgo.get(z.id);
      if (mem) {
        mem.estado = 'ASIGNADA';
        memoryZonasRiesgo.set(z.id, mem);
      }
    }

    if (idsSeleccionados.length > 0) {
      try {
        await supabaseAdmin
          .from('zonas_riesgo')
          .update({ estado: 'ASIGNADA', updated_at: new Date().toISOString() })
          .in('id', idsSeleccionados);
      } catch { }
    }

    const uveTotalRequeridaMin = Math.round(
      seleccionadas.reduce((acc, z) => acc + z.uve_objetivo_min, 0) * 100
    ) / 100;
    const uveTotalRequeridaMax = Math.round(
      seleccionadas.reduce((acc, z) => acc + z.uve_objetivo_max, 0) * 100
    ) / 100;

    res.json({
      k_solicitado: k,
      k_seleccionadas: seleccionadas.length,
      algoritmo: 'score_ajustado = score_gravedad / (1 + (0.02 * minutos_patrullados_hoy))',
      cooldown_minutos: 90,
      demanda_uve_ciclo: {
        min: uveTotalRequeridaMin,
        max: uveTotalRequeridaMax,
      },
      zonas_asignadas: seleccionadas,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// 3. POST /api/refuerzos/despachar
// ============================================================================
export async function despacharRefuerzosUve(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      patrulla_origen_id,
      uve_requerida,
      latitude,
      longitude,
      patrullas_simulada_extra,
    } = req.body;

    const origenId = patrulla_origen_id ?? req.tacticalUser?.patrol_id ?? req.tacticalUser?.sesion_patrullaje_id;
    const uveReq = Number(uve_requerida);

    if (origenId == null || String(origenId).trim() === '') {
      res.status(400).json({
        error: 'El parámetro patrulla_origen_id es obligatorio.',
        code: 'MISSING_ORIGEN_ID',
      });
      return;
    }

    if (isNaN(uveReq) || uveReq <= 0 || uveReq > 10) {
      res.status(400).json({
        error: 'El parámetro uve_requerida debe ser un valor numérico positivo (ej: 0.5, 1.0, 1.5, 2.0).',
        code: 'INVALID_UVE_REQUERIDA',
      });
      return;
    }

    // 1. Resolver coordenadas de la patrulla solicitante y marcar como SOLICITANDO_REFUERZO
    let latOrigen = latitude != null ? Number(latitude) : null;
    let lonOrigen = longitude != null ? Number(longitude) : null;
    let identificadorOrigen = `Móvil #${origenId}`;

    // Buscar en sesiones_operativas / v_posicion_actual_unidades si es numérico
    const numericOrigenId = Number(origenId);
    if (!isNaN(numericOrigenId) && numericOrigenId > 0) {
      await supabaseAdmin
        .from('sesiones_operativas')
        .update({ estado_operativo: 'OCUPADO_EMERGENCIA' })
        .eq('id_sesion', numericOrigenId);

      const { data: sesionOp } = await supabaseAdmin
        .from('sesiones_operativas')
        .select('id_sesion, identificador_unidad, sesion_patrullaje_id')
        .eq('id_sesion', numericOrigenId)
        .maybeSingle();

      if (sesionOp?.identificador_unidad) {
        identificadorOrigen = sesionOp.identificador_unidad;
      }

      if (latOrigen == null || lonOrigen == null) {
        const { data: pos } = await supabaseAdmin
          .from('v_posicion_actual_unidades')
          .select('latitud, longitud')
          .eq('id_sesion', numericOrigenId)
          .maybeSingle();
        if (pos) {
          latOrigen = Number(pos.latitud);
          lonOrigen = Number(pos.longitud);
        }
      }
    }

    // Marcar en sesiones_patrullaje (si existe por UUID o id_sesion_operativa)
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(origenId));
      if (isUuid) {
        await supabaseAdmin
          .from('sesiones_patrullaje')
          .update({ estado: 'SOLICITANDO_REFUERZO', updated_at: new Date().toISOString() })
          .eq('id', String(origenId));
      } else if (!isNaN(numericOrigenId)) {
        await supabaseAdmin
          .from('sesiones_patrullaje')
          .update({ estado: 'SOLICITANDO_REFUERZO', updated_at: new Date().toISOString() })
          .eq('id_sesion_operativa', numericOrigenId);
      }
    } catch { }

    const memOrigen = memorySesionesUve.get(String(origenId));
    if (memOrigen) {
      memOrigen.estado = 'SOLICITANDO_REFUERZO';
      if (memOrigen.ubicacion_actual && (latOrigen == null || lonOrigen == null)) {
        latOrigen = memOrigen.ubicacion_actual.latitude;
        lonOrigen = memOrigen.ubicacion_actual.longitude;
      }
    }

    // Coordenadas por defecto en Viña del Mar si no tenía fix GPS aún
    const targetLat = latOrigen ?? -33.02229;
    const targetLon = lonOrigen ?? -71.55278;

    // 2. Buscar patrullas activas ('PATRULLANDO' o 'DISPONIBLE')
    interface CandidatoUve {
      id: string | number;
      id_sesion_operativa?: number;
      sesion_patrullaje_id?: string;
      identificador_unidad: string;
      conductor_nombre: string;
      tipo_medio: TipoMedio;
      valor_uve: number;
      lat: number;
      lng: number;
      estado_actual: string;
      es_demo?: boolean;
    }

    const candidatosMap = new Map<string, CandidatoUve>();

    // 2a. Consultar sesiones_operativas reales activas en Supabase
    try {
      const [{ data: sesionesReales }, { data: posiciones }] = await Promise.all([
        supabaseAdmin
          .from('sesiones_operativas')
          .select(`
            id_sesion,
            identificador_unidad,
            tipo_transporte,
            tipo_medio,
            valor_uve,
            estado_operativo,
            rut_conductor,
            conductor:usuarios!rut_conductor(nombre_completo),
            tripulacion:tripulacion_sesion(rut_acompanante)
          `)
          .is('fecha_cierre', null)
          .in('estado_operativo', ['DISPONIBLE', 'PATRULLANDO_ZONA', 'EN_RUTA_HOTSPOT']),
        supabaseAdmin
          .from('v_posicion_actual_unidades')
          .select('id_sesion, latitud, longitud'),
      ]);

      const posMap = new Map<number, { lat: number; lng: number }>();
      for (const p of posiciones ?? []) {
        posMap.set(Number(p.id_sesion), { lat: Number(p.latitud), lng: Number(p.longitud) });
      }

      for (const s of sesionesReales ?? []) {
        if (String(s.id_sesion) === String(origenId)) continue;
        const numComp = Array.isArray(s.tripulacion) ? s.tripulacion.length : 0;
        const calc = validarYCalcularUve(s.tipo_medio || s.tipo_transporte || 'PATRULLA', numComp, false);
        const pos = posMap.get(s.id_sesion) ?? { lat: -33.0185, lng: -71.5450 };
        const condObj = Array.isArray(s.conductor) ? s.conductor[0] : s.conductor;

        candidatosMap.set(`real-${s.id_sesion}`, {
          id: s.id_sesion,
          id_sesion_operativa: s.id_sesion,
          identificador_unidad: s.identificador_unidad || `${calc.tipo_medio}-${s.id_sesion}`,
          conductor_nombre: condObj?.nombre_completo ?? s.rut_conductor,
          tipo_medio: (s.tipo_medio as TipoMedio) || calc.tipo_medio,
          valor_uve: Number(s.valor_uve ?? calc.valor_uve),
          lat: pos.lat,
          lng: pos.lng,
          estado_actual: s.estado_operativo === 'DISPONIBLE' ? 'DISPONIBLE' : 'PATRULLANDO',
        });
      }
    } catch (e) {
      console.warn('[DESPACHO UVE] Fallback leyendo sesiones_operativas:', e);
    }

    // 2b. Consultar sesiones_patrullaje en memoria / tabla sesiones_patrullaje
    for (const [id, sp] of memorySesionesUve.entries()) {
      if (id === String(origenId)) continue;
      if (!['DISPONIBLE', 'PATRULLANDO'].includes(sp.estado)) continue;
      const key = sp.id_sesion_operativa ? `real-${sp.id_sesion_operativa}` : `uve-${id}`;
      if (!candidatosMap.has(key)) {
        candidatosMap.set(key, {
          id: sp.id,
          id_sesion_operativa: sp.id_sesion_operativa,
          sesion_patrullaje_id: sp.id,
          identificador_unidad: sp.identificador_unidad || `${sp.tipo_medio}-${sp.id.slice(0, 4).toUpperCase()}`,
          conductor_nombre: sp.lider_id,
          tipo_medio: sp.tipo_medio,
          valor_uve: sp.valor_uve,
          lat: sp.ubicacion_actual?.latitude ?? -33.0205,
          lng: sp.ubicacion_actual?.longitude ?? -71.5495,
          estado_actual: sp.estado,
        });
      }
    }

    // 2c. Incluir patrullas simuladas enviadas desde el Dashboard (si existen)
    if (Array.isArray(patrullas_simulada_extra)) {
      for (const p of patrullas_simulada_extra) {
        if (!p || String(p.id) === String(origenId)) continue;
        const calc = validarYCalcularUve(p.tipo_medio || p.tipo || 'RPD', p.acompanantes ?? 1, false);
        candidatosMap.set(`demo-${p.id}`, {
          id: p.id,
          identificador_unidad: p.nombre || p.identificador_unidad || `${calc.tipo_medio}-DEMO`,
          conductor_nombre: 'Dotación Táctica Cuadrante',
          tipo_medio: calc.tipo_medio,
          valor_uve: Number(p.valor_uve ?? calc.valor_uve),
          lat: Number(p.lat) || -33.0245,
          lng: Number(p.lng) || -71.5518,
          estado_actual: p.estado || 'DISPONIBLE',
          es_demo: true,
        });
      }
    }

    // 3. Calcular distancia geodésica (ST_Distance) y ETA para cada candidato
    // Regla SOS: solo responden unidades desde Moto en adelante (RPT, RPD, FZ, MTT).
    // Bicicletas (CB) e Infantería (INF) NO actúan como refuerzo SOS (aunque sí pueden pedirlo).
    const candidatosConEta = Array.from(candidatosMap.values())
      .filter(c => c.tipo_medio !== 'CB' && c.tipo_medio !== 'INF')
      .map(c => {
        const distancia_m = calcularDistanciaMetros(targetLat, targetLon, c.lat, c.lng);
        const { eta_segundos, eta_minutos } = calcularEtaPatrulla(distancia_m, c.tipo_medio);
        return {
          ...c,
          distancia_m,
          distancia_km: Math.round((distancia_m / 1000) * 100) / 100,
          eta_segundos,
          eta_minutos,
        };
      });

    // 4. Ordenar priorizando Patrullas y Furgones (RPT, FZ, RPD) por menor ETA,
    //    dejando las Motos (MTT) para rellenar/completar U.V.E. si es necesario
    candidatosConEta.sort((a, b) => {
      const aEsMoto = a.tipo_medio === 'MTT' ? 1 : 0;
      const bEsMoto = b.tipo_medio === 'MTT' ? 1 : 0;
      if (aEsMoto !== bEsMoto) return aEsMoto - bEsMoto;
      return a.eta_segundos - b.eta_segundos;
    });

    const seleccionadas: typeof candidatosConEta = [];
    let uveAcumulada = 0;

    for (const cand of candidatosConEta) {
      if (uveAcumulada + cand.valor_uve <= uveReq + 0.001) {
        seleccionadas.push(cand);
        uveAcumulada = Math.round((uveAcumulada + cand.valor_uve) * 100) / 100;
        if (Math.abs(uveAcumulada - uveReq) <= 0.001) break;
      }
    }

    // 5. Actualizar estado de las unidades seleccionadas a 'EN_REFUERZO' y emitir evento
    const unidadesAsignadasRespuesta = [];
    for (const u of seleccionadas) {
      if (u.sesion_patrullaje_id) {
        const mem = memorySesionesUve.get(u.sesion_patrullaje_id);
        if (mem) mem.estado = 'EN_REFUERZO';
        try {
          await supabaseAdmin
            .from('sesiones_patrullaje')
            .update({ estado: 'EN_REFUERZO', updated_at: new Date().toISOString() })
            .eq('id', u.sesion_patrullaje_id);
        } catch { }
      }

      if (u.id_sesion_operativa) {
        try {
          await supabaseAdmin
            .from('sesiones_operativas')
            .update({ estado_operativo: 'EN_RUTA_HOTSPOT' })
            .eq('id_sesion', u.id_sesion_operativa);

          await supabaseAdmin
            .from('asignaciones_tacticas')
            .insert({
              id_sesion: u.id_sesion_operativa,
              origen_asignacion: 'REFUERZO_SOS',
              centro_lat: targetLat,
              centro_lng: targetLon,
              radio_m: 60,
              nombre_zona: `REFUERZO U.V.E. (${identificadorOrigen})`,
              instrucciones: `[ETA:${Math.ceil(u.eta_minutos)}] Código Rojo: Despacho automático por demanda de +${uveReq.toFixed(1)} U.V.E. Aporte unidad: ${u.valor_uve.toFixed(2)} U.V.E. (${u.tipo_medio}).`,
              estado_mision: 'PENDIENTE',
              hora_despacho: new Date().toISOString(),
            });

          await supabaseAdmin
            .from('mensajes')
            .insert({
              id_sesion: u.id_sesion_operativa,
              remitente: 'SUPERVISOR',
              texto: `🚨 DESPACHO DE REFUERZO U.V.E.: Diríjase de inmediato en apoyo a ${identificadorOrigen}. ETA estimado: ${u.eta_minutos} min (${u.distancia_m}m). Demanda solicitada: +${uveReq.toFixed(1)} U.V.E.`,
              fecha: new Date().toISOString(),
              leido: false,
            });
        } catch (err) {
          console.warn('[DESPACHO UVE] Error actualizando asignación de refuerzo:', err);
        }
      }

      unidadesAsignadasRespuesta.push({
        id: u.id,
        id_sesion_operativa: u.id_sesion_operativa,
        identificador_unidad: u.identificador_unidad,
        conductor_nombre: u.conductor_nombre,
        tipo_medio: u.tipo_medio,
        valor_uve: u.valor_uve,
        distancia_m: u.distancia_m,
        distancia_km: u.distancia_km,
        eta_segundos: u.eta_segundos,
        eta_minutos: u.eta_minutos,
        estado: 'EN_REFUERZO' as const,
        es_demo: u.es_demo ?? false,
      });
    }

    // Registrar o actualizar la alerta de emergencia en Supabase para notificar por Realtime
    let alertaId: number | null = null;
    if (!isNaN(numericOrigenId) && numericOrigenId > 0) {
      try {
        const { data: existingAlert } = await supabaseAdmin
          .from('alertas_emergencia')
          .select('id_emergencia')
          .eq('id_sesion_solicitante', numericOrigenId)
          .eq('estado', 'ACTIVA')
          .order('fecha_alerta', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingAlert) {
          alertaId = existingAlert.id_emergencia;
        } else {
          const { data: nuevaAlerta } = await supabaseAdmin
            .from('alertas_emergencia')
            .insert({
              id_sesion_solicitante: numericOrigenId,
              geom_emergencia: `SRID=4326;POINT(${targetLon} ${targetLat})`,
              estado: 'ACTIVA',
              fecha_alerta: new Date().toISOString(),
            })
            .select('id_emergencia')
            .single();
          alertaId = nuevaAlerta?.id_emergencia ?? null;
        }
      } catch { }
    }

    const registroDespacho = {
      id_despacho: uuidv4(),
      alerta_id: alertaId,
      patrulla_origen_id: origenId,
      identificador_origen: identificadorOrigen,
      estado_patrulla_origen: 'SOLICITANDO_REFUERZO',
      uve_requerida: Number(uveReq.toFixed(2)),
      uve_acumulada: Number(uveAcumulada.toFixed(2)),
      cobertura_completa: uveAcumulada >= uveReq,
      coordenadas_emergencia: { latitude: targetLat, longitude: targetLon },
      unidades_asignadas: unidadesAsignadasRespuesta,
      timestamp: new Date().toISOString(),
    };

    memoryHistorialDespachosRefuerzo.unshift(registroDespacho);
    if (memoryHistorialDespachosRefuerzo.length > 30) {
      memoryHistorialDespachosRefuerzo.pop();
    }

    res.status(200).json({
      message: `🚨 Despacho de refuerzos U.V.E. ejecutado (${uveAcumulada.toFixed(2)} / ${uveReq.toFixed(2)} U.V.E.)`,
      ...registroDespacho,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// 4. ENDPOINTS COMPLEMENTARIOS PARA DASHBOARD WEB Y APP MÓVIL
// ============================================================================

/**
 * GET /api/zonas/riesgo
 * Lista todas las zonas de riesgo con su score_gravedad, nivel_riesgo, polígono y delitos
 */
export async function listarZonasRiesgo(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const zonas = await obtenerZonasRiesgoSincronizadas();
    res.json({
      catalogo_gravedad: CATALOGO_GRAVEDAD_DELITOS,
      zonas,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/zonas/riesgo
 * Crea o actualiza una zona de riesgo con polígono PostGIS y delitos asociados
 */
export async function guardarZonaRiesgo(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      id,
      nombre,
      direccion,
      cuadrante_id,
      poligono,
      centro_lat,
      centro_lng,
      radio_m,
      estado,
      minutos_patrullados_hoy,
    } = req.body;

    if (!nombre || !String(nombre).trim()) {
      res.status(400).json({ error: 'El nombre de la zona es obligatorio.', code: 'MISSING_NAME' });
      return;
    }

    const lat = Number(centro_lat) || -33.01840;
    const lng = Number(centro_lng) || -71.51398;
    const radio = Number(radio_m) || 160;

    const vertices: Array<{ lat: number; lng: number }> =
      Array.isArray(poligono) && poligono.length >= 3
        ? poligono.map((p: any) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
        : generarPoligonoCircular(lat, lng, radio, 12);

    // Calcular centroide desde los vértices si se dibujó un polígono personalizado
    const calcLat = vertices.reduce((acc, v) => acc + v.lat, 0) / vertices.length;
    const calcLng = vertices.reduce((acc, v) => acc + v.lng, 0) / vertices.length;

    const zonaId = id && String(id).trim() ? String(id).trim() : uuidv4();
    const existente = memoryZonasRiesgo.get(zonaId);
    const delitosActuales = existente?.delitos ?? [];
    const scoreActual = delitosActuales.reduce((sum, d) => sum + Number(d.categoria_peso), 0);
    const clasif = clasificarZonaPorScore(scoreActual);

    const nuevaZona: ZonaRiesgo = {
      id: zonaId,
      id_zona_patrullaje: existente?.id_zona_patrullaje ?? null,
      nombre: String(nombre).trim(),
      direccion: direccion ? String(direccion).trim() : 'Sector Operativo Viña del Mar',
      cuadrante_id: cuadrante_id || DEFAULT_CUADRANTE_ID,
      poligono: vertices,
      centro_lat: Number(calcLat.toFixed(6)),
      centro_lng: Number(calcLng.toFixed(6)),
      radio_m: radio,
      score_gravedad: clasif.score_gravedad,
      score_ajustado: calcularScoreAjustado(
        clasif.score_gravedad,
        minutos_patrullados_hoy ?? existente?.minutos_patrullados_hoy ?? 0
      ),
      nivel_riesgo: clasif.nivel_riesgo,
      estado: (estado as EstadoZonaRiesgo) ?? existente?.estado ?? 'LIBRE',
      minutos_patrullados_hoy: Number(minutos_patrullados_hoy ?? existente?.minutos_patrullados_hoy ?? 0),
      ultimo_patrullaje: existente?.ultimo_patrullaje ?? null,
      uve_objetivo_min: clasif.uve_objetivo_min,
      uve_objetivo_max: clasif.uve_objetivo_max,
      medios_sugeridos: clasif.medios_sugeridos,
      etiqueta_demanda: clasif.etiqueta_demanda,
      delitos: delitosActuales,
    };

    memoryZonasRiesgo.set(zonaId, nuevaZona);

    // Persistir también en Supabase (zonas_riesgo y zonas_patrullaje)
    try {
      const wkt = coordsToPolygonWkt(vertices);
      await supabaseAdmin
        .from('zonas_riesgo')
        .upsert({
          id: zonaId,
          nombre: nuevaZona.nombre,
          direccion: nuevaZona.direccion,
          cuadrante_id: nuevaZona.cuadrante_id,
          geom: wkt,
          score_gravedad: nuevaZona.score_gravedad,
          nivel_riesgo: nuevaZona.nivel_riesgo,
          estado: nuevaZona.estado,
          minutos_patrullados_hoy: nuevaZona.minutos_patrullados_hoy,
          updated_at: new Date().toISOString(),
        });
    } catch { }

    res.status(id ? 200 : 201).json({
      message: id ? 'Zona de riesgo actualizada' : 'Zona de riesgo creada',
      zona: nuevaZona,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/zonas/riesgo/:id
 */
export async function eliminarZonaRiesgo(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    memoryZonasRiesgo.delete(id);
    try {
      await supabaseAdmin.from('zonas_riesgo').delete().eq('id', id);
    } catch { }
    res.json({ ok: true, id });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/zonas/:id/delitos
 * Registra un delito en la zona y recalcula automáticamente score_gravedad y nivel_riesgo
 */
export async function registrarDelitoEnZona(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id: zonaId } = req.params;
    const { tipo_delito, categoria_peso } = req.body;

    const peso = Number(categoria_peso);
    if (!PESOS_DELITO_VALIDOS.includes(peso as any)) {
      res.status(400).json({
        error: 'El parámetro categoria_peso debe ser uno de los valores calibrados: 50, 20, 10, 5, 2, 1.',
        code: 'INVALID_CATEGORIA_PESO',
        catalogo: CATALOGO_GRAVEDAD_DELITOS,
      });
      return;
    }

    const catConfig = CATALOGO_GRAVEDAD_DELITOS.find(c => c.peso === peso);
    const nombreDelito = (tipo_delito && String(tipo_delito).trim())
      ? String(tipo_delito).trim()
      : catConfig?.categoria ?? 'Delito registrado';

    await obtenerZonasRiesgoSincronizadas();
    let zona = memoryZonasRiesgo.get(zonaId);
    if (!zona) {
      res.status(404).json({ error: 'Zona de riesgo no encontrada.', code: 'ZONA_NOT_FOUND' });
      return;
    }

    const nuevoDelito: DelitoRegistro = {
      id: uuidv4(),
      zona_id: zonaId,
      tipo_delito: nombreDelito,
      categoria_peso: peso as 50 | 20 | 10 | 5 | 2 | 1,
      fecha_hora: new Date().toISOString(),
    };

    // Insertar en Supabase si la tabla existe (el trigger SQL recalcula score_gravedad y nivel_riesgo)
    try {
      const { data: dbDelito, error } = await supabaseAdmin
        .from('delitos_registro')
        .insert({
          id: nuevoDelito.id,
          zona_id: zonaId,
          tipo_delito: nuevoDelito.tipo_delito,
          categoria_peso: nuevoDelito.categoria_peso,
          fecha_hora: nuevoDelito.fecha_hora,
        })
        .select()
        .single();
      if (!error && dbDelito) {
        nuevoDelito.id = dbDelito.id;
      }
    } catch { }

    // Recálculo determinístico en memoria (espejo exacto del Trigger SQL)
    const listaDelitos = [nuevoDelito, ...(zona.delitos ?? [])];
    const totalScore = listaDelitos.reduce((sum, d) => sum + Number(d.categoria_peso), 0);
    const clasif = clasificarZonaPorScore(totalScore);

    zona = {
      ...zona,
      score_gravedad: clasif.score_gravedad,
      score_ajustado: calcularScoreAjustado(clasif.score_gravedad, zona.minutos_patrullados_hoy),
      nivel_riesgo: clasif.nivel_riesgo,
      uve_objetivo_min: clasif.uve_objetivo_min,
      uve_objetivo_max: clasif.uve_objetivo_max,
      medios_sugeridos: clasif.medios_sugeridos,
      etiqueta_demanda: clasif.etiqueta_demanda,
      delitos: listaDelitos,
    };

    memoryZonasRiesgo.set(zonaId, zona);

    res.status(201).json({
      message: 'Delito registrado. Score de gravedad y nivel de riesgo recalculados automáticamente.',
      delito: nuevoDelito,
      zona,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/zonas/:id/delitos/:delitoId
 * Elimina un delito registrado y recalcula el score_gravedad y nivel_riesgo de la zona
 */
export async function eliminarDelitoDeZona(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id: zonaId, delitoId } = req.params;

    try {
      await supabaseAdmin.from('delitos_registro').delete().eq('id', delitoId);
    } catch { }

    const zona = memoryZonasRiesgo.get(zonaId);
    if (!zona) {
      res.status(404).json({ error: 'Zona no encontrada' });
      return;
    }

    const listaDelitos = (zona.delitos ?? []).filter(d => d.id !== delitoId);
    const totalScore = listaDelitos.reduce((sum, d) => sum + Number(d.categoria_peso), 0);
    const clasif = clasificarZonaPorScore(totalScore);

    const actualizada: ZonaRiesgo = {
      ...zona,
      score_gravedad: clasif.score_gravedad,
      score_ajustado: calcularScoreAjustado(clasif.score_gravedad, zona.minutos_patrullados_hoy),
      nivel_riesgo: clasif.nivel_riesgo,
      uve_objetivo_min: clasif.uve_objetivo_min,
      uve_objetivo_max: clasif.uve_objetivo_max,
      medios_sugeridos: clasif.medios_sugeridos,
      etiqueta_demanda: clasif.etiqueta_demanda,
      delitos: listaDelitos,
    };

    memoryZonasRiesgo.set(zonaId, actualizada);
    res.json({ message: 'Delito eliminado y score recalculado', zona: actualizada });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/patrulla/balance-uve
 * Calcula y retorna el Balance de Capacidad U.V.E. en tiempo real del cuadrante
 */
export async function obtenerBalanceUve(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { data: sesionesActivas } = await supabaseAdmin
      .from('sesiones_operativas')
      .select(`
        id_sesion,
        identificador_unidad,
        tipo_transporte,
        tipo_medio,
        valor_uve,
        estado_operativo,
        rut_conductor,
        conductor:usuarios!rut_conductor(nombre_completo, grado_cargo),
        tripulacion:tripulacion_sesion(rut_acompanante)
      `)
      .is('fecha_cierre', null)
      .not('imei_simcard', 'like', 'DEMO-%');

    let ofertaTotal = 0;
    let uveComprometidaZonas = 0;
    let uveEnReserva = 0;
    let uveEnRefuerzo = 0;

    const desgloseUnidades = (sesionesActivas ?? []).map((s: any) => {
      const numComp = Array.isArray(s.tripulacion) ? s.tripulacion.length : 0;
      const calc = validarYCalcularUve(s.tipo_medio || s.tipo_transporte || 'PATRULLA', numComp, false);
      const uve = Number(s.valor_uve ?? calc.valor_uve);
      const medio = (s.tipo_medio as TipoMedio) || calc.tipo_medio;

      ofertaTotal += uve;
      if (s.estado_operativo === 'DISPONIBLE') {
        uveEnReserva += uve;
      } else if (s.estado_operativo === 'OCUPADO_EMERGENCIA') {
        uveEnRefuerzo += uve;
      } else {
        uveComprometidaZonas += uve;
      }

      const condObj = Array.isArray(s.conductor) ? s.conductor[0] : s.conductor;
      return {
        id_sesion: s.id_sesion,
        identificador_unidad: s.identificador_unidad,
        conductor: condObj?.nombre_completo ?? s.rut_conductor,
        tipo_medio: medio,
        valor_uve: Number(uve.toFixed(2)),
        dotacion_total: numComp + 1,
        estado_operativo: s.estado_operativo,
      };
    });

    const zonas = await obtenerZonasRiesgoSincronizadas();
    const zonasAsignadas = zonas.filter(z => z.estado === 'ASIGNADA');
    const demandaZonasActivas = Math.round(
      zonasAsignadas.reduce((acc, z) => acc + z.uve_objetivo_min, 0) * 100
    ) / 100;

    res.json({
      oferta_total_uve: Number(ofertaTotal.toFixed(2)),
      uve_comprometida_zonas: Number(uveComprometidaZonas.toFixed(2)),
      uve_en_reserva: Number(uveEnReserva.toFixed(2)),
      uve_en_refuerzo: Number(uveEnRefuerzo.toFixed(2)),
      demanda_zonas_activas_uve: demandaZonasActivas,
      unidades_activas_count: desgloseUnidades.length,
      unidades: desgloseUnidades,
      historial_refuerzos: memoryHistorialDespachosRefuerzo.slice(0, 10),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Evaluador espacial ST_Contains para telemetría de patrulla
 * Invoca la función SQL `actualizar_telemetria_patrulla` si existe y evalúa polígonos de zonas_riesgo
 */
export async function evaluarGeocercaZonasRiesgo(
  sesionIdentificador: string | number,
  lat: number,
  lon: number
): Promise<{
  en_zona_riesgo: boolean;
  estado_sesion: string;
  zona: {
    id: string;
    nombre: string;
    nivel_riesgo: 'ALTO' | 'MEDIO' | 'BAJO';
    score_gravedad: number;
    minutos_patrullados_hoy: number;
  } | null;
}> {
  // 1. Intentar invocar RPC PostGIS `actualizar_telemetria_patrulla` si es UUID
  const strId = String(sesionIdentificador);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(strId);

  if (isUuid) {
    try {
      const { data: rpcRes, error } = await supabaseAdmin.rpc('actualizar_telemetria_patrulla', {
        p_sesion_id: strId,
        p_lat: lat,
        p_lon: lon,
      });
      if (!error && rpcRes && rpcRes.ok) {
        return {
          en_zona_riesgo: !!rpcRes.en_zona_riesgo,
          estado_sesion: rpcRes.estado_sesion ?? (rpcRes.en_zona_riesgo ? 'EN_ZONA_RIESGO' : 'PATRULLANDO'),
          zona: rpcRes.zona ?? null,
        };
      }
    } catch { }
  }

  // 2. Evaluar geométricamente contra todas las zonas de riesgo asignadas o activas (ST_Contains exacto)
  const zonas = await obtenerZonasRiesgoSincronizadas();
  const candidatas = zonas.filter(z => z.estado === 'ASIGNADA' || z.estado === 'LIBRE');

  for (const z of candidatas) {
    const insidePolygon = puntoEnPoligono(lat, lon, z.poligono);
    const distCentro = calcularDistanciaMetros(lat, lon, z.centro_lat, z.centro_lng);
    const insideRadius = distCentro <= (z.radio_m || 160);

    if (insidePolygon || insideRadius) {
      // Si coincide con una zona asignada (o la más cercana si está patrullándola)
      z.minutos_patrullados_hoy = (z.minutos_patrullados_hoy || 0) + 1;
      z.ultimo_patrullaje = new Date().toISOString();
      z.score_ajustado = calcularScoreAjustado(z.score_gravedad, z.minutos_patrullados_hoy);
      memoryZonasRiesgo.set(z.id, z);

      try {
        await supabaseAdmin
          .from('zonas_riesgo')
          .update({
            minutos_patrullados_hoy: z.minutos_patrullados_hoy,
            ultimo_patrullaje: z.ultimo_patrullaje,
            updated_at: new Date().toISOString(),
          })
          .eq('id', z.id);
      } catch { }

      return {
        en_zona_riesgo: true,
        estado_sesion: 'EN_ZONA_RIESGO',
        zona: {
          id: z.id,
          nombre: z.nombre,
          nivel_riesgo: z.nivel_riesgo,
          score_gravedad: z.score_gravedad,
          minutos_patrullados_hoy: z.minutos_patrullados_hoy,
          centro_lat: z.centro_lat,
          centro_lng: z.centro_lng,
          radio_m: z.radio_m || 160,
        } as any,
      };
    }
  }

  return {
    en_zona_riesgo: false,
    estado_sesion: 'PATRULLANDO',
    zona: null,
  };
}

