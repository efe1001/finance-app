import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, ThemeColors } from '../theme';

type ThemeContextValue = {
  colors: ThemeColors;
  mode: 'light' | 'dark';
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [override, setOverride] = useState<'light' | 'dark' | null>(null);
  const mode = override ?? (systemScheme === 'light' ? 'light' : 'dark');

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: mode === 'light' ? lightColors : darkColors,
      mode,
      toggleMode: () => setOverride(mode === 'light' ? 'dark' : 'light'),
    }),
    [mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
