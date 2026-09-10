// ============================================================
// MODELOS DE DATOS — S.I.G.O.
// Mapeo directo del esquema PostGIS (Supabase)
// ============================================================

// ─── Enumeraciones (espejo de CHECK constraints de BD) ─────

export enum Rol {
  SUPERVISOR_WEB    = 'SUPERVISOR_WEB',
  FUNCIONARIO_MOVIL = 'FUNCIONARIO_MOVIL',
}

export enum TipoTransporte {
  PATRULLA  = 'PATRULLA',
  MOTO      = 'MOTO',
  BICICLETA = 'BICICLETA',
}

export enum EstadoOperativo {
  DISPONIBLE         = 'DISPONIBLE',
  EN_RUTA_HOTSPOT    = 'EN_RUTA_HOTSPOT',
  PATRULLANDO_ZONA   = 'PATRULLANDO_ZONA',
  OCUPADO_EMERGENCIA = 'OCUPADO_EMERGENCIA',
  INACTIVO           = 'INACTIVO',
}

export enum EstadoMision {
  PENDIENTE         = 'PENDIENTE',
  PATRULLANDO       = 'PATRULLANDO',
  COMPLETADA        = 'COMPLETADA',
  INCUMPLIDO_DESVIO = 'INCUMPLIDO_DESVIO',
  CANCELADA         = 'CANCELADA',
}

export enum OrigenAsignacion {
  SISTEMA_AUTOMATICO = 'SISTEMA_AUTOMATICO',
  MANUAL_SUPERVISOR  = 'MANUAL_SUPERVISOR',
  REFUERZO_SOS       = 'REFUERZO_SOS',
}

export enum TipoEvidencia {
  JUSTIFICACION_ATRASO = 'JUSTIFICACION_ATRASO',
  EVIDENCIA_BASICA     = 'EVIDENCIA_BASICA',
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
  rut_usuario:     string;
  rol:             Rol;
  nombre_completo: string;
}

/** tabla: sesiones_operativas */
export interface SesionOperativa {
  id_sesion:        number;
  imei_simcard:     string;
  rut_conductor:    string;
  tipo_transporte:  TipoTransporte;
  estado_operativo: EstadoOperativo;
  fecha_inicio:     string;
  fecha_cierre:     string | null;
  // JOINs opcionales (expandidos por la API)
  conductor?:       Usuario;
  tripulacion?:     TripulacionSesion[];
  asignacion_activa?: AsignacionTactica;
  // Estado GPS en tiempo real (no persistido, viene de MQTT)
  coordenadas_rt?:  { lat: number; lng: number };
}

/** tabla: tripulacion_sesion */
export interface TripulacionSesion {
  id_tripulacion:  number;
  id_sesion:       number;
  rut_acompanante: string;
  acompanante?:    Usuario;
}

/** tabla: eventos_hotspots */
export interface EventoHotspot {
  id_evento:        number;
  tipo_delito:      string;
  geom_delito:      GeoJsonPoint;
  fecha_ocurrencia: string;
}

/** tabla: telemetria_activa */
export interface TelemetriaActiva {
  id_telemetria: number;
  id_sesion:     number;
  geom_actual:   GeoJsonPoint;
  timestamp_gps: string;
}

/** tabla: asignaciones_tacticas */
export interface AsignacionTactica {
  id_asignacion:     number;
  id_sesion:         number;
  origen_asignacion: OrigenAsignacion;
  geom_destino:      GeoJsonPolygon;
  hora_despacho:     string;
  hora_ingreso_zona: string | null;
  hora_liberacion:   string | null;
  estado_mision:     EstadoMision;
}

/** tabla: registro_evidencias */
export interface RegistroEvidencia {
  id_evidencia:      number;
  id_sesion:         number;
  id_asignacion:     number | null;
  tipo_evidencia:    TipoEvidencia;
  es_obligatoria:    boolean;
  url_fotografia:    string | null;
  descripcion_texto: string | null;
  fecha_subida:      string;
  // JOINs opcionales
  sesion?:           SesionOperativa;
  asignacion?:       AsignacionTactica;
}

/** tabla: alertas_emergencia */
export interface AlertaEmergencia {
  id_emergencia:         number;
  id_sesion_solicitante: number;
  geom_emergencia:       GeoJsonPoint;
  estado:                'ACTIVA' | 'RESUELTA';
  fecha_alerta:          string;
  // JOINs opcionales
  sesion_solicitante?:   SesionOperativa;
}

// ─── Payload MQTT de telemetría GPS ───────────────────────

/** Trama recibida del broker: topic sigo/telemetria/{imei} */
export interface GpsPayload {
  imei:       string;
  lat:        number;
  lng:        number;
  timestamp:  number;   // Unix epoch ms
  accuracy?:  number;   // Precisión en metros
  speed?:     number;   // km/h
  heading?:   number;   // grados 0-360
}

// ─── DTOs para operaciones del Dashboard ──────────────────

export interface OverrideManualDto {
  id_sesion: number;
  lat:       number;
  lng:       number;
  radio_m:   number;   // Radio del polígono circular en metros
}

export interface LoginDto {
  rut:      string;
  password: string;
}

export interface LoginResponse {
  access_token:  string;
  refresh_token: string;
  user:          Usuario;
}

// ─── Helpers de presentación ──────────────────────────────

export interface EstadoConfig {
  label:      string;
  color:      string;      // Clase TailwindCSS
  bgColor:    string;
  dotColor:   string;      // Color hex para marker del mapa
  animated:   boolean;
}

export const ESTADO_CONFIG: Record<EstadoOperativo, EstadoConfig> = {
  [EstadoOperativo.DISPONIBLE]: {
    label: 'Disponible', color: 'text-disponible',
    bgColor: 'bg-disponible/10', dotColor: '#10b981', animated: false,
  },
  [EstadoOperativo.EN_RUTA_HOTSPOT]: {
    label: 'En Ruta', color: 'text-en-ruta',
    bgColor: 'bg-en-ruta/10', dotColor: '#3b82f6', animated: false,
  },
  [EstadoOperativo.PATRULLANDO_ZONA]: {
    label: 'Patrullando', color: 'text-patrullando',
    bgColor: 'bg-patrullando/10', dotColor: '#f59e0b', animated: false,
  },
  [EstadoOperativo.OCUPADO_EMERGENCIA]: {
    label: '¡Emergencia!', color: 'text-emergencia',
    bgColor: 'bg-emergencia/10', dotColor: '#ef4444', animated: true,
  },
  [EstadoOperativo.INACTIVO]: {
    label: 'Inactivo', color: 'text-inactivo',
    bgColor: 'bg-inactivo/10', dotColor: '#6b7280', animated: false,
  },
};

export const MISION_CONFIG: Record<EstadoMision, { label: string; color: string }> = {
  [EstadoMision.PENDIENTE]:         { label: 'Pendiente',    color: 'text-sigo-muted' },
  [EstadoMision.PATRULLANDO]:       { label: 'Patrullando',  color: 'text-patrullando' },
  [EstadoMision.COMPLETADA]:        { label: 'Completada',   color: 'text-completada' },
  [EstadoMision.INCUMPLIDO_DESVIO]: { label: 'Incumplido',   color: 'text-incumplido' },
  [EstadoMision.CANCELADA]:         { label: 'Cancelada',    color: 'text-inactivo' },
};
