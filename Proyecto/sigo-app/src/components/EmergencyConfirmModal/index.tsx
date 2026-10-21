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
import { BorderRadius, Fonts, Spacing, ThemeColors } from '../../theme';
import { useTheme, useThemedStyles } from '../../theme/ThemeContext';
import Icon from '../Icon';

const { width } = Dimensions.get('window');

interface EmergencyConfirmModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  confirmed?: boolean;
}

/**
 * EmergencyConfirmModal — Modal de confirmación para solicitar refuerzos
 * "¿Confirmar solicitud de refuerzos inmediatos? [SÍ / NO]"
 */
export default function EmergencyConfirmModal({
  visible,
  onConfirm,
  onCancel,
  loading = false,
  confirmed = false,
}: EmergencyConfirmModalProps) {
  const { Colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible && !confirmed) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.03, duration: 700, useNativeDriver: true }),
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
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.iconContainer}>
            <Icon name={confirmed ? 'check' : 'alerta'} size={34} color={Colors.danger} />
          </View>

          {confirmed ? (
            <>
              <Text style={styles.title}>Refuerzos solicitados</Text>
              <Text style={styles.subtitle}>
                Tu solicitud fue enviada. Las unidades más cercanas están en camino.
              </Text>
              <View style={styles.confirmedBadge}>
                <Text style={styles.confirmedText}>ALERTA ACTIVA</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onCancel}>
                <Text style={styles.closeBtnText}>Cerrar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>Alerta de emergencia</Text>
              <Text style={styles.subtitle}>
                ¿Confirmar solicitud de refuerzos inmediatos?{'\n'}Se enviará tu ubicación GPS actual.
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={loading}>
                  <Text style={styles.cancelText}>No</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, loading && styles.btnDisabled]}
                  onPress={onConfirm}
                  disabled={loading}
                >
                  <Text style={styles.confirmText}>{loading ? '...' : 'Sí'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
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
      fontSize: Fonts.sizes.md,
      color: Colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: Spacing.xxl,
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
