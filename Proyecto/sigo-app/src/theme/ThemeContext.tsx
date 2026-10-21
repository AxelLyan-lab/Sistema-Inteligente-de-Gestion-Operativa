import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, ThemeColors } from './index';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  Colors: ThemeColors;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
}

const STORAGE_KEY = 'sigo_theme_mode';
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(system === 'dark' ? 'dark' : 'light');

  // Restaurar preferencia guardada del usuario
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(v => { if (v === 'light' || v === 'dark') setModeState(v); })
      .catch(() => {});
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
  }, []);

  const toggle = useCallback(() => setMode(mode === 'dark' ? 'light' : 'dark'), [mode, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      Colors: mode === 'dark' ? darkColors : lightColors,
      mode,
      isDark: mode === 'dark',
      setMode,
      toggle,
    }),
    [mode, setMode, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return ctx;
}

/** Crea estilos dependientes del tema, memorizados por modo. */
export function useThemedStyles<T>(factory: (c: ThemeColors) => T): T {
  const { Colors } = useTheme();
  return useMemo(() => factory(Colors), [Colors]);
}
