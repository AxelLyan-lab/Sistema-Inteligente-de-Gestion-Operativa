/**
 * S.I.G.O. Patrol — Design System
 * Paleta extraída del diseño Figma de referencia
 * Fondo beige claro, geocerca naranja, botón rojo táctico, tab bar blanca
 */

export const Colors = {
  // ── Fondos ────────────────────────────────────────────────
  background: '#F2EDE8',         // Beige claro (fondo principal)
  backgroundCard: '#FAFAFA',     // Tarjeta inferior blanca
  backgroundDark: '#1A1A2E',     // Modo oscuro / splash
  surface: '#FFFFFF',

  // ── Primarios Tácticos ────────────────────────────────────
  danger: '#E53E3E',             // Rojo botón de pánico
  dangerDark: '#C53030',         // Rojo hover/pressed
  dangerLight: '#FFF5F5',        // Fondo suave rojo

  // ── Secundarios ───────────────────────────────────────────
  primary: '#2D3748',            // Azul oscuro / texto principal
  primaryLight: '#4A5568',

  // ── Geocerca / Mapa ───────────────────────────────────────
  geofence: '#F4A460',           // Naranja geocerca (beige amarillo)
  geofenceBorder: '#E8922A',     // Borde geocerca
  userMarker: '#22C55E',         // Verde marcador usuario
  mapBackground: '#E8E8E8',      // Fondo del mapa

  // ── Textos ────────────────────────────────────────────────
  textPrimary: '#1A202C',        // Negro fuerte
  textSecondary: '#718096',      // Gris medio
  textMuted: '#A0AEC0',          // Gris suave
  textWhite: '#FFFFFF',

  // ── UI Elementos ──────────────────────────────────────────
  border: '#E2E8F0',
  borderDark: '#CBD5E0',
  inputBackground: '#F7FAFC',
  tabBar: '#FFFFFF',
  tabBarActive: '#1A202C',
  tabBarInactive: '#A0AEC0',

  // ── Estados operativos ────────────────────────────────────
  stateDisponible: '#22C55E',
  stateEnRuta: '#F59E0B',
  statePatrullando: '#3B82F6',
  stateEmergencia: '#EF4444',
  stateInactivo: '#9CA3AF',

  // ── Notificaciones ────────────────────────────────────────
  notifBadge: '#EF4444',
  success: '#48BB78',
  warning: '#ED8936',
  info: '#4299E1',
};

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
  xl: 24,
  full: 9999,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
};
