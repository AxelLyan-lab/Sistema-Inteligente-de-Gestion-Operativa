import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import SmoothModal from '../SmoothModal';
import { BorderRadius, Fonts, Spacing, ThemeColors } from '../../theme';
import { useTheme, useThemedStyles } from '../../theme/ThemeContext';
import Icon from '../Icon';

const { width } = Dimensions.get('window');

const UVE_DEMAND_OPTIONS = [0.5, 1.0, 1.5, 2.0] as const;

export interface UnidadRefuerzoAsignada {
  id: string;
  identificador_unidad?: string;
  tipo_medio: string;
  valor_uve: number;
  eta_minutos: number;
  distancia_metros: number;
}

interface EmergencyConfirmModalProps {
  visible: boolean;
  onConfirm: (uveRequerida: number) => void;
  onCancel: () => void;
  loading?: boolean;
  confirmed?: boolean;
  uveSolicitada?: number;
  unidadesAsignadas?: UnidadRefuerzoAsignada[];
}

/**
 * EmergencyConfirmModal — Modal de auxilio y solicitud de refuerzos por capacidad U.V.E.
 * Incluye botones de demanda en U.V.E.: +0.5 U.V.E., +1.0 U.V.E., +1.5 U.V.E., +2.0 U.V.E.
 */
export default function EmergencyConfirmModal({
  visible,
  onConfirm,
  onCancel,
  loading = false,
  confirmed = false,
  uveSolicitada = 1.0,
  unidadesAsignadas = [],
}: EmergencyConfirmModalProps) {
  const { Colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [selectedUve, setSelectedUve] = useState<number>(1.0);

  useEffect(() => {
    if (visible && !confirmed) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.02, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [visible, confirmed]);

  return (
    <SmoothModal visible={visible} onRequestClose={onCancel}>
      <Animated.View style={[styles.card, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.iconContainer}>
            <Icon name={confirmed ? 'check' : 'alerta'} size={34} color={Colors.danger} />
          </View>

          {confirmed ? (
            <>
              <Text style={styles.title}>Refuerzos U.V.E. despachados</Text>
              <Text style={styles.subtitle}>
                Demanda solicitada: <Text style={{ fontWeight: '700', color: Colors.danger }}>+{uveSolicitada.toFixed(1)} U.V.E.</Text>
                {'\n'}Las unidades con menor ETA van en camino a tu posición GPS.
              </Text>

              {unidadesAsignadas.length > 0 && (
                <View style={styles.assignedList}>
                  {unidadesAsignadas.map((u) => (
                    <View key={u.id} style={styles.assignedRow}>
                      <Text style={styles.assignedUnitText}>
                        {u.identificador_unidad ?? u.id} ({u.tipo_medio})
                      </Text>
                      <Text style={styles.assignedMetaText}>
                        {Number(u.valor_uve).toFixed(2)} U.V.E. · ETA {u.eta_minutos} min
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.confirmedBadge}>
                <Text style={styles.confirmedText}>DESPACHO U.V.E. ACTIVO</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onCancel}>
                <Text style={styles.closeBtnText}>Cerrar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>Confirmar Solicitud de Refuerzos</Text>
              <Text style={styles.subtitle}>
                ¿Deseas confirmar la alerta SOS en tu ubicación GPS? La central despachará las unidades más cercanas según la U.V.E. configurada (priorizando patrullas y furgones).
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={loading}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, loading && styles.btnDisabled]}
                  onPress={() => onConfirm(uveSolicitada)}
                  disabled={loading}
                >
                  <Text style={styles.confirmText}>
                    {loading ? 'Despachando...' : 'Confirmar SOS'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Animated.View>
    </SmoothModal>
  );
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.xl,
    },
    card: {
      backgroundColor: Colors.background,
      borderRadius: BorderRadius.lg,
      padding: Spacing.xxl,
      alignItems: 'center',
      width: width - Spacing.xl * 2,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    iconContainer: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: Colors.dangerLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: Colors.danger,
    },
    title: {
      fontSize: Fonts.sizes.xl,
      fontWeight: '600',
      color: Colors.danger,
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    subtitle: {
      fontSize: Fonts.sizes.sm,
      color: Colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: Spacing.lg,
    },
    uveGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      width: '100%',
      marginBottom: Spacing.lg,
    },
    uveOptionBtn: {
      width: '47%',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.sm,
      borderRadius: BorderRadius.md,
      borderWidth: 1.5,
      borderColor: Colors.borderDark,
      backgroundColor: Colors.surface,
      alignItems: 'center',
    },
    uveOptionBtnActive: {
      borderColor: Colors.danger,
      backgroundColor: Colors.dangerLight,
    },
    uveOptionValue: {
      fontSize: Fonts.sizes.md,
      fontWeight: '700',
      color: Colors.textPrimary,
    },
    uveOptionValueActive: {
      color: Colors.danger,
    },
    uveOptionHint: {
      fontSize: 11,
      color: Colors.textMuted,
      marginTop: 2,
    },
    uveOptionHintActive: {
      color: Colors.danger,
      fontWeight: '600',
    },
    assignedList: {
      width: '100%',
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: Colors.border,
      gap: 6,
    },
    assignedRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    assignedUnitText: {
      fontSize: Fonts.sizes.xs,
      fontWeight: '700',
      color: Colors.textPrimary,
    },
    assignedMetaText: {
      fontSize: 11,
      fontWeight: '600',
      color: Colors.danger,
    },
    actions: { flexDirection: 'row', gap: Spacing.md, width: '100%' },
    cancelBtn: {
      flex: 1,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: Colors.borderDark,
      alignItems: 'center',
    },
    cancelText: { fontSize: Fonts.sizes.lg, fontWeight: '500', color: Colors.textSecondary },
    confirmBtn: {
      flex: 1,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.md,
      backgroundColor: Colors.danger,
      alignItems: 'center',
    },
    confirmText: { fontSize: Fonts.sizes.lg, fontWeight: '600', color: '#FFFFFF' },
    btnDisabled: { opacity: 0.6 },
    confirmedBadge: {
      backgroundColor: Colors.dangerLight,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: Colors.danger,
      marginBottom: Spacing.xl,
    },
    confirmedText: {
      color: Colors.danger,
      fontWeight: '600',
      fontSize: Fonts.sizes.sm,
      letterSpacing: 1.5,
    },
    closeBtn: {
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xxl,
      borderRadius: BorderRadius.md,
      backgroundColor: Colors.surface,
    },
    closeBtnText: { color: Colors.textSecondary, fontWeight: '500', fontSize: Fonts.sizes.md },
  });
