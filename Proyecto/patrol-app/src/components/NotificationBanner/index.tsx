import React, { useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Spacing, BorderRadius, Fonts, ThemeColors } from '../../theme';
import { useTheme, useThemedStyles } from '../../theme/ThemeContext';
import Icon, { IconName } from '../Icon';
import { Notificacion } from '../../types';

interface NotificationBannerProps {
  notification: Notificacion | null;
  onDismiss: () => void;
}

const NOTIF_ICONS: Record<Notificacion['tipo'], IconName> = {
  FUERA_ZONA: 'alerta',
  EVIDENCIA_PENDIENTE: 'camara',
  REFUERZOS_ASIGNADOS: 'escudo',
  INFO: 'campana',
};

/**
 * NotificationBanner — Banner deslizable de alertas tácticas
 */
export default function NotificationBanner({ notification, onDismiss }: NotificationBannerProps) {
  const { Colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const slideAnim = useRef(new Animated.Value(-100)).current;

  const NOTIF_COLORS: Record<Notificacion['tipo'], string> = {
    FUERA_ZONA: Colors.danger,
    EVIDENCIA_PENDIENTE: Colors.warning,
    REFUERZOS_ASIGNADOS: Colors.info,
    INFO: Colors.primary,
  };

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
  // Los mensajes pueden traer emojis heredados: se limpian para mantener la interfaz coherente
  const message = notification.mensaje.replace(/^[^\p{L}\p{N}¡¿]+/u, '');

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }], borderColor: color }]}
    >
      <Icon name={icon} size={20} color={color} />
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity onPress={dismissBanner} style={styles.closeBtn}>
        <Icon name="cerrar" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: Spacing.md,
      right: Spacing.md,
      backgroundColor: Colors.background,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      gap: Spacing.sm,
      zIndex: 999,
    },
    message: { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.textPrimary, fontWeight: '500' },
    closeBtn: { padding: Spacing.xs },
  });
