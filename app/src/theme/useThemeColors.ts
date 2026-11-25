import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { useSettingsStore } from '@/state/settingsStore';
import { darkColors, lightColors, ThemeColors } from './colors';

/** A screen-wide palette that replaces light / dark (e.g. a party game's own colours). */
const OverrideContext = createContext<ThemeColors | null>(null);

/** colors = null keeps the normal light / dark palette (same tree, so nothing remounts). */
export function ThemeOverride({ colors, children }: { colors: ThemeColors | null; children: React.ReactNode }) {
  return React.createElement(OverrideContext.Provider, { value: colors }, children);
}

export function useThemeColors(): { colors: ThemeColors; isDark: boolean } {
  const override = useContext(OverrideContext);
  const mode = useSettingsStore((s) => s.themeMode);
  const device = useColorScheme();
  if (override) return { colors: override, isDark: true };
  const isDark = mode === 'system' ? device === 'dark' : mode === 'dark';
  return { colors: isDark ? darkColors : lightColors, isDark };
}
