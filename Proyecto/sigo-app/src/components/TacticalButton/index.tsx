import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { BorderRadius, Fonts, Spacing, ThemeColors } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

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
 * TacticalButton — Botón de acción S.I.G.O. (plano, sin sombras)
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
  const { Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

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
          color={variant === 'outline' || variant === 'ghost' ? Colors.primary : Colors.onPrimary}
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

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      borderRadius: BorderRadius.md,
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
      borderWidth: 1,
      borderColor: Colors.primary,
    },
    variant_ghost: { backgroundColor: 'transparent' },

    disabled: { opacity: 0.5 },

    // Labels
    label: { fontWeight: '600', letterSpacing: 0.2 },
    label_sm: { fontSize: Fonts.sizes.sm },
    label_md: { fontSize: Fonts.sizes.md },
    label_lg: { fontSize: Fonts.sizes.lg },

    labelColor_danger: { color: '#FFFFFF' },
    labelColor_primary: { color: Colors.onPrimary },
    labelColor_outline: { color: Colors.primary },
    labelColor_ghost: { color: Colors.textSecondary },
  });
