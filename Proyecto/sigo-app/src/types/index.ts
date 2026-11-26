// ── Tipos de dominio de la App Móvil S.I.G.O. ───────────────────────────────

export type TipoMedio = 'RPT' | 'RPD' | 'FZ' | 'MTT' | 'CB' | 'INF';
export type TipoTransporte =
  | 'PATRULLA'
  | 'FURGON_Z'
  | 'MOTO'
  | 'BICICLETA'
  | 'INFANTERIA'
  | TipoMedio;
export type EstadoOperativo =
  | 'DISPONIBLE'
  | 'EN_RUTA_HOTSPOT'
  | 'PATRULLANDO_ZONA'
  | 'OCUPADO_EMERGENCIA'
  | 'INACTIVO'
  | 'PATRULLANDO'
  | 'EN_ZONA_RIESGO'
  | 'SOLICITANDO_REFUERZO'
  | 'EN_REFUERZO';

export interface ConfigMedioUveMovil {
  codigo: TipoMedio;
  nombre: string;
  valorUve: number;
  minAcompanantes: number;
  maxAcompanantes: number;
  dotacionTexto: string;
}

export const CONFIG_MEDIOS_UVE_MOVIL: Record<TipoMedio, ConfigMedioUveMovil> = {
  RPT: {
    codigo: 'RPT',
    nombre: 'Radiopatrulla (3 tripulantes)',
    valorUve: 1.00,
    minAcompanantes: 2,
    maxAcompanantes: 2,
    dotacionTexto: 'Líder + 2 acompañantes',
  },
  RPD: {
    codigo: 'RPD',
    nombre: 'Radiopatrulla (2 tripulantes)',
    valorUve: 0.80,
    minAcompanantes: 1,
    maxAcompanantes: 1,
    dotacionTexto: 'Líder + 1 acompañante',
  },
  FZ: {
    codigo: 'FZ',
    nombre: 'Furgón Z',
    valorUve: 1.00,
    minAcompanantes: 1,
    maxAcompanantes: 2,
    dotacionTexto: 'Mín. 2 tripulantes (Líder + 1 o 2 acomp.)',
  },
  MTT: {
    codigo: 'MTT',
    nombre: 'Moto Todo Terreno',
    valorUve: 0.45,
    minAcompanantes: 0,
    maxAcompanantes: 0,
    dotacionTexto: 'Líder individual',
  },
  CB: {
    codigo: 'CB',
    nombre: 'Carabinero en Bicicleta',
    valorUve: 0.30,
    minAcompanantes: 0,
    maxAcompanantes: 1,
    dotacionTexto: 'Pareja de servicio',
  },
  INF: {
    codigo: 'INF',
    nombre: 'Carabinero a pie / Infantería',
    valorUve: 0.20,
    minAcompanantes: 0,
    maxAcompanantes: 1,
    dotacionTexto: 'Pareja de servicio',
  },
};

export function calcularUveMovil(
  tipoTransporte?: string | null,
  numAcompanantes: number = 0,
  identificadorUnidad?: string | null
): { tipoMedio: TipoMedio; valorUve: number; nombreMedio: string; dotacionTotal: number } {
  const raw = (tipoTransporte || 'INFANTERIA').toUpperCase().trim();
  const unidad = (identificadorUnidad || '').toUpperCase().trim();

  let tipoMedio: TipoMedio = 'INF';
  if (raw === 'FURGON_Z' || raw === 'FZ' || unidad.startsWith('FZ')) {
    tipoMedio = 'FZ';
  } else if (raw === 'RPT') {
    tipoMedio = 'RPT';
  } else if (raw === 'RPD') {
    tipoMedio = 'RPD';
  } else if (raw === 'PATRULLA') {
    tipoMedio = numAcompanantes >= 2 ? 'RPT' : 'RPD';
  } else if (raw === 'MOTO' || raw === 'MTT') {
    tipoMedio = 'MTT';
  } else if (raw === 'BICICLETA' || raw === 'CB') {
    tipoMedio = 'CB';
  } else {
    tipoMedio = 'INF';
  }

  const cfg = CONFIG_MEDIOS_UVE_MOVIL[tipoMedio];
  return {
    tipoMedio,
    valorUve: cfg.valorUve,
    nombreMedio: cfg.nombre,
    dotacionTotal: 1 + numAcompanantes,
  };
}

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
  tipo_medio?: TipoMedio;
  valor_uve?: number;
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
