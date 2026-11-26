// ============================================================================
// S.I.G.O. — Reglas de Negocio U.V.E., Calibración de Zonas y Utilidades Espaciales
// ============================================================================

export type TipoMedio = 'RPT' | 'RPD' | 'FZ' | 'MTT' | 'CB' | 'INF';

export type EstadoSesionPatrullaje =
  | 'DISPONIBLE'
  | 'PATRULLANDO'
  | 'EN_ZONA_RIESGO'
  | 'SOLICITANDO_REFUERZO'
  | 'EN_REFUERZO';

export type NivelRiesgoZona = 'ALTO' | 'MEDIO' | 'BAJO';
export type EstadoZonaRiesgo = 'LIBRE' | 'ASIGNADA' | 'EN_ENFRIAMIENTO';

export interface ConfigMedioUve {
  codigo: TipoMedio;
  nombre: string;
  valor_uve: number;
  min_acompanantes: number;
  max_acompanantes: number;
  velocidad_promedio_kmh: number;
  transporte_base: 'PATRULLA' | 'FURGON_Z' | 'MOTO' | 'BICICLETA' | 'INFANTERIA';
  descripcion_dotacion: string;
}

export const CONFIG_MEDIOS_UVE: Record<TipoMedio, ConfigMedioUve> = {
  RPT: {
    codigo: 'RPT',
    nombre: 'Radiopatrulla (3 Tripulantes)',
    valor_uve: 1.00,
    min_acompanantes: 2,
    max_acompanantes: 2,
    velocidad_promedio_kmh: 45,
    transporte_base: 'PATRULLA',
    descripcion_dotacion: 'Líder + 2 acompañantes (3 efectivos)',
  },
  RPD: {
    codigo: 'RPD',
    nombre: 'Radiopatrulla (2 Tripulantes)',
    valor_uve: 0.80,
    min_acompanantes: 1,
    max_acompanantes: 1,
    velocidad_promedio_kmh: 45,
    transporte_base: 'PATRULLA',
    descripcion_dotacion: 'Líder + 1 acompañante (2 efectivos)',
  },
  FZ: {
    codigo: 'FZ',
    nombre: 'Furgón Z',
    valor_uve: 1.00,
    min_acompanantes: 1,
    max_acompanantes: 2,
    velocidad_promedio_kmh: 42,
    transporte_base: 'FURGON_Z',
    descripcion_dotacion: 'Mínimo obligatorio 2 tripulantes (Líder + 1 o 2 acompañantes)',
  },
  MTT: {
    codigo: 'MTT',
    nombre: 'Moto Todo Terreno',
    valor_uve: 0.45,
    min_acompanantes: 0,
    max_acompanantes: 0,
    velocidad_promedio_kmh: 52,
    transporte_base: 'MOTO',
    descripcion_dotacion: 'Líder individual (1 efectivo)',
  },
  CB: {
    codigo: 'CB',
    nombre: 'Carabinero en Bicicleta',
    valor_uve: 0.30,
    min_acompanantes: 0,
    max_acompanantes: 1,
    velocidad_promedio_kmh: 20,
    transporte_base: 'BICICLETA',
    descripcion_dotacion: 'Pareja de servicio (Ciclo patrulla)',
  },
  INF: {
    codigo: 'INF',
    nombre: 'Carabinero a pie / Infantería',
    valor_uve: 0.20,
    min_acompanantes: 0,
    max_acompanantes: 1,
    velocidad_promedio_kmh: 6,
    transporte_base: 'INFANTERIA',
    descripcion_dotacion: 'Pareja de servicio (Infantería)',
  },
};

export interface ValidacionUveResult {
  valid: boolean;
  error?: string;
  code?: string;
  tipo_medio: TipoMedio;
  valor_uve: number;
  transporte_base: 'PATRULLA' | 'FURGON_Z' | 'MOTO' | 'BICICLETA' | 'INFANTERIA';
  dotacion_total: number;
}

/**
 * Valida las reglas de negocio de tripulación y calcula dinámicamente el valor U.V.E.
 */
export function validarYCalcularUve(
  rawTipo: string,
  cantidadAcompanantes: number,
  strictMode = true
): ValidacionUveResult {
  const upper = (rawTipo || '').trim().toUpperCase();

  // 1. Furgón Z (FZ / FURGON_Z)
  if (upper === 'FZ' || upper === 'FURGON_Z' || upper === 'FURGON') {
    if (cantidadAcompanantes < 1) {
      return {
        valid: false,
        error: 'Furgón Z (FZ) requiere un MÍNIMO obligatorio de 2 tripulantes (Líder + al menos 1 acompañante).',
        code: 'FZ_MIN_CREW_REQUIRED',
        tipo_medio: 'FZ',
        valor_uve: 1.00,
        transporte_base: 'FURGON_Z',
        dotacion_total: cantidadAcompanantes + 1,
      };
    }
    if (cantidadAcompanantes > 2) {
      return {
        valid: false,
        error: 'Furgón Z (FZ) permite un máximo de 3 tripulantes (Líder + 2 acompañantes).',
        code: 'FZ_MAX_CREW_EXCEEDED',
        tipo_medio: 'FZ',
        valor_uve: 1.00,
        transporte_base: 'FURGON_Z',
        dotacion_total: cantidadAcompanantes + 1,
      };
    }
    return {
      valid: true,
      tipo_medio: 'FZ',
      valor_uve: 1.00,
      transporte_base: 'FURGON_Z',
      dotacion_total: cantidadAcompanantes + 1,
    };
  }

  // 2. Radiopatrulla 3 tripulantes explícito (RPT)
  if (upper === 'RPT') {
    if (strictMode && cantidadAcompanantes !== 2) {
      return {
        valid: false,
        error: 'Radiopatrulla RPT exige exactamente Líder + 2 acompañantes (3 tripulantes en total).',
        code: 'RPT_CREW_MISMATCH',
        tipo_medio: 'RPT',
        valor_uve: 1.00,
        transporte_base: 'PATRULLA',
        dotacion_total: cantidadAcompanantes + 1,
      };
    }
    return {
      valid: true,
      tipo_medio: 'RPT',
      valor_uve: 1.00,
      transporte_base: 'PATRULLA',
      dotacion_total: cantidadAcompanantes + 1,
    };
  }

  // 3. Radiopatrulla 2 tripulantes explícito (RPD)
  if (upper === 'RPD') {
    if (strictMode && cantidadAcompanantes !== 1) {
      return {
        valid: false,
        error: 'Radiopatrulla RPD exige exactamente Líder + 1 acompañante (2 tripulantes en total).',
        code: 'RPD_CREW_MISMATCH',
        tipo_medio: 'RPD',
        valor_uve: 0.80,
        transporte_base: 'PATRULLA',
        dotacion_total: cantidadAcompanantes + 1,
      };
    }
    return {
      valid: true,
      tipo_medio: 'RPD',
      valor_uve: 0.80,
      transporte_base: 'PATRULLA',
      dotacion_total: cantidadAcompanantes + 1,
    };
  }

  // 4. Radiopatrulla genérico (PATRULLA / RADIO_PATRULLA / AUTO) -> deriva RPT o RPD según dotación
  if (upper === 'PATRULLA' || upper === 'RADIO_PATRULLA' || upper === 'AUTO') {
    if (cantidadAcompanantes > 2) {
      return {
        valid: false,
        error: 'Radiopatrulla permite un máximo de 2 acompañantes (3 tripulantes en total).',
        code: 'PATROL_MAX_COMPANIONS',
        tipo_medio: 'RPT',
        valor_uve: 1.00,
        transporte_base: 'PATRULLA',
        dotacion_total: cantidadAcompanantes + 1,
      };
    }
    if (strictMode && cantidadAcompanantes < 1) {
      return {
        valid: false,
        error: 'Radiopatrulla requiere al menos 1 acompañante (RPD: 2 tripulantes o RPT: 3 tripulantes).',
        code: 'PATROL_MIN_COMPANIONS',
        tipo_medio: 'RPD',
        valor_uve: 0.80,
        transporte_base: 'PATRULLA',
        dotacion_total: 1,
      };
    }
    const esRpt = cantidadAcompanantes >= 2;
    return {
      valid: true,
      tipo_medio: esRpt ? 'RPT' : 'RPD',
      valor_uve: esRpt ? 1.00 : 0.80,
      transporte_base: 'PATRULLA',
      dotacion_total: cantidadAcompanantes + 1,
    };
  }

  // 5. Moto Todo Terreno (MTT / MOTO)
  if (upper === 'MTT' || upper === 'MOTO') {
    if (cantidadAcompanantes > 0) {
      return {
        valid: false,
        error: 'Moto Todo Terreno (MTT) opera con líder individual (sin acompañantes).',
        code: 'MTT_NO_COMPANIONS',
        tipo_medio: 'MTT',
        valor_uve: 0.45,
        transporte_base: 'MOTO',
        dotacion_total: 1,
      };
    }
    return {
      valid: true,
      tipo_medio: 'MTT',
      valor_uve: 0.45,
      transporte_base: 'MOTO',
      dotacion_total: 1,
    };
  }

  // 6. Carabinero en Bicicleta (CB / BICICLETA)
  if (upper === 'CB' || upper === 'BICICLETA') {
    if (cantidadAcompanantes > 1) {
      return {
        valid: false,
        error: 'Carabinero en Bicicleta (CB) opera en pareja de servicio (máximo 1 acompañante).',
        code: 'CB_MAX_COMPANIONS',
        tipo_medio: 'CB',
        valor_uve: 0.30,
        transporte_base: 'BICICLETA',
        dotacion_total: cantidadAcompanantes + 1,
      };
    }
    return {
      valid: true,
      tipo_medio: 'CB',
      valor_uve: 0.30,
      transporte_base: 'BICICLETA',
      dotacion_total: Math.max(cantidadAcompanantes + 1, 2),
    };
  }

  // 7. Carabinero a pie / Infantería (INF / INFANTERIA / PIE)
  if (upper === 'INF' || upper === 'INFANTERIA' || upper === 'PIE') {
    if (cantidadAcompanantes > 1) {
      return {
        valid: false,
        error: 'Infantería (INF) opera en pareja de servicio (máximo 1 acompañante).',
        code: 'INF_MAX_COMPANIONS',
        tipo_medio: 'INF',
        valor_uve: 0.20,
        transporte_base: 'INFANTERIA',
        dotacion_total: cantidadAcompanantes + 1,
      };
    }
    return {
      valid: true,
      tipo_medio: 'INF',
      valor_uve: 0.20,
      transporte_base: 'INFANTERIA',
      dotacion_total: Math.max(cantidadAcompanantes + 1, 2),
    };
  }

  return {
    valid: false,
    error: `Tipo de medio no reconocido: ${rawTipo}. Valores válidos: RPT, RPD, FZ, MTT, CB, INF.`,
    code: 'INVALID_TIPO_MEDIO',
    tipo_medio: 'INF',
    valor_uve: 0.20,
    transporte_base: 'INFANTERIA',
    dotacion_total: 1,
  };
}

/**
 * Resuelve el TipoMedio efectivo ('RPT' | 'RPD' | 'FZ' | 'MTT' | 'CB' | 'INF')
 * en función del código/transporte y la cantidad de acompañantes, aceptando firma
 * directa (rawTipo, cantidadAcompanantes) o firma de sesión (rawTipo, tipoTransporte, cantidadAcompanantes, identificadorUnidad).
 */
export function resolverTipoMedio(
  rawTipo?: string | null,
  arg2?: number | string | null,
  arg3?: number | null,
  arg4?: string | null
): TipoMedio {
  if (typeof arg2 === 'number' || arg2 === undefined) {
    const res = validarYCalcularUve(rawTipo || 'PATRULLA', arg2 ?? 1, false);
    return res.tipo_medio;
  }
  const numComp = typeof arg3 === 'number' ? arg3 : 0;
  const ident = (arg4 || '').trim().toUpperCase();
  const esFz = ident.startsWith('FZ') || arg2 === 'FURGON_Z' || rawTipo === 'FZ';
  const base = esFz ? 'FZ' : (rawTipo || arg2 || 'PATRULLA');
  const res = validarYCalcularUve(base, numComp, false);
  return res.tipo_medio;
}

/**
 * Compensación geodésica Mercator: convierte un radio en metros a píxeles de pantalla
 * en función de la latitud y el nivel de zoom del mapa.
 */
export function metersToPx(meters: number, lat: number, zoom: number): number {
  const mpp = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  return Math.max(14, Math.min(75, meters / mpp));
}

/**
 * Decodificador binario PostGIS EWKB / WKB (hex) a coordenadas { lat, lng }
 * sin pérdida de precisión decimal IEEE-754 Float64.
 */
export function parseEwkbPoint(hex: string): { lat: number; lng: number } | null {
  try {
    if (!hex || typeof hex !== 'string' || hex.length < 42) return null;
    const clean = hex.trim();
    if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(clean)) return null;
    const bytes = clean.match(/.{2}/g);
    if (!bytes) return null;
    const buf = new Uint8Array(bytes.map(h => parseInt(h, 16)));
    const view = new DataView(buf.buffer);
    const isLE = buf[0] === 1;
    const wkbType = view.getUint32(1, isLE);
    const hasSrid = (wkbType & 0x20000000) !== 0;
    const geomBaseType = wkbType & 0xff;
    if (geomBaseType !== 1) return null; // Solo POINT (1)
    const offset = hasSrid ? 9 : 5;
    if (buf.byteLength < offset + 16) return null;
    const lng = view.getFloat64(offset, isLE);
    const lat = view.getFloat64(offset + 8, isLE);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/**
 * Máquina de estados operativos inmutables de unidades tácticas.
 */
export type EstadoOperativoUnidad =
  | 'DISPONIBLE'
  | 'EN_RUTA'
  | 'PATRULLANDO'
  | 'DESVIADO'
  | 'SOS';

const TRANSICIONES_VALIDAS: Record<EstadoOperativoUnidad, ReadonlyArray<EstadoOperativoUnidad>> = {
  DISPONIBLE: ['EN_RUTA', 'SOS'],
  EN_RUTA: ['PATRULLANDO', 'DESVIADO', 'SOS', 'DISPONIBLE'],
  PATRULLANDO: ['DESVIADO', 'SOS', 'DISPONIBLE', 'EN_RUTA'],
  DESVIADO: ['EN_RUTA', 'PATRULLANDO', 'SOS', 'DISPONIBLE'],
  SOS: ['DISPONIBLE', 'PATRULLANDO'],
};

export function validarTransicionEstado(
  estadoActual: EstadoOperativoUnidad,
  nuevoEstado: EstadoOperativoUnidad
): { valid: boolean; from: EstadoOperativoUnidad; to: EstadoOperativoUnidad; reason?: string } {
  const permitidos = TRANSICIONES_VALIDAS[estadoActual];
  if (!permitidos) {
    return { valid: false, from: estadoActual, to: nuevoEstado, reason: `Estado origen desconocido: ${estadoActual}` };
  }
  if (!permitidos.includes(nuevoEstado)) {
    return {
      valid: false,
      from: estadoActual,
      to: nuevoEstado,
      reason: `Transición inválida: ${estadoActual} -> ${nuevoEstado}. Permitidos: ${permitidos.join(', ')}`,
    };
  }
  return { valid: true, from: estadoActual, to: nuevoEstado };
}

// ============================================================================
// 2. CLASIFICACIÓN DE ZONAS POR GRAVEDAD DELICTUAL (CALIBRACIÓN ACTUALIZADA)
// ============================================================================

export const PESOS_DELITO_VALIDOS = [50, 20, 10, 5, 2, 1] as const;
export type PesoDelito = (typeof PESOS_DELITO_VALIDOS)[number];

export interface CategoriaDelitoConfig {
  peso: PesoDelito;
  categoria: string;
  ejemplos: string;
}

export const CATALOGO_GRAVEDAD_DELITOS: CategoriaDelitoConfig[] = [
  {
    peso: 50,
    categoria: 'Crítico / Delito con arma / Homicidio',
    ejemplos: 'Homicidio, delito con arma de fuego o blanca, secuestro',
  },
  {
    peso: 20,
    categoria: 'Grave contra las personas',
    ejemplos: 'Robo con violencia, robo con intimidación, lesiones graves',
  },
  {
    peso: 10,
    categoria: 'Grave contra la propiedad',
    ejemplos: 'Robo en lugar habitado, robo de vehículo motorizado, portonazo',
  },
  {
    peso: 5,
    categoria: 'Medio',
    ejemplos: 'Robo por sorpresa (lanzazo), receptación, robo de accesorios',
  },
  {
    peso: 2,
    categoria: 'Bajo / Falta',
    ejemplos: 'Hurto simple, lesiones leves, daños simples',
  },
  {
    peso: 1,
    categoria: 'Incivilidad',
    ejemplos: 'Consumo de alcohol o drogas en vía pública, ruidos molestos, desórdenes',
  },
];

export interface ClasificacionZonaUve {
  score_gravedad: number;
  nivel_riesgo: NivelRiesgoZona;
  uve_objetivo_min: number;
  uve_objetivo_max: number;
  medios_sugeridos: TipoMedio[];
  etiqueta_demanda: string;
  color_hex: string;
}

/**
 * Clasifica una zona según su score_gravedad intrínseco directo (sin decaimiento temporal):
 * - Riesgo Bajo: score_gravedad < 40 -> Requiere entre 0.20 y 0.30 U.V.E. (INF o CB)
 * - Riesgo Medio: 40 <= score_gravedad <= 80 -> Requiere entre 0.45 y 0.80 U.V.E. (MTT o RPD)
 * - Riesgo Alto: score_gravedad > 80 -> Requiere mínimo 1.00 U.V.E. continua (RPT o FZ)
 */
export function clasificarZonaPorScore(scoreGravedad: number): ClasificacionZonaUve {
  const score = Math.max(0, Math.round(Number(scoreGravedad) || 0));

  if (score > 80) {
    return {
      score_gravedad: score,
      nivel_riesgo: 'ALTO',
      uve_objetivo_min: 1.00,
      uve_objetivo_max: 1.00,
      medios_sugeridos: ['RPT', 'FZ'],
      etiqueta_demanda: 'Mín. 1.00 U.V.E. continua (RPT o FZ)',
      color_hex: '#dc2626',
    };
  }

  if (score >= 40) {
    return {
      score_gravedad: score,
      nivel_riesgo: 'MEDIO',
      uve_objetivo_min: 0.45,
      uve_objetivo_max: 0.80,
      medios_sugeridos: ['MTT', 'RPD'],
      etiqueta_demanda: '0.45 - 0.80 U.V.E. (MTT o RPD)',
      color_hex: '#f59e0b',
    };
  }

  return {
    score_gravedad: score,
    nivel_riesgo: 'BAJO',
    uve_objetivo_min: 0.20,
    uve_objetivo_max: 0.30,
    medios_sugeridos: ['INF', 'CB'],
    etiqueta_demanda: '0.20 - 0.30 U.V.E. (INF o CB)',
    color_hex: '#16a34a',
  };
}

/**
 * Fórmula anti-fijación:
 * score_ajustado = score_gravedad / (1 + (0.02 * minutos_patrullados_hoy))
 */
export function calcularScoreAjustado(scoreGravedad: number, minutosPatrulladosHoy: number): number {
  const s = Math.max(0, Number(scoreGravedad) || 0);
  const m = Math.max(0, Number(minutosPatrulladosHoy) || 0);
  return Math.round((s / (1 + 0.02 * m)) * 100) / 100;
}

/**
 * Calcula distancia geodésica en metros (Haversine / ST_Distance Spheroid)
 */
export function calcularDistanciaMetros(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Calcula el Tiempo Estimado de Llegada (ETA) en minutos y segundos según distancia y medio
 */
export function calcularEtaPatrulla(
  distanciaMetros: number,
  tipoMedio: TipoMedio
): { eta_segundos: number; eta_minutos: number } {
  const config = CONFIG_MEDIOS_UVE[tipoMedio] ?? CONFIG_MEDIOS_UVE.RPD;
  const velocidadMps = (config.velocidad_promedio_kmh * 1000) / 3600;
  // Factor de tortuosidad vial urbana (1.28)
  const distanciaVial = distanciaMetros * 1.28;
  const etaSegundos = Math.max(15, Math.round(distanciaVial / velocidadMps));
  const etaMinutos = Math.max(1, Math.round((etaSegundos / 60) * 10) / 10);
  return { eta_segundos: etaSegundos, eta_minutos: etaMinutos };
}

/**
 * Verifica si un punto (lat, lng) está contenido dentro de un polígono de coordenadas [{lat, lng}, ...]
 * Equivalente geométrico exacto de ST_Contains(geom, ST_Point(lon, lat))
 */
export function puntoEnPoligono(
  lat: number,
  lng: number,
  poligono: Array<{ lat: number; lng: number }>
): boolean {
  if (!poligono || poligono.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const xi = poligono[i].lng, yi = poligono[i].lat;
    const xj = poligono[j].lng, yj = poligono[j].lat;
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Genera los vértices de un polígono circular (octágono/hexadecágono) cuando una zona se define por centro y radio
 */
export function generarPoligonoCircular(
  lat: number,
  lng: number,
  radioMetros = 160,
  numVertices = 16
): Array<{ lat: number; lng: number }> {
  const vertices: Array<{ lat: number; lng: number }> = [];
  const dLat = radioMetros / 111320;
  const dLng = radioMetros / (111320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i < numVertices; i++) {
    const angle = (i / numVertices) * 2 * Math.PI;
    vertices.push({
      lat: Number((lat + dLat * Math.sin(angle)).toFixed(6)),
      lng: Number((lng + dLng * Math.cos(angle)).toFixed(6)),
    });
  }
  return vertices;
}

/**
 * Convierte un arreglo de vértices [{lat, lng}] a cadena WKT POLYGON PostGIS (SRID=4326)
 */
export function coordsToPolygonWkt(coords: Array<{ lat: number; lng: number }>): string {
  if (!coords || coords.length < 3) {
    throw new Error('Un polígono requiere al menos 3 vértices.');
  }
  const ring = [...coords];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first.lat !== last.lat || first.lng !== last.lng) {
    ring.push({ lat: first.lat, lng: first.lng });
  }
  const pairs = ring.map(p => `${p.lng} ${p.lat}`).join(', ');
  return `SRID=4326;POLYGON((${pairs}))`;
}

