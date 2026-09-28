import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Colors, Spacing, BorderRadius, Fonts, Shadow } from '../../theme';
import { Notificacion } from '../../types';

interface NotificationBannerProps {
  notification: Notificacion | null;
  onDismiss: () => void;
}

const NOTIF_COLORS: Record<Notificacion['tipo'], string> = {
  FUERA_ZONA: Colors.danger,
  EVIDENCIA_PENDIENTE: Colors.warning,
  REFUERZOS_ASIGNADOS: Colors.info,
  INFO: Colors.primary,
};

const NOTIF_ICONS: Record<Notificacion['tipo'], string> = {
  FUERA_ZONA: '⚠️',
  EVIDENCIA_PENDIENTE: '📸',
  REFUERZOS_ASIGNADOS: '🚔',
  INFO: 'ℹ️',
};

/**
 * NotificationBanner — Banner deslizable de alertas tácticas
 */
export default function NotificationBanner({ notification, onDismiss }: NotificationBannerProps) {
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (notification) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 15,
      }).start();

      // Auto-dismiss después de 5 segundos
      const timer = setTimeout(() => {
        dismissBanner();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const dismissBanner = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => onDismiss());
  };

  if (!notification) return null;

  const color = NOTIF_COLORS[notification.tipo];
  const icon = NOTIF_ICONS[notification.tipo];

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }], borderLeftColor: color }]}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.message}>{notification.mensaje}</Text>
      <TouchableOpacity onPress={dismissBanner} style={styles.closeBtn}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    gap: Spacing.sm,
    zIndex: 999,
    ...Shadow.lg,
  },
  icon: { fontSize: 20 },
  message: { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.textPrimary, fontWeight: '500' },
  closeBtn: { padding: Spacing.xs },
  closeText: { color: Colors.textMuted, fontWeight: '700' },
});
