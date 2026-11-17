/**
 * Festive tambola palette: royal violet + marigold gold. Brand colors stay constant;
 * only surfaces/text change between light and dark (same model as NearbyU).
 */
const brand = {
  primary: '#7C3AED',
  primaryDark: '#4C1D95',
  primaryLight: '#A78BFA',
  gold: '#F5B700',
  goldDark: '#B45309',
  pink: '#EC4899',
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  gold: string;
  goldDark: string;
  pink: string;
  success: string;
  warning: string;
  error: string;
  white: string;
  black: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  ticketBg: string;
  ticketBlank: string;
  ticketNumber: string;
  marked: string;
  overlay: string;
}

export const lightColors: ThemeColors = {
  ...brand,
  background: '#F7F3FF',
  surface: '#FFFFFF',
  surfaceAlt: '#EFE7FF',
  text: '#1B1030',
  textMuted: '#6B6380',
  border: '#E2D9F3',
  ticketBg: '#FFFDF5',
  ticketBlank: '#F3EDE0',
  ticketNumber: '#1B1030',
  marked: '#7C3AED',
  overlay: 'rgba(20,8,40,0.55)',
};

export const darkColors: ThemeColors = {
  ...brand,
  background: '#120824',
  surface: '#1E1236',
  surfaceAlt: '#2A1A4A',
  text: '#F4EEFF',
  textMuted: '#A99BC7',
  border: '#33245A',
  ticketBg: '#FFF8E6',
  ticketBlank: '#E9DFC7',
  ticketNumber: '#1B1030',
  marked: '#7C3AED',
  overlay: 'rgba(0,0,0,0.65)',
};

export const heroGradient = ['#4C1D95', '#7C3AED', '#C026D3'] as const;
export const goldGradient = ['#FDE68A', '#F5B700', '#D97706'] as const;
