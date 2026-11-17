import { useCallback, useEffect } from 'react';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/state/settingsStore';
import { speechLanguageCode, spokenCall } from '@/game/engine/calls';
import type { SupportedLanguage } from '@/localization/languages';

/** Speaks one number in a language, with the player's chosen voice for that language. */
export function speakNumber(n: number, language: SupportedLanguage, voiceId?: string | null) {
  Speech.stop();
  Speech.speak(spokenCall(n, language), {
    language: speechLanguageCode(language),
    voice: voiceId ?? undefined,
    rate: 0.9,
    volume: 1,
  });
}

/**
 * Announces called numbers (voice + haptic tick). The voice language follows the app
 * language unless the caller passes its own (Caller Mode has an English/Telugu switch).
 */
export function useCaller(voiceLanguage?: SupportedLanguage) {
  const voice = useSettingsStore((s) => s.voice);
  const appLanguage = useSettingsStore((s) => s.language);
  const haptics = useSettingsStore((s) => s.haptics);
  const voiceByLanguage = useSettingsStore((s) => s.voiceByLanguage);
  const language = voiceLanguage ?? appLanguage;
  const voiceId = voiceByLanguage[language];

  useEffect(() => () => void Speech.stop(), []);

  const announce = useCallback(
    (n: number) => {
      if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      if (voice) speakNumber(n, language, voiceId);
    },
    [voice, language, voiceId, haptics],
  );

  const celebrate = useCallback(() => {
    if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [haptics]);

  const buzz = useCallback(() => {
    if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
  }, [haptics]);

  return { announce, celebrate, buzz };
}
