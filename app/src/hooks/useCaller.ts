import { useCallback, useEffect } from 'react';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/state/settingsStore';
import { speechLanguageCode, spokenCall } from '@/game/engine/calls';

/** Announces called numbers (voice + haptic tick) according to the player's settings. */
export function useCaller() {
  const voice = useSettingsStore((s) => s.voice);
  const language = useSettingsStore((s) => s.language);
  const callStyle = useSettingsStore((s) => s.callStyle);
  const haptics = useSettingsStore((s) => s.haptics);

  useEffect(() => () => void Speech.stop(), []);

  const announce = useCallback(
    (n: number) => {
      if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      if (!voice) return;
      Speech.stop();
      Speech.speak(spokenCall(n, language, callStyle), {
        language: speechLanguageCode(language),
        rate: 0.95,
        volume: 1,
        pitch: 1.05,
      });
    },
    [voice, language, callStyle, haptics],
  );

  const celebrate = useCallback(() => {
    if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [haptics]);

  const buzz = useCallback(() => {
    if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
  }, [haptics]);

  return { announce, celebrate, buzz };
}
