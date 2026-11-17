import { useColorScheme } from 'react-native';
import { useSettingsStore } from '@/state/settingsStore';
import { darkColors, lightColors, ThemeColors } from './colors';

export function useThemeColors(): { colors: ThemeColors; isDark: boolean } {
  const mode = useSettingsStore((s) => s.themeMode);
  const device = useColorScheme();
  const isDark = mode === 'system' ? device === 'dark' : mode === 'dark';
  return { colors: isDark ? darkColors : lightColors, isDark };
}
