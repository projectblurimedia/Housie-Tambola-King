import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, { deviceLanguage, SupportedLanguage } from '@/localization/i18n';
import { toPalette, type HintColorKey, type StrikeColorKey, type TicketShape, type TicketThemeKey } from '@/theme/ticketThemes';

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
  /** A short pop for every number struck. */
  strikeSound: boolean;
  /** Number cell shape on tickets. */
  ticketShape: TicketShape;
  ticketTheme: TicketThemeKey;
  strikeColor: StrikeColorKey;
  hintColor: HintColorKey;
  isHydrated: boolean;
  setLanguage: (language: SupportedLanguage) => void;
  confirmLanguage: () => void;
  set: (patch: Partial<Pick<SettingsState, 'themeMode' | 'voice' | 'haptics' | 'voiceStyle' | 'sounds' | 'strikeSound' | 'ticketShape' | 'ticketTheme' | 'strikeColor' | 'hintColor'>>) => void;
  setVoiceFor: (language: SupportedLanguage, voiceId: string | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: deviceLanguage,
      hasSelectedLanguage: false,
      themeMode: 'system',
      voice: true,
      // Vibration is off unless the player turns it on.
      haptics: false,
      voiceByLanguage: {},
      voiceStyle: 'normal',
      sounds: true,
      strikeSound: true,
      ticketShape: 'box',
      ticketTheme: 'purple',
      strikeColor: 'purple',
      hintColor: 'pink',
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
      // v1: ticket / strike / hint colours share one palette (old theme names are mapped).
      // v2: vibration off by default — switched off once for everyone (they can turn it back on).
      // v3: Box is the default number shape (switched once for everyone).
      version: 3,
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Record<string, unknown>;
        return {
          ...s,
          ...(version < 2 ? { haptics: false } : {}),
          ...(version < 3 ? { ticketShape: 'box' } : {}),
          ticketTheme: toPalette(s.ticketTheme as string | undefined, 'purple'),
          strikeColor: toPalette(s.strikeColor as string | undefined, 'purple'),
          hintColor: toPalette(s.hintColor as string | undefined, 'pink'),
        } as never;
      },
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ isHydrated: _h, setLanguage: _a, confirmLanguage: _b, set: _c, setVoiceFor: _d, ...rest }) => rest,
      onRehydrateStorage: () => (state) => {
        if (state) i18n.changeLanguage(state.language);
        useSettingsStore.setState({ isHydrated: true });
      },
    },
  ),
);
