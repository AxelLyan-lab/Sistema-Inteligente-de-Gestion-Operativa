/**
 * GnssStatusPanel — mini barra de estado operativo, translúcida, sobre el mapa.
 * Muestra únicamente: En zona · Fuera de zona · En camino · Disponible.
 * (No expone latitud/longitud ni otros datos técnicos de GNSS).
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { ThemeColors } from '../../theme';
import { useTheme, useThemedStyles } from '../../theme/ThemeContext';

export type EstadoBarra = 'EN_ZONA' | 'FUERA_ZONA' | 'EN_CAMINO' | 'DISPONIBLE';

interface GnssStatusPanelProps {
  estado: EstadoBarra;
}

const LABELS: Record<EstadoBarra, string> = {
  EN_ZONA: 'En zona',
  FUERA_ZONA: 'Fuera de zona',
  EN_CAMINO: 'En camino',
  DISPONIBLE: 'Disponible',
};

export default function GnssStatusPanel({ estado }: GnssStatusPanelProps) {
  const { Colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const pulse = useRef(new Animated.Value(1)).current;

  const color =
    estado === 'EN_ZONA' ? '#4ADE80'
    : estado === 'FUERA_ZONA' ? '#F87171'
    : estado === 'EN_CAMINO' ? '#60A5FA'
    : '#E5E7EB';

  // Pulso suave cuando la unidad está en camino o fuera de zona
  useEffect(() => {
    if (estado === 'EN_CAMINO' || estado === 'FUERA_ZONA') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
  }, [estado]);

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.bar}>
        <Animated.View style={[styles.dot, { backgroundColor: color, opacity: pulse }]} />
        <Text style={[styles.label, { color }]}>{LABELS[estado]}</Text>
      </View>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      bottom: 10,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 6,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.38)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  });
