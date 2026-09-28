// ── Tipos de dominio de la API táctica S.I.G.O. ─────────────────────────────

export type TipoTransporte = 'PATRULLA' | 'MOTO' | 'BICICLETA' | 'INFANTERIA';
export type EstadoOperativo = 'DISPONIBLE' | 'EN_RUTA_HOTSPOT' | 'PATRULLANDO_ZONA' | 'OCUPADO_EMERGENCIA' | 'INACTIVO';
export type RolUsuario = 'SUPERVISOR_WEB' | 'FUNCIONARIO_MOVIL';

// Claims del JWT de terreno (Tarea #43)
export interface TacticalJwtPayload {
  user_id: string;         // rut_usuario
  patrol_id: number;       // id_sesion
  role: RolUsuario;
  shift_id: string;        // UUID del turno
  is_lead: boolean;        // ¿Es el funcionario a cargo?
  nombre: string;
  tipo_transporte: TipoTransporte;
  iat?: number;
  exp?: number;
}

// Body del endpoint POST /api/v1/auth/patrol-login
export interface PatrolLoginBody {
  rut: string;
  password: string;
  tipo_transporte: TipoTransporte;
  identificador_unidad: string; // ej: "RP-402", "M-12"
  imei_simcard?: string;
  tripulacion?: string[];       // RUTs de acompañantes
}

// Respuesta del login exitoso
export interface PatrolLoginResponse {
  token: string;
  patrol_id: number;
  funcionario: {
    rut: string;
    nombre_completo: string;
    rol: RolUsuario;
  };
  sesion: {
    id_sesion: number;
    tipo_transporte: TipoTransporte;
    identificador_unidad: string;
    estado_operativo: EstadoOperativo;
    fecha_inicio: string;
  };
}

// Usuario desde base de datos
export interface UsuarioDB {
  rut_usuario: string;
  password_hash: string;
  rol: RolUsuario;
  nombre_completo: string;
  grado_cargo?: string;
}

// Sesión operativa desde base de datos
export interface SesionOperativaDB {
  id_sesion: number;
  imei_simcard: string;
  rut_conductor: string;
  tipo_transporte: TipoTransporte;
  identificador_unidad: string;
  estado_operativo: EstadoOperativo;
  fecha_inicio: string;
  fecha_cierre: string | null;
}
