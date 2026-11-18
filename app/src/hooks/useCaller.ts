import { useCallback, useEffect } from 'react';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { useSettingsStore, VOICE_STYLES, VoiceStyle } from '@/state/settingsStore';
import { speechLanguageCode, spokenCall } from '@/game/engine/calls';
import type { SupportedLanguage } from '@/localization/languages';

/** Speaks one number in a language, with the player's chosen voice for that language. */
export function speakNumber(n: number, language: SupportedLanguage, voiceId?: string | null, style: VoiceStyle = 'normal', queue = false) {
  const { pitch, rate } = VOICE_STYLES[style] ?? VOICE_STYLES.normal;
  if (!queue) Speech.stop();
  Speech.speak(spokenCall(n, language), {
    language: speechLanguageCode(language),
    voice: voiceId ?? undefined,
    pitch,
    rate,
    volume: 1,
  });
}

/**
 * Announces called numbers (voice + haptic tick). The voice language follows the app
 * language unless the caller passes its own (Caller Mode has an English/Telugu switch).
 */
export function useCaller(voiceLanguage?: SupportedLanguage | 'both') {
  const voice = useSettingsStore((s) => s.voice);
  const appLanguage = useSettingsStore((s) => s.language);
  const haptics = useSettingsStore((s) => s.haptics);
  const voiceByLanguage = useSettingsStore((s) => s.voiceByLanguage);
  const voiceStyle = useSettingsStore((s) => s.voiceStyle);
  const both = voiceLanguage === 'both';
  const language: SupportedLanguage = voiceLanguage && voiceLanguage !== 'both' ? voiceLanguage : appLanguage;
  const voiceId = voiceByLanguage[language];

  useEffect(() => () => void Speech.stop(), []);

  const announce = useCallback(
    (n: number) => {
      if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      if (!voice) return;
      if (both) {
        speakNumber(n, 'en', voiceByLanguage.en, voiceStyle);
        speakNumber(n, 'te', voiceByLanguage.te, voiceStyle, true);
      } else speakNumber(n, language, voiceId, voiceStyle);
    },
    [voice, both, language, voiceId, voiceByLanguage, voiceStyle, haptics],
  );

  const celebrate = useCallback(() => {
    if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [haptics]);

  const buzz = useCallback(() => {
    if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
  }, [haptics]);

  return { announce, celebrate, buzz };
}
