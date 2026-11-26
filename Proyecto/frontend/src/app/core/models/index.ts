// ============================================================
// MODELOS DE DATOS — S.I.G.O.
// Mapeo directo del esquema PostGIS (Supabase)
// ============================================================

// ─── Enumeraciones (espejo de CHECK constraints de BD) ─────

export enum Rol {
  SUPERVISOR_WEB = 'SUPERVISOR_WEB',
  FUNCIONARIO_MOVIL = 'FUNCIONARIO_MOVIL',
}

export enum TipoTransporte {
  PATRULLA = 'PATRULLA',
  FURGON_Z = 'FURGON_Z',
  MOTO = 'MOTO',
  BICICLETA = 'BICICLETA',
  INFANTERIA = 'INFANTERIA',
}

export type TipoMedio = 'RPT' | 'RPD' | 'FZ' | 'MTT' | 'CB' | 'INF';
export type NivelRiesgoZona = 'ALTO' | 'MEDIO' | 'BAJO';
export type EstadoZonaRiesgo = 'LIBRE' | 'ASIGNADA' | 'EN_ENFRIAMIENTO';
export type PesoSeveridadDelito = 50 | 20 | 10 | 5 | 2 | 1;

export interface ConfigMedioUve {
  codigo: TipoMedio;
  nombre: string;
  valorUve: number;
  minAcompanantes: number;
  maxAcompanantes: number;
  dotacionDescripcion: string;
}

export const CONFIG_MEDIOS_UVE: Record<TipoMedio, ConfigMedioUve> = {
  RPT: {
    codigo: 'RPT',
    nombre: 'Radiopatrulla (3 tripulantes)',
    valorUve: 1.00,
    minAcompanantes: 2,
    maxAcompanantes: 2,
    dotacionDescripcion: 'Líder + 2 acompañantes',
  },
  RPD: {
    codigo: 'RPD',
    nombre: 'Radiopatrulla (2 tripulantes)',
    valorUve: 0.80,
    minAcompanantes: 1,
    maxAcompanantes: 1,
    dotacionDescripcion: 'Líder + 1 acompañante',
  },
  FZ: {
    codigo: 'FZ',
    nombre: 'Furgón Z',
    valorUve: 1.00,
    minAcompanantes: 1,
    maxAcompanantes: 2,
    dotacionDescripcion: 'Mín. 2 tripulantes (Líder + 1 o 2 acompañantes)',
  },
  MTT: {
    codigo: 'MTT',
    nombre: 'Moto Todo Terreno',
    valorUve: 0.45,
    minAcompanantes: 0,
    maxAcompanantes: 0,
    dotacionDescripcion: 'Líder individual',
  },
  CB: {
    codigo: 'CB',
    nombre: 'Carabinero en Bicicleta',
    valorUve: 0.30,
    minAcompanantes: 0,
    maxAcompanantes: 1,
    dotacionDescripcion: 'Pareja de servicio',
  },
  INF: {
    codigo: 'INF',
    nombre: 'Carabinero a pie / Infantería',
    valorUve: 0.20,
    minAcompanantes: 0,
    maxAcompanantes: 1,
    dotacionDescripcion: 'Pareja de servicio',
  },
};

export interface CategoriaGravedadDelito {
  peso: PesoSeveridadDelito;
  categoria: string;
  descripcion: string;
}

export const CATALOGO_GRAVEDAD_DELITOS: CategoriaGravedadDelito[] = [
  { peso: 50, categoria: 'CRITICO', descripcion: 'Crítico / Delito con arma / Homicidio' },
  { peso: 20, categoria: 'GRAVE_PERSONAS', descripcion: 'Grave contra las personas (Robo con violencia / intimidación)' },
  { peso: 10, categoria: 'GRAVE_PROPIEDAD', descripcion: 'Grave contra la propiedad (Robo lugar habitado / vehículo)' },
  { peso: 5, categoria: 'MEDIO', descripcion: 'Medio (Robo por sorpresa / receptación)' },
  { peso: 2, categoria: 'BAJO_FALTA', descripcion: 'Bajo / Falta (Hurto simple / lesiones leves)' },
  { peso: 1, categoria: 'INCIVILIDAD', descripcion: 'Incivilidad (Consumo de alcohol / drogas en vía pública)' },
];

export function calcularUveSesion(
  sesion: Partial<SesionOperativa> | null | undefined
): { tipoMedio: TipoMedio; valorUve: number; dotacionTotal: number; nombreMedio: string } {
  if (!sesion) {
    return { tipoMedio: 'INF', valorUve: 0.20, dotacionTotal: 1, nombreMedio: CONFIG_MEDIOS_UVE.INF.nombre };
  }
  const numAcomp = Array.isArray(sesion.tripulacion) ? sesion.tripulacion.length : 0;
  const raw = String(sesion.tipo_medio || sesion.tipo_transporte || '').toUpperCase().trim();
  const unidad = String(sesion.identificador_unidad || '').toUpperCase().trim();

  let tipoMedio: TipoMedio = 'INF';
  if (raw === 'FZ' || raw === 'FURGON_Z' || unidad.startsWith('FZ')) {
    tipoMedio = 'FZ';
  } else if (raw === 'RPT') {
    tipoMedio = 'RPT';
  } else if (raw === 'RPD') {
    tipoMedio = 'RPD';
  } else if (raw === 'PATRULLA' || unidad.startsWith('RP')) {
    tipoMedio = numAcomp >= 2 ? 'RPT' : 'RPD';
  } else if (raw === 'MTT' || raw === 'MOTO' || unidad.startsWith('MT')) {
    tipoMedio = 'MTT';
  } else if (raw === 'CB' || raw === 'BICICLETA' || unidad.startsWith('BC') || unidad.startsWith('CB')) {
    tipoMedio = 'CB';
  } else {
    tipoMedio = 'INF';
  }

  const cfg = CONFIG_MEDIOS_UVE[tipoMedio];
  const valorUve = sesion.valor_uve != null ? Number(sesion.valor_uve) : cfg.valorUve;
  return {
    tipoMedio,
    valorUve,
    dotacionTotal: 1 + numAcomp,
    nombreMedio: cfg.nombre,
  };
}

export function clasificarZonaPorScore(scoreGravedad: number): {
  nivelRiesgo: NivelRiesgoZona;
  uveObjetivoMin: number;
  uveObjetivoMax: number;
  mediosSugeridos: TipoMedio[];
  etiquetaDemanda: string;
  colorHex: string;
} {
  const score = Math.max(0, Math.round(scoreGravedad || 0));
  if (score > 80) {
    return {
      nivelRiesgo: 'ALTO',
      uveObjetivoMin: 1.00,
      uveObjetivoMax: 1.00,
      mediosSugeridos: ['RPT', 'FZ'],
      etiquetaDemanda: 'Mín. 1.00 U.V.E. continua (RPT o FZ)',
      colorHex: '#dc2626',
    };
  }
  if (score >= 40) {
    return {
      nivelRiesgo: 'MEDIO',
      uveObjetivoMin: 0.45,
      uveObjetivoMax: 0.80,
      mediosSugeridos: ['MTT', 'RPD'],
      etiquetaDemanda: '0.45 a 0.80 U.V.E. (MTT o RPD)',
      colorHex: '#f59e0b',
    };
  }
  return {
    nivelRiesgo: 'BAJO',
    uveObjetivoMin: 0.20,
    uveObjetivoMax: 0.30,
    mediosSugeridos: ['INF', 'CB'],
    etiquetaDemanda: '0.20 a 0.30 U.V.E. (INF o CB)',
    colorHex: '#16a34a',
  };
}

export function calcularScoreAjustado(scoreGravedad: number, minutosPatrulladosHoy: number): number {
  const min = Math.max(0, Number(minutosPatrulladosHoy) || 0);
  const score = Math.max(0, Number(scoreGravedad) || 0);
  return Number((score / (1 + 0.02 * min)).toFixed(2));
}

export enum EstadoOperativo {
  DISPONIBLE = 'DISPONIBLE',
  EN_RUTA_HOTSPOT = 'EN_RUTA_HOTSPOT',
  PATRULLANDO_ZONA = 'PATRULLANDO_ZONA',
  OCUPADO_EMERGENCIA = 'OCUPADO_EMERGENCIA',
  INACTIVO = 'INACTIVO',
}

export enum EstadoMision {
  PENDIENTE = 'PENDIENTE',
  PATRULLANDO = 'PATRULLANDO',
  COMPLETADA = 'COMPLETADA',
  INCUMPLIDO_DESVIO = 'INCUMPLIDO_DESVIO',
  CANCELADA = 'CANCELADA',
}

export enum OrigenAsignacion {
  SISTEMA_AUTOMATICO = 'SISTEMA_AUTOMATICO',
  MANUAL_SUPERVISOR = 'MANUAL_SUPERVISOR',
  REFUERZO_SOS = 'REFUERZO_SOS',
}

export enum TipoEvidencia {
  JUSTIFICACION_ATRASO = 'JUSTIFICACION_ATRASO',
  EVIDENCIA_BASICA = 'EVIDENCIA_BASICA',
  EVIDENCIA_IMPORTANTE = 'EVIDENCIA_IMPORTANTE',
}

// ─── Tipos GeoJSON (retorno PostGIS vía REST API) ──────────

export interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

// ─── Entidades del esquema relacional ──────────────────────

/** tabla: usuarios */
export interface Usuario {
  rut_usuario: string;
  rol: Rol;
  nombre_completo: string;
  grado_cargo?: string;
  activo?: boolean;
}

/** tabla: sesiones_operativas */
export interface SesionOperativa {
  id_sesion: number;
  imei_simcard: string;
  rut_conductor: string;
  tipo_transporte: TipoTransporte;
  tipo_medio?: TipoMedio;
  valor_uve?: number;
  identificador_unidad: string;
  estado_operativo: EstadoOperativo;
  fecha_inicio: string;
  fecha_cierre: string | null;
  // JOINs opcionales (expandidos por Supabase PostgREST)
  conductor?: Usuario;
  tripulacion?: TripulacionSesion[];
  asignacion_activa?: AsignacionTactica | null;
  // Estado GPS en tiempo real (no persistido, viene de MQTT)
  coordenadas_rt?: { lat: number; lng: number };
  es_ficticia?: boolean;
}

/** tabla: tripulacion_sesion */
export interface TripulacionSesion {
  id_tripulacion: number;
  id_sesion: number;
  rut_acompanante: string;
  acompanante?: Usuario;
}

/** tabla: eventos_hotspots */
export interface EventoHotspot {
  id_evento: number;
  tipo_delito: string;
  geom_delito: GeoJsonPoint;
  fecha_ocurrencia: string;
}

/** tabla: telemetria_activa */
export interface TelemetriaActiva {
  id_telemetria: number;
  id_sesion: number;
  geom_actual: GeoJsonPoint;
  timestamp_gps: string;
}

/** tabla: asignaciones_tacticas */
export interface AsignacionTactica {
  id_asignacion: number;
  id_sesion: number;
  origen_asignacion: OrigenAsignacion;
  geom_destino?: GeoJsonPolygon | null;
  hora_despacho: string;
  hora_ingreso_zona: string | null;
  hora_liberacion: string | null;
  estado_mision: EstadoMision;
  centro_lat?: number | null;
  centro_lng?: number | null;
  radio_m?: number | null;
  nombre_zona?: string | null;
  instrucciones?: string | null;
  id_zona?: number | null;
}

/** tabla: zonas_patrullaje */
export interface ZonaPatrullaje {
  id_zona: number;
  id_uuid?: string;
  nombre: string;
  direccion?: string | null;
  lat: number;
  lng: number;
  radio_m: number;
  activa: boolean;
  creado_en?: string;
  cantidad_delitos?: number;
  // Campos calibrados U.V.E. y PostGIS
  score_gravedad?: number;
  score_ajustado?: number;
  nivel_riesgo?: NivelRiesgoZona;
  estado?: EstadoZonaRiesgo;
  minutos_patrullados_hoy?: number;
  ultimo_patrullaje?: string | null;
  uve_objetivo_min?: number;
  uve_objetivo_max?: number;
  medios_sugeridos?: TipoMedio[];
  etiqueta_demanda?: string;
  vertices?: { lat: number; lng: number }[];
  delitos?: DelitoRegistro[];
}

export interface DelitoRegistro {
  id: string;
  zona_id: string;
  tipo_delito: string;
  categoria_peso: PesoSeveridadDelito;
  fecha_hora: string;
}

export interface UnidadRefuerzoDespachada {
  id: string;
  id_sesion?: number;
  identificador_unidad: string;
  conductor: string;
  tipo_medio: TipoMedio;
  valor_uve: number;
  distancia_metros: number;
  eta_minutos: number;
  lat: number;
  lng: number;
}

export interface ResultadoDespachoRefuerzosUve {
  patrulla_origen_id: string;
  uve_requerida: number;
  uve_acumulada: number;
  demanda_cubierta: boolean;
  unidades_despachadas: UnidadRefuerzoDespachada[];
  timestamp: string;
}

/** tabla: mensajes */
export interface Mensaje {
  id_mensaje: number;
  id_sesion: number;
  remitente: 'SUPERVISOR' | 'FUNCIONARIO';
  rut_remitente?: string | null;
  texto: string;
  fecha: string;
  leido: boolean;
}

/** tabla: registro_evidencias y vista v_evidencias */
export interface RegistroEvidencia {
  id_evidencia: number;
  id_sesion: number;
  id_asignacion: number | null;
  tipo_evidencia: TipoEvidencia;
  es_obligatoria: boolean;
  url_fotografia: string | null;
  descripcion_texto: string | null;
  fecha_subida: string;
  origen?: 'MOVIL' | 'DASHBOARD';
  subido_por?: string | null;
  lat?: number | null;
  lng?: number | null;
  identificador_unidad?: string;
  rut_conductor?: string;
  conductor?: string;
  // JOINs opcionales
  sesion?: SesionOperativa;
  asignacion?: AsignacionTactica;
}

/** tabla: alertas_emergencia y vista v_alertas_emergencia */
export interface AlertaEmergencia {
  id_emergencia: number;
  id_sesion_solicitante: number;
  geom_emergencia?: GeoJsonPoint;
  lat?: number;
  lng?: number;
  identificador_unidad?: string;
  conductor?: string;
  estado: 'ACTIVA' | 'RESUELTA';
  fecha_alerta: string;
  // JOINs opcionales
  sesion_solicitante?: SesionOperativa;
}

// ─── Payload MQTT de telemetría GPS ───────────────────────

/** Trama recibida del broker: topic sigo/telemetria/{imei} */
export interface GpsPayload {
  imei: string;
  lat: number;
  lng: number;
  timestamp: number;   // Unix epoch ms
  accuracy?: number;   // Precisión en metros
  speed?: number;   // km/h
  heading?: number;   // grados 0-360
}

// ─── DTOs para operaciones del Dashboard ──────────────────

export interface OverrideManualDto {
  id_sesion: number;
  lat: number;
  lng: number;
  radio_m: number;   // Radio del polígono circular en metros
  nombre_zona?: string;
  instrucciones?: string;
  id_zona?: number;
}

export interface LoginDto {
  rut: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: Usuario;
}

// ─── Helpers de presentación ──────────────────────────────

export interface EstadoConfig {
  label: string;
  color: string;      // Clase TailwindCSS
  bgColor: string;
  dotColor: string;      // Color hex para marker del mapa
  animated: boolean;
}

export const ESTADO_CONFIG: Record<EstadoOperativo, EstadoConfig> = {
  [EstadoOperativo.DISPONIBLE]: {
    label: 'Disponible', color: 'text-disponible',
    bgColor: 'bg-disponible/10', dotColor: '#2F7D52', animated: false,
  },
  [EstadoOperativo.EN_RUTA_HOTSPOT]: {
    label: 'En camino', color: 'text-en-ruta',
    bgColor: 'bg-en-ruta/10', dotColor: '#2C5F7C', animated: false,
  },
  [EstadoOperativo.PATRULLANDO_ZONA]: {
    label: 'En zona', color: 'text-patrullando',
    bgColor: 'bg-patrullando/10', dotColor: '#B7791F', animated: false,
  },
  [EstadoOperativo.OCUPADO_EMERGENCIA]: {
    label: '¡Emergencia!', color: 'text-emergencia',
    bgColor: 'bg-emergencia/10', dotColor: '#B3261E', animated: true,
  },
  [EstadoOperativo.INACTIVO]: {
    label: 'Inactivo', color: 'text-inactivo',
    bgColor: 'bg-inactivo/10', dotColor: '#98A19C', animated: false,
  },
};

export const MISION_CONFIG: Record<EstadoMision, { label: string; color: string }> = {
  [EstadoMision.PENDIENTE]: { label: 'Pendiente', color: 'text-sigo-muted' },
  [EstadoMision.PATRULLANDO]: { label: 'Patrullando', color: 'text-patrullando' },
  [EstadoMision.COMPLETADA]: { label: 'Completada', color: 'text-completada' },
  [EstadoMision.INCUMPLIDO_DESVIO]: { label: 'Incumplido', color: 'text-incumplido' },
  [EstadoMision.CANCELADA]: { label: 'Cancelada', color: 'text-inactivo' },
};

// --- Ampliaciones: evidencias (vista) y alertas (vista) -------------------

/** vista: v_evidencias */
export interface EvidenciaView {
  id_evidencia: number;
  id_sesion: number;
  id_asignacion: number | null;
  tipo_evidencia: TipoEvidencia;
  es_obligatoria: boolean;
  url_fotografia: string | null;
  descripcion_texto: string | null;
  fecha_subida: string;
  origen: string | null;
  subido_por: string | null;
  lat: number | null;
  lng: number | null;
  identificador_unidad: string | null;
  rut_conductor: string | null;
  conductor: string | null;
}

/** vista: v_alertas_emergencia */
export interface AlertaView {
  id_emergencia: number;
  id_sesion_solicitante: number;
  estado: 'ACTIVA' | 'RESUELTA';
  fecha_alerta: string;
  lat: number;
  lng: number;
  identificador_unidad: string | null;
  conductor: string | null;
}

/** Asignacion con datos de circulo (columnas nuevas) */
export interface AsignacionCircular {
  id_asignacion: number;
  id_sesion: number;
  origen_asignacion: OrigenAsignacion;
  estado_mision: EstadoMision;
  hora_despacho: string;
  centro_lat: number | null;
  centro_lng: number | null;
  radio_m: number | null;
  nombre_zona: string | null;
  instrucciones: string | null;
}