import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Colors, Spacing, BorderRadius, Fonts, Shadow } from '../theme';

const TRANSPORT_ICONS: Record<string, string> = {
  PATRULLA: '🚔',
  MOTO: '🏍️',
  BICICLETA: '🚲',
  INFANTERIA: '🚶',
};

const ESTADO_COLORS: Record<string, string> = {
  DISPONIBLE: Colors.stateDisponible,
  EN_RUTA_HOTSPOT: Colors.stateEnRuta,
  PATRULLANDO_ZONA: Colors.statePatrullando,
  OCUPADO_EMERGENCIA: Colors.stateEmergencia,
  INACTIVO: Colors.stateInactivo,
};

/**
 * ProfileScreen — Perfil del funcionario con datos de turno y logout
 */
export default function ProfileScreen() {
  const { funcionario, sesion, patrol_id, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      '⚠️ Finalizar Turno',
      '¿Confirmas que deseas cerrar sesión y finalizar el turno operativo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar Turno',
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
  const transportIcon = TRANSPORT_ICONS[sesion?.tipo_transporte ?? 'PATRULLA'];

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
          <View style={[styles.stateBadge, { backgroundColor: `${estadoColor}20`, borderColor: estadoColor }]}>
            <View style={[styles.stateDot, { backgroundColor: estadoColor }]} />
            <Text style={[styles.stateText, { color: estadoColor }]}>
              {sesion?.estado_operativo?.replace(/_/g, ' ') ?? 'DISPONIBLE'}
            </Text>
          </View>
        </View>

        {/* ── Datos del turno ────────────────────────────── */}
        <Text style={styles.sectionTitle}>Turno Activo</Text>
        <View style={styles.infoCard}>
          <InfoRow icon="🪪" label="RUT / ID" value={funcionario?.rut ?? '—'} />
          <Divider />
          <InfoRow icon="📋" label="ID Sesión" value={`#${patrol_id}`} />
          <Divider />
          <InfoRow
            icon={transportIcon}
            label="Unidad"
            value={sesion?.identificador_unidad ?? '—'}
          />
          <Divider />
          <InfoRow
            icon="🚓"
            label="Tipo Transporte"
            value={sesion?.tipo_transporte?.replace('_', ' ') ?? '—'}
          />
          <Divider />
          <InfoRow
            icon="🕐"
            label="Inicio de Turno"
            value={
              sesion?.fecha_inicio
                ? new Date(sesion.fecha_inicio).toLocaleString('es-CL')
                : '—'
            }
          />
        </View>

        {/* ── Acciones ───────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Acciones</Text>
        <View style={styles.actionsCard}>
          <TouchableOpacity style={styles.actionRow}>
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={styles.actionLabel}>Ver mis evidencias del turno</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity style={styles.actionRow}>
            <Text style={styles.actionIcon}>📍</Text>
            <Text style={styles.actionLabel}>Historial de ubicaciones</Text>
            <Text style={styles.chevron}>›</Text>
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
            <ActivityIndicator color={Colors.textWhite} />
          ) : (
            <>
              <Text style={styles.logoutIcon}>🚪</Text>
              <Text style={styles.logoutText}>Cerrar Sesión / Finalizar Turno</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.version}>S.I.G.O. Patrol v1.0.0 — Uso exclusivo institucional</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.xl, paddingBottom: Spacing.xxxl },

  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    ...Shadow.md,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadow.lg,
  },
  avatarText: { color: Colors.textWhite, fontSize: Fonts.sizes.xxxl, fontWeight: '900' },
  name: { fontSize: Fonts.sizes.xxl, fontWeight: '900', color: Colors.textPrimary, textAlign: 'center' },
  grade: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  stateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  stateDot: { width: 8, height: 8, borderRadius: 4 },
  stateText: { fontSize: Fonts.sizes.xs, fontWeight: '700', letterSpacing: 1 },

  sectionTitle: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },

  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
  infoIcon: { fontSize: 20, width: 28 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },
  infoValue: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.textPrimary, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.lg },

  actionsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  actionIcon: { fontSize: 20, width: 28 },
  actionLabel: { flex: 1, fontSize: Fonts.sizes.sm, fontWeight: '500', color: Colors.textPrimary },
  chevron: { fontSize: 20, color: Colors.textMuted },

  logoutBtn: {
    height: 56,
    backgroundColor: Colors.danger,
    borderRadius: BorderRadius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    ...Shadow.md,
  },
  logoutBtnDisabled: { opacity: 0.6 },
  logoutIcon: { fontSize: 20 },
  logoutText: { color: Colors.textWhite, fontSize: Fonts.sizes.md, fontWeight: '700' },
  version: { textAlign: 'center', color: Colors.textMuted, fontSize: Fonts.sizes.xs },
});
