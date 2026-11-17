import { useCallback, useEffect } from 'react';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/state/settingsStore';
import { speechLanguageCode, spokenCall } from '@/game/engine/calls';
import type { SupportedLanguage } from '@/localization/languages';

/**
 * Announces called numbers (voice + haptic tick). The voice language follows the app
 * language unless the caller passes its own (Caller Mode has an English/Telugu switch).
 */
export function useCaller(voiceLanguage?: SupportedLanguage) {
  const voice = useSettingsStore((s) => s.voice);
  const appLanguage = useSettingsStore((s) => s.language);
  const haptics = useSettingsStore((s) => s.haptics);
  const language = voiceLanguage ?? appLanguage;

  useEffect(() => () => void Speech.stop(), []);

  const announce = useCallback(
    (n: number) => {
      if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      if (!voice) return;
      Speech.stop();
      Speech.speak(spokenCall(n), { language: speechLanguageCode(language), rate: 0.9, volume: 1 });
    },
    [voice, language, haptics],
  );

  const celebrate = useCallback(() => {
    if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [haptics]);

  const buzz = useCallback(() => {
    if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
  }, [haptics]);

  return { announce, celebrate, buzz };
}
