import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Spacing, BorderRadius, Fonts, ThemeColors } from '../theme';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import Icon, { IconName } from '../components/Icon';

const TRANSPORT_ICONS: Record<string, IconName> = {
  PATRULLA: 'auto',
  MOTO: 'moto',
  BICICLETA: 'bici',
  INFANTERIA: 'peaton',
};

/**
 * ProfileScreen — Perfil del funcionario, apariencia y cierre de turno
 */
export default function ProfileScreen() {
  const { funcionario, sesion, patrol_id, logout } = useAuth();
  const { Colors, isDark, setMode } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [loggingOut, setLoggingOut] = useState(false);

  const ESTADO_COLORS: Record<string, string> = {
    DISPONIBLE: Colors.stateDisponible,
    EN_RUTA_HOTSPOT: Colors.stateEnRuta,
    PATRULLANDO_ZONA: Colors.statePatrullando,
    OCUPADO_EMERGENCIA: Colors.stateEmergencia,
    INACTIVO: Colors.stateInactivo,
  };

  const handleLogout = () => {
    Alert.alert(
      'Finalizar turno',
      '¿Confirmas que deseas cerrar sesión y finalizar el turno operativo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar turno',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await logout();
            } catch {
              Alert.alert('Error', 'No se pudo finalizar el turno.');
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const estadoColor = ESTADO_COLORS[sesion?.estado_operativo ?? 'DISPONIBLE'];
  const transportIcon = TRANSPORT_ICONS[sesion?.tipo_transporte ?? 'PATRULLA'] ?? 'auto';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Avatar y nombre ────────────────────────────── */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {funcionario?.nombre_completo?.charAt(0).toUpperCase() ?? 'F'}
            </Text>
          </View>
          <Text style={styles.name}>{funcionario?.nombre_completo ?? 'Funcionario'}</Text>
          <Text style={styles.grade}>{funcionario?.grado_cargo ?? 'Oficial de Terreno'}</Text>
          <View style={[styles.stateBadge, { borderColor: estadoColor }]}>
            <View style={[styles.stateDot, { backgroundColor: estadoColor }]} />
            <Text style={[styles.stateText, { color: estadoColor }]}>
              {sesion?.estado_operativo?.replace(/_/g, ' ') ?? 'DISPONIBLE'}
            </Text>
          </View>
        </View>

        {/* ── Datos del turno ────────────────────────────── */}
        <Text style={styles.sectionTitle}>Turno activo</Text>
        <View style={styles.card}>
          <InfoRow styles={styles} color={Colors.textSecondary} icon="id" label="RUT / ID" value={funcionario?.rut ?? '—'} />
          <View style={styles.divider} />
          <InfoRow styles={styles} color={Colors.textSecondary} icon="lista" label="ID sesión" value={`#${patrol_id}`} />
          <View style={styles.divider} />
          <InfoRow
            styles={styles}
            color={Colors.textSecondary}
            icon={transportIcon}
            label="Unidad"
            value={sesion?.identificador_unidad ?? '—'}
          />
          <View style={styles.divider} />
          <InfoRow
            styles={styles}
            color={Colors.textSecondary}
            icon="inicio"
            label="Tipo de transporte"
            value={sesion?.tipo_transporte?.replace('_', ' ') ?? '—'}
          />
          <View style={styles.divider} />
          <InfoRow
            styles={styles}
            color={Colors.textSecondary}
            icon="reloj"
            label="Inicio de turno"
            value={sesion?.fecha_inicio ? new Date(sesion.fecha_inicio).toLocaleString('es-CL') : '—'}
          />
        </View>

        {/* ── Apariencia ─────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Apariencia</Text>
        <View style={styles.card}>
          <View style={styles.actionRow}>
            <Icon name={isDark ? 'luna' : 'sol'} size={22} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>Modo oscuro</Text>
              <Text style={styles.actionHint}>{isDark ? 'Activado' : 'Desactivado'}</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={(v) => setMode(v ? 'dark' : 'light')}
              trackColor={{ false: Colors.borderDark, true: Colors.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={Colors.borderDark}
            />
          </View>
        </View>

        {/* ── Acciones ───────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Acciones</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.actionRow}>
            <Icon name="chart" size={22} color={Colors.textSecondary} />
            <Text style={[styles.actionLabel, { flex: 1 }]}>Ver mis evidencias del turno</Text>
            <Icon name="chevron" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.actionRow}>
            <Icon name="inicio" size={22} color={Colors.textSecondary} />
            <Text style={[styles.actionLabel, { flex: 1 }]}>Historial de ubicaciones</Text>
            <Icon name="chevron" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ── Cerrar sesión ─────────────────────────────── */}
        <TouchableOpacity
          style={[styles.logoutBtn, loggingOut && styles.logoutBtnDisabled]}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.8}
        >
          {loggingOut ? (
            <ActivityIndicator color={Colors.danger} />
          ) : (
            <>
              <Icon name="salir" size={20} color={Colors.danger} />
              <Text style={styles.logoutText}>Cerrar sesión y finalizar turno</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.version}>S.I.G.O. Patrol v1.0.0 — Uso exclusivo institucional</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  styles,
  color,
}: {
  icon: IconName;
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
  color: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Icon name={icon} size={22} color={color} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.background },
    scroll: { padding: Spacing.xl, paddingBottom: Spacing.xxxl },

    profileCard: { alignItems: 'center', paddingVertical: Spacing.xl, marginBottom: Spacing.lg },
    avatar: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: Colors.primarySoft,
      borderWidth: 1.5,
      borderColor: Colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    avatarText: { color: Colors.primary, fontSize: Fonts.sizes.xxxl, fontWeight: '500' },
    name: { fontSize: Fonts.sizes.xxl, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
    grade: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
    stateBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs + 2,
      marginTop: Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
    },
    stateDot: { width: 7, height: 7, borderRadius: 4 },
    stateText: { fontSize: Fonts.sizes.xs, fontWeight: '600', letterSpacing: 1 },

    sectionTitle: {
      fontSize: Fonts.sizes.xs,
      fontWeight: '600',
      color: Colors.textMuted,
      letterSpacing: 1,
      marginBottom: Spacing.sm,
      textTransform: 'uppercase',
    },

    card: {
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.xl,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
    infoContent: { flex: 1 },
    infoLabel: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },
    infoValue: { fontSize: Fonts.sizes.sm, fontWeight: '500', color: Colors.textPrimary, marginTop: 2 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginHorizontal: Spacing.lg },

    actionRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
    actionLabel: { fontSize: Fonts.sizes.sm, fontWeight: '500', color: Colors.textPrimary },
    actionHint: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2 },

    logoutBtn: {
      height: 52,
      borderWidth: 1,
      borderColor: Colors.danger,
      borderRadius: BorderRadius.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    logoutBtnDisabled: { opacity: 0.6 },
    logoutText: { color: Colors.danger, fontSize: Fonts.sizes.md, fontWeight: '600' },
    version: { textAlign: 'center', color: Colors.textMuted, fontSize: Fonts.sizes.xs },
  });
