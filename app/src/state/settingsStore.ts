import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, { deviceLanguage, SupportedLanguage } from '@/localization/i18n';

export type ThemeMode = 'system' | 'light' | 'dark';

interface SettingsState {
  language: SupportedLanguage;
  hasSelectedLanguage: boolean;
  themeMode: ThemeMode;
  /** Speak each called number aloud. */
  voice: boolean;
  haptics: boolean;
  /** Chosen TTS voice identifier per language (null = phone default for that language). */
  voiceByLanguage: Partial<Record<SupportedLanguage, string | null>>;
  isHydrated: boolean;
  setLanguage: (language: SupportedLanguage) => void;
  confirmLanguage: () => void;
  set: (patch: Partial<Pick<SettingsState, 'themeMode' | 'voice' | 'haptics'>>) => void;
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
