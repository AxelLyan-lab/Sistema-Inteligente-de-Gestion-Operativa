import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, BorderRadius, Fonts, Spacing, Shadow } from '../../theme';

interface TacticalButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'danger' | 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

/**
 * TacticalButton — Botón de acción táctica S.I.G.O.
 * Variante "danger" = Botón rojo de pánico (Figma)
 */
export default function TacticalButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}: TacticalButtonProps) {
  const buttonStyle = [
    styles.base,
    styles[`size_${size}`],
    styles[`variant_${variant}`],
    (disabled || loading) && styles.disabled,
    style,
  ];

  const labelStyle = [
    styles.label,
    styles[`label_${size}`],
    styles[`labelColor_${variant}`],
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? Colors.danger : Colors.textWhite}
          size="small"
        />
      ) : (
        <>
          {icon}
          <Text style={labelStyle}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.xl,
    ...Shadow.md,
  },

  // Tamaños
  size_sm: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, minHeight: 40 },
  size_md: { paddingVertical: Spacing.md + 2, paddingHorizontal: Spacing.xl, minHeight: 52 },
  size_lg: { paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xxl, minHeight: 60 },

  // Variantes
  variant_danger: { backgroundColor: Colors.danger },
  variant_primary: { backgroundColor: Colors.primary },
  variant_outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.danger,
    ...Shadow.sm,
  },
  variant_ghost: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },

  disabled: { opacity: 0.5 },

  // Labels
  label: { fontWeight: '700', letterSpacing: 0.3 },
  label_sm: { fontSize: Fonts.sizes.sm },
  label_md: { fontSize: Fonts.sizes.md },
  label_lg: { fontSize: Fonts.sizes.lg },

  labelColor_danger: { color: Colors.textWhite },
  labelColor_primary: { color: Colors.textWhite },
  labelColor_outline: { color: Colors.danger },
  labelColor_ghost: { color: Colors.textSecondary },
});
