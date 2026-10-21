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
  grado_cargo?:    string;
  activo?:         boolean;
}

/** tabla: sesiones_operativas */
export interface SesionOperativa {
  id_sesion:            number;
  imei_simcard:         string;
  rut_conductor:        string;
  tipo_transporte:      TipoTransporte;
  identificador_unidad: string;
  estado_operativo:     EstadoOperativo;
  fecha_inicio:         string;
  fecha_cierre:         string | null;
  // JOINs opcionales (expandidos por Supabase PostgREST)
  conductor?:           Usuario;
  tripulacion?:         TripulacionSesion[];
  asignacion_activa?:   AsignacionTactica | null;
  // Estado GPS en tiempo real (no persistido, viene de MQTT)
  coordenadas_rt?:      { lat: number; lng: number };
  es_ficticia?:         boolean;
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
  geom_destino?:     GeoJsonPolygon | null;
  hora_despacho:     string;
  hora_ingreso_zona: string | null;
  hora_liberacion:   string | null;
  estado_mision:     EstadoMision;
  centro_lat?:       number | null;
  centro_lng?:       number | null;
  radio_m?:          number | null;
  nombre_zona?:      string | null;
  instrucciones?:    string | null;
  id_zona?:          number | null;
}

/** tabla: zonas_patrullaje */
export interface ZonaPatrullaje {
  id_zona:           number;
  nombre:            string;
  direccion?:        string | null;
  lat:               number;
  lng:               number;
  radio_m:           number;
  activa:            boolean;
  creado_en?:        string;
  cantidad_delitos?: number;
}

/** tabla: mensajes */
export interface Mensaje {
  id_mensaje:    number;
  id_sesion:     number;
  remitente:     'SUPERVISOR' | 'FUNCIONARIO';
  rut_remitente?: string | null;
  texto:         string;
  fecha:         string;
  leido:         boolean;
}

/** tabla: registro_evidencias y vista v_evidencias */
export interface RegistroEvidencia {
  id_evidencia:      number;
  id_sesion:         number;
  id_asignacion:     number | null;
  tipo_evidencia:    TipoEvidencia;
  es_obligatoria:    boolean;
  url_fotografia:    string | null;
  descripcion_texto: string | null;
  fecha_subida:      string;
  origen?:           'MOVIL' | 'DASHBOARD';
  subido_por?:       string | null;
  lat?:              number | null;
  lng?:              number | null;
  identificador_unidad?: string;
  rut_conductor?:        string;
  conductor?:            string;
  // JOINs opcionales
  sesion?:           SesionOperativa;
  asignacion?:       AsignacionTactica;
}

/** tabla: alertas_emergencia y vista v_alertas_emergencia */
export interface AlertaEmergencia {
  id_emergencia:         number;
  id_sesion_solicitante: number;
  geom_emergencia?:      GeoJsonPoint;
  lat?:                  number;
  lng?:                  number;
  identificador_unidad?: string;
  conductor?:            string;
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
  id_sesion:      number;
  lat:            number;
  lng:            number;
  radio_m:        number;   // Radio del polígono circular en metros
  nombre_zona?:   string;
  instrucciones?: string;
  id_zona?:       number;
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
  [EstadoMision.PENDIENTE]:         { label: 'Pendiente',    color: 'text-sigo-muted' },
  [EstadoMision.PATRULLANDO]:       { label: 'Patrullando',  color: 'text-patrullando' },
  [EstadoMision.COMPLETADA]:        { label: 'Completada',   color: 'text-completada' },
  [EstadoMision.INCUMPLIDO_DESVIO]: { label: 'Incumplido',   color: 'text-incumplido' },
  [EstadoMision.CANCELADA]:         { label: 'Cancelada',    color: 'text-inactivo' },
};

// --- Ampliaciones: evidencias (vista) y alertas (vista) -------------------

/** vista: v_evidencias */
export interface EvidenciaView {
  id_evidencia:         number;
  id_sesion:            number;
  id_asignacion:        number | null;
  tipo_evidencia:       TipoEvidencia;
  es_obligatoria:       boolean;
  url_fotografia:       string | null;
  descripcion_texto:    string | null;
  fecha_subida:         string;
  origen:               string | null;
  subido_por:           string | null;
  lat:                  number | null;
  lng:                  number | null;
  identificador_unidad: string | null;
  rut_conductor:        string | null;
  conductor:            string | null;
}

/** vista: v_alertas_emergencia */
export interface AlertaView {
  id_emergencia:         number;
  id_sesion_solicitante: number;
  estado:                'ACTIVA' | 'RESUELTA';
  fecha_alerta:          string;
  lat:                   number;
  lng:                   number;
  identificador_unidad:  string | null;
  conductor:             string | null;
}

/** Asignacion con datos de circulo (columnas nuevas) */
export interface AsignacionCircular {
  id_asignacion:     number;
  id_sesion:         number;
  origen_asignacion: OrigenAsignacion;
  estado_mision:     EstadoMision;
  hora_despacho:     string;
  centro_lat:        number | null;
  centro_lng:        number | null;
  radio_m:           number | null;
  nombre_zona:       string | null;
  instrucciones:     string | null;
}