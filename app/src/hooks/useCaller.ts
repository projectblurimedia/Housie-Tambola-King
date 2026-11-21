import { useCallback, useEffect } from 'react';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { useSettingsStore, VOICE_STYLES, VoiceStyle } from '@/state/settingsStore';
import { speechLanguageCode, spokenCall } from '@/game/engine/calls';
import type { SupportedLanguage } from '@/localization/languages';

/** When a number was last spoken (to tell "still talking" from "first number after a gap"). */
let lastSpokeAt = 0;
let warmedUp = false;

/**
 * Android's speech engine starts cold: its very first sentence loses the beginning while it
 * wakes up. Waking it silently when a game / Caller Mode opens means number 1 is heard in full.
 */
export function warmUpSpeech() {
  if (warmedUp) return;
  warmedUp = true;
  Speech.getAvailableVoicesAsync().catch(() => undefined);
  try {
    Speech.speak(' ', { volume: 0, rate: 1 });
  } catch {
    // No engine yet — the first real number will start it.
  }
}

/** Speaks one number in a language, with the player's chosen voice for that language. */
export function speakNumber(n: number, language: SupportedLanguage, voiceId?: string | null, style: VoiceStyle = 'normal', queue = false) {
  const { pitch, rate } = VOICE_STYLES[style] ?? VOICE_STYLES.normal;
  // Cut off the previous number only if it may still be talking (fast speeds). Calling stop
  // on an idle / just-woken engine could swallow the number we're about to say.
  if (!queue && Date.now() - lastSpokeAt < 4000) Speech.stop();
  lastSpokeAt = Date.now();
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
export function useCaller(voiceLanguage?: SupportedLanguage | 'both', opts: { stopOnUnmount?: boolean } = {}) {
  const stopOnUnmount = opts.stopOnUnmount ?? false;
  const voice = useSettingsStore((s) => s.voice);
  const appLanguage = useSettingsStore((s) => s.language);
  const haptics = useSettingsStore((s) => s.haptics);
  const voiceByLanguage = useSettingsStore((s) => s.voiceByLanguage);
  const both = voiceLanguage === 'both';
  const language: SupportedLanguage = voiceLanguage && voiceLanguage !== 'both' ? voiceLanguage : appLanguage;
  const voiceId = voiceByLanguage[language];

  useEffect(() => {
    if (voice) warmUpSpeech();
  }, [voice]);
  // Only the screen that owns the game voice stops it when it closes (not every part inside it).
  useEffect(() => () => void (stopOnUnmount && Speech.stop()), [stopOnUnmount]);

  const announce = useCallback(
    (n: number) => {
      if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      if (!voice) return;
      if (both) {
        speakNumber(n, 'en', voiceByLanguage.en);
        speakNumber(n, 'te', voiceByLanguage.te, 'normal', true);
      } else speakNumber(n, language, voiceId);
    },
    [voice, both, language, voiceId, voiceByLanguage, haptics],
  );

  const celebrate = useCallback(() => {
    if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [haptics]);

  const buzz = useCallback(() => {
    if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
  }, [haptics]);

  return { announce, celebrate, buzz };
}
