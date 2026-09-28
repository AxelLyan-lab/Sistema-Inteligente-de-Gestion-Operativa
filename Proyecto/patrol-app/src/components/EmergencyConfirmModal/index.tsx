import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Colors, BorderRadius, Fonts, Spacing, Shadow } from '../../theme';

const { width } = Dimensions.get('window');

interface EmergencyConfirmModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  confirmed?: boolean;
}

/**
 * EmergencyConfirmModal — Modal de confirmación táctica para solicitar refuerzos
 * "¿Confirmar solicitud de refuerzos inmediatos? [SÍ / NO]"
 */
export default function EmergencyConfirmModal({
  visible,
  onConfirm,
  onCancel,
  loading = false,
  confirmed = false,
}: EmergencyConfirmModalProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible && !confirmed) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [visible, confirmed]);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { transform: [{ scale: pulseAnim }] }]}>
          {/* Ícono de emergencia */}
          <View style={styles.iconContainer}>
            <Text style={styles.iconText}>🚨</Text>
          </View>

          {confirmed ? (
            <>
              <Text style={styles.title}>Refuerzos Solicitados</Text>
              <Text style={styles.subtitle}>
                Tu solicitud fue enviada. Las unidades más cercanas están en camino.
              </Text>
              <View style={styles.confirmedBadge}>
                <Text style={styles.confirmedText}>✓ ALERTA ACTIVA</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onCancel}>
                <Text style={styles.closeBtnText}>Cerrar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>¡ALERTA DE EMERGENCIA!</Text>
              <Text style={styles.subtitle}>
                ¿Confirmar solicitud de refuerzos inmediatos?{'\n'}Se enviará tu ubicación GPS actual.
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onCancel}
                  disabled={loading}
                >
                  <Text style={styles.cancelText}>NO</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, loading && styles.btnDisabled]}
                  onPress={onConfirm}
                  disabled={loading}
                >
                  <Text style={styles.confirmText}>{loading ? '...' : 'SÍ'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    width: width - Spacing.xl * 2,
    ...Shadow.lg,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dangerLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 3,
    borderColor: Colors.danger,
  },
  iconText: { fontSize: 36 },
  title: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '900',
    color: Colors.danger,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: Fonts.sizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxl,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    ...Shadow.md,
  },
  confirmText: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '900',
    color: Colors.textWhite,
    letterSpacing: 1,
  },
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
    fontWeight: '800',
    fontSize: Fonts.sizes.sm,
    letterSpacing: 1.5,
  },
  closeBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.inputBackground,
  },
  closeBtnText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: Fonts.sizes.md,
  },
});
