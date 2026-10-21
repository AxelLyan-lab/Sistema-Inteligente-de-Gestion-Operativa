/**
 * S.I.G.O. Patrol — Design System (minimalista)
 * Verde institucional Carabineros de Chile como acento (#1B3B2B),
 * superficies limpias, trazos finos y sin sombras pesadas.
 * Soporta modo claro y oscuro (ver ThemeContext).
 */

export const lightColors = {
  // ── Fondos ────────────────────────────────────────────────
  background: '#FFFFFF',
  backgroundCard: '#FFFFFF',
  backgroundDark: '#1B3B2B',       // Splash / cabeceras institucionales
  surface: '#F5F6F5',

  // ── Acento institucional ──────────────────────────────────
  primary: '#1B3B2B',
  primaryPressed: '#142C20',
  primarySoft: '#E8EFEA',
  primaryLight: '#3F5E4E',
  onPrimary: '#FFFFFF',

  // ── Alerta (solo pánico / errores) ────────────────────────
  danger: '#B3261E',
  dangerDark: '#8C1D18',
  dangerLight: '#FBEAE9',

  // ── Mapa ──────────────────────────────────────────────────
  geofence: '#8FB39F',
  geofenceBorder: '#1B3B2B',
  userMarker: '#1B3B2B',
  mapBackground: '#E8ECE9',

  // ── Textos ────────────────────────────────────────────────
  textPrimary: '#111412',
  textSecondary: '#6B746F',
  textMuted: '#98A19C',
  textWhite: '#FFFFFF',

  // ── UI ────────────────────────────────────────────────────
  border: '#E4E7E5',
  borderDark: '#CFD4D1',
  inputBackground: '#F5F6F5',
  tabBar: '#FFFFFF',
  tabBarActive: '#1B3B2B',
  tabBarInactive: '#6B746F',

  // ── Estados operativos ────────────────────────────────────
  stateDisponible: '#2F7D52',
  stateEnRuta: '#B7791F',
  statePatrullando: '#2C5F7C',
  stateEmergencia: '#B3261E',
  stateInactivo: '#98A19C',

  // ── Notificaciones ────────────────────────────────────────
  notifBadge: '#B3261E',
  success: '#2F7D52',
  successSoft: '#E8F3EC',
  warning: '#B7791F',
  info: '#2C5F7C',
};

export type ThemeColors = typeof lightColors;

export const darkColors: ThemeColors = {
  background: '#0E0F0E',
  backgroundCard: '#0E0F0E',
  backgroundDark: '#0A120E',
  surface: '#171918',

  primary: '#6FAE8B',
  primaryPressed: '#85BF9F',
  primarySoft: '#1C2A22',
  primaryLight: '#8DBFA5',
  onPrimary: '#0E0F0E',

  danger: '#E5736C',
  dangerDark: '#CF5E57',
  dangerLight: '#2A1816',

  geofence: '#3F6B52',
  geofenceBorder: '#6FAE8B',
  userMarker: '#6FAE8B',
  mapBackground: '#1B1E1C',

  textPrimary: '#F2F4F3',
  textSecondary: '#9AA39E',
  textMuted: '#6F7873',
  textWhite: '#FFFFFF',

  border: '#262A28',
  borderDark: '#343A37',
  inputBackground: '#171918',
  tabBar: '#0E0F0E',
  tabBarActive: '#6FAE8B',
  tabBarInactive: '#8A938E',

  stateDisponible: '#6FAE8B',
  stateEnRuta: '#D9A441',
  statePatrullando: '#6FA3C2',
  stateEmergencia: '#E5736C',
  stateInactivo: '#6F7873',

  notifBadge: '#E5736C',
  success: '#6FAE8B',
  successSoft: '#1C2A22',
  warning: '#D9A441',
  info: '#6FA3C2',
};

/** Compatibilidad: paleta clara por defecto para código no migrado */
export const Colors = lightColors;

/** Grosor de trazo uniforme para todos los iconos */
export const Stroke = 1.5;

export const Fonts = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 16,
  full: 9999,
};

/** Diseño plano: sin sombras. La jerarquía se logra con bordes y espacio. */
export const Shadow = {
  sm: {},
  md: {},
  lg: {},
};
