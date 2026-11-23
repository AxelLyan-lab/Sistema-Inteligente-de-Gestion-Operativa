// ── Tipos de dominio de la API táctica S.I.G.O. ─────────────────────────────
import { TipoMedio, EstadoSesionPatrullaje, NivelRiesgoZona, EstadoZonaRiesgo } from '../utils/uve.utils';

export type { TipoMedio, EstadoSesionPatrullaje, NivelRiesgoZona, EstadoZonaRiesgo };

export type TipoTransporte =
  | 'PATRULLA'
  | 'FURGON_Z'
  | 'MOTO'
  | 'BICICLETA'
  | 'INFANTERIA'
  | 'RPT'
  | 'RPD'
  | 'FZ'
  | 'MTT'
  | 'CB'
  | 'INF';

export type EstadoOperativo =
  | 'DISPONIBLE'
  | 'EN_RUTA_HOTSPOT'
  | 'PATRULLANDO_ZONA'
  | 'OCUPADO_EMERGENCIA'
  | 'INACTIVO';

export type RolUsuario = 'SUPERVISOR_WEB' | 'FUNCIONARIO_MOVIL';

// Claims del JWT de terreno (Tarea #43 + U.V.E.)
export interface TacticalJwtPayload {
  user_id: string;         // rut_usuario
  patrol_id: number;       // id_sesion
  sesion_patrullaje_id?: string; // UUID en sesiones_patrullaje
  role: RolUsuario;
  shift_id: string;        // UUID del turno
  is_lead: boolean;        // ¿Es el funcionario a cargo?
  nombre: string;
  tipo_transporte: TipoTransporte;
  tipo_medio?: TipoMedio;
  valor_uve?: number;
  iat?: number;
  exp?: number;
}

// Body del endpoint POST /api/v1/auth/patrol-login
export interface PatrolLoginBody {
  rut: string;
  password: string;
  tipo_transporte: TipoTransporte;
  tipo_medio?: TipoMedio;
  identificador_unidad: string; // ej: "RP-402", "FZ-101", "MT-105"
  imei_simcard?: string;
  tripulacion?: string[];       // RUTs de acompañantes
}

// Respuesta del login exitoso
export interface PatrolLoginResponse {
  token: string;
  patrol_id: number;
  sesion_patrullaje_id?: string;
  funcionario: {
    rut: string;
    nombre_completo: string;
    grado_cargo?: string;
    rol: RolUsuario;
  };
  sesion: {
    id_sesion: number;
    sesion_patrullaje_id?: string;
    tipo_transporte: TipoTransporte;
    tipo_medio: TipoMedio;
    valor_uve: number;
    identificador_unidad: string;
    estado_operativo: EstadoOperativo;
    fecha_inicio: string;
  };
}

// Usuario desde base de datos
export interface UsuarioDB {
  id?: string;
  rut_usuario: string;
  password_hash: string;
  rol: RolUsuario;
  nombre_completo: string;
  grado_cargo?: string;
  activo?: boolean;
}

// Sesión operativa desde base de datos
export interface SesionOperativaDB {
  id_sesion: number;
  imei_simcard: string;
  rut_conductor: string;
  tipo_transporte: TipoTransporte;
  tipo_medio?: TipoMedio;
  valor_uve?: number;
  sesion_patrullaje_id?: string;
  identificador_unidad: string;
  estado_operativo: EstadoOperativo;
  fecha_inicio: string;
  fecha_cierre: string | null;
}

// Sesión de patrullaje U.V.E. (tabla sesiones_patrullaje)
export interface SesionPatrullajeUve {
  id: string;
  id_sesion_operativa?: number | null;
  identificador_unidad?: string | null;
  lider_id: string;
  acompanante_1_id?: string | null;
  acompanante_2_id?: string | null;
  tipo_medio: TipoMedio;
  valor_uve: number;
  ubicacion_actual?: { latitude: number; longitude: number } | null;
  estado: EstadoSesionPatrullaje;
  created_at: string;
  updated_at: string;
}

// Zona de riesgo calibrada (tabla zonas_riesgo)
export interface ZonaRiesgo {
  id: string;
  id_zona_patrullaje?: number | null;
  nombre: string;
  direccion?: string | null;
  cuadrante_id: string;
  poligono: Array<{ lat: number; lng: number }>;
  centro_lat: number;
  centro_lng: number;
  radio_m?: number;
  score_gravedad: number;
  score_ajustado?: number;
  nivel_riesgo: NivelRiesgoZona;
  estado: EstadoZonaRiesgo;
  minutos_patrullados_hoy: number;
  ultimo_patrullaje: string | null;
  uve_objetivo_min: number;
  uve_objetivo_max: number;
  medios_sugeridos: TipoMedio[];
  etiqueta_demanda: string;
  delitos?: DelitoRegistro[];
}

// Delito registrado en zona (tabla delitos_registro)
export interface DelitoRegistro {
  id: string;
  zona_id: string;
  tipo_delito: string;
  categoria_peso: 50 | 20 | 10 | 5 | 2 | 1;
  fecha_hora: string;
}
