import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, { deviceLanguage, SupportedLanguage } from '@/localization/i18n';
import type { StrikeColorKey, TicketThemeKey } from '@/theme/ticketThemes';

export type ThemeMode = 'system' | 'light' | 'dark';

/** Pitch/speed variations so the same engine voice can sound different. */
export const VOICE_STYLES = {
  normal: { pitch: 1, rate: 0.9 },
  deep: { pitch: 0.6, rate: 0.82 },
  high: { pitch: 1.5, rate: 0.95 },
  slow: { pitch: 1, rate: 0.68 },
  fast: { pitch: 1.05, rate: 1.15 },
} as const;
export type VoiceStyle = keyof typeof VOICE_STYLES;

interface SettingsState {
  language: SupportedLanguage;
  hasSelectedLanguage: boolean;
  themeMode: ThemeMode;
  /** Speak each called number aloud. */
  voice: boolean;
  haptics: boolean;
  /** Chosen TTS voice identifier per language (null = phone default for that language). */
  voiceByLanguage: Partial<Record<SupportedLanguage, string | null>>;
  voiceStyle: VoiceStyle;
  /** Prize sound effects in the winner announcement. */
  sounds: boolean;
  ticketTheme: TicketThemeKey;
  strikeColor: StrikeColorKey;
  isHydrated: boolean;
  setLanguage: (language: SupportedLanguage) => void;
  confirmLanguage: () => void;
  set: (patch: Partial<Pick<SettingsState, 'themeMode' | 'voice' | 'haptics' | 'voiceStyle' | 'sounds' | 'ticketTheme' | 'strikeColor'>>) => void;
  setVoiceFor: (language: SupportedLanguage, voiceId: string | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: deviceLanguage,
      hasSelectedLanguage: false,
      themeMode: 'system',
      voice: true,
      haptics: true,
      voiceByLanguage: {},
      voiceStyle: 'normal',
      sounds: true,
      ticketTheme: 'classic',
      strikeColor: 'purple',
      isHydrated: false,
      setLanguage: (language) => {
        i18n.changeLanguage(language);
        set({ language });
      },
      confirmLanguage: () => set({ hasSelectedLanguage: true }),
      set: (patch) => set(patch),
      setVoiceFor: (language, voiceId) => set((s) => ({ voiceByLanguage: { ...s.voiceByLanguage, [language]: voiceId } })),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ isHydrated: _h, setLanguage: _a, confirmLanguage: _b, set: _c, setVoiceFor: _d, ...rest }) => rest,
      onRehydrateStorage: () => (state) => {
        if (state) i18n.changeLanguage(state.language);
        useSettingsStore.setState({ isHydrated: true });
      },
    },
  ),
);
