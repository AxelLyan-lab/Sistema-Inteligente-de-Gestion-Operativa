// ── Tipos de dominio de la App Móvil S.I.G.O. ───────────────────────────────

export type TipoTransporte = 'PATRULLA' | 'MOTO' | 'BICICLETA' | 'INFANTERIA';
export type EstadoOperativo =
  | 'DISPONIBLE'
  | 'EN_RUTA_HOTSPOT'
  | 'PATRULLANDO_ZONA'
  | 'OCUPADO_EMERGENCIA'
  | 'INACTIVO';

export interface Funcionario {
  rut: string;
  rut_usuario?: string;
  nombre_completo: string;
  rol: 'SUPERVISOR_WEB' | 'FUNCIONARIO_MOVIL';
  grado_cargo?: string;
}

export interface SesionOperativa {
  id_sesion: number;
  tipo_transporte: TipoTransporte;
  identificador_unidad: string;
  estado_operativo: EstadoOperativo;
  fecha_inicio: string;
}

export interface AuthState {
  token: string | null;
  patrol_id: number | null;
  funcionario: Funcionario | null;
  sesion: SesionOperativa | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface TripulacionMiembro {
  id_tripulacion: number;
  rut_acompanante: string;
  usuarios?: {
    nombre_completo: string;
    grado_cargo?: string;
  };
}

export interface Evidencia {
  id_evidencia: number;
  tipo_evidencia: 'JUSTIFICACION_ATRASO' | 'EVIDENCIA_BASICA' | 'EVIDENCIA_IMPORTANTE';
  url_fotografia?: string;
  descripcion_texto?: string;
  fecha_subida: string;
}

export interface AlertaRefuerzo {
  id_emergencia: number;
  estado: 'ACTIVA' | 'RESUELTA';
  fecha_alerta: string;
}

export interface LoginForm {
  rut: string;
  password: string;
  tipo_transporte: TipoTransporte;
  identificador_unidad: string;
}

export interface Notificacion {
  id: string;
  tipo: 'FUERA_ZONA' | 'EVIDENCIA_PENDIENTE' | 'REFUERZOS_ASIGNADOS' | 'INFO';
  mensaje: string;
  leida: boolean;
  timestamp: Date;
}

export interface Coordenadas {
  latitude: number;
  longitude: number;
}
