import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Animated,
  Easing,
  StyleSheet,
  Pressable,
  ViewStyle,
} from 'react-native';

interface SmoothModalProps {
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
  overlayStyle?: ViewStyle;
}

/**
 * SmoothModal — Contenedor modal con transición suave de opacidad y escala/deslizamiento
 * para evitar apariciones bruscas en Android.
 */
export default function SmoothModal({
  visible,
  onRequestClose,
  children,
  overlayStyle,
}: SmoothModalProps) {
  const [rendered, setRendered] = useState(visible);
  const backdropAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const cardAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      backdropAnim.setValue(0);
      cardAnim.setValue(0);
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(cardAnim, {
          toValue: 1,
          damping: 20,
          stiffness: 240,
          mass: 0.85,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (rendered) {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 160,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cardAnim, {
          toValue: 0,
          duration: 150,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [visible]);

  if (!rendered) return null;

  const translateY = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [26, 0],
  });
  const scale = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1],
  });

  return (
    <Modal
      transparent
      visible={rendered}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <Animated.View style={[styles.overlay, overlayStyle, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onRequestClose} />
        <Animated.View
          style={{
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: cardAnim,
            transform: [{ translateY }, { scale }],
          }}
          pointerEvents="box-none"
        >
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});
