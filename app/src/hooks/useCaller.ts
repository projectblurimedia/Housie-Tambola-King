import { useCallback, useEffect } from 'react';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { useSettingsStore, VOICE_STYLES, VoiceStyle } from '@/state/settingsStore';
import { speechLanguageCode, spokenCall } from '@/game/engine/calls';
import type { SupportedLanguage } from '@/localization/languages';

/** When the caller last finished / started speaking, and how many utterances are queued. */
let lastSpokeAt = 0;
let pending = 0;
let warmedUp = false;

/** After this much quiet, the phone's audio output has gone idle (game start, after a pause). */
const IDLE_MS = 6000;
/**
 * Said before the first number after a quiet gap: waking the audio output swallows the start
 * of the next sentence, so it swallows this short word instead of the number.
 */
const LEAD_IN: Record<SupportedLanguage, string> = { en: 'Number', te: 'నంబర్' };

/** Binds the phone's speech engine early (no sound), so the first call starts faster. */
export function warmUpSpeech() {
  if (warmedUp) return;
  warmedUp = true;
  Speech.getAvailableVoicesAsync().catch(() => undefined);
}

function say(text: string, opts: Speech.SpeechOptions) {
  pending += 1;
  const settle = () => {
    pending = Math.max(0, pending - 1);
    lastSpokeAt = Date.now();
  };
  Speech.speak(text, { ...opts, onDone: settle, onStopped: settle, onError: settle });
}

/**
 * Speaks one number in a language, with the player's chosen voice for that language.
 * Numbers queue up instead of cutting each other off mid-word; only if two are already waiting
 * (very fast speeds) does it skip ahead to the newest. After a quiet gap a short "Number" goes
 * first so the number itself is always heard in full.
 */
export function speakNumber(n: number, language: SupportedLanguage, voiceId?: string | null, style: VoiceStyle = 'normal', queue = false) {
  const { pitch, rate } = VOICE_STYLES[style] ?? VOICE_STYLES.normal;
  const opts: Speech.SpeechOptions = {
    language: speechLanguageCode(language),
    voice: voiceId ?? undefined,
    pitch,
    rate,
    volume: 1,
  };
  if (!queue && pending >= 2) {
    Speech.stop();
    pending = 0;
  }
  const idle = !queue && pending === 0 && Date.now() - lastSpokeAt > IDLE_MS;
  lastSpokeAt = Date.now();
  if (idle) say(LEAD_IN[language] ?? LEAD_IN.en, opts);
  say(spokenCall(n, language), opts);
}

/** Voice test: a sentence with no numbers, so it can't be mistaken for a real call. */
const SAMPLE: Record<SupportedLanguage, string> = {
  en: 'Hello! This is your Housie caller voice.',
  te: 'నమస్తే! ఇది మీ హౌసీ కాలర్ వాయిస్.',
};

/** Plays the voice test in a language with a given voice (queue = after what's playing). */
export function speakSample(language: SupportedLanguage, voiceId?: string | null, style: VoiceStyle = 'normal', queue = false) {
  const { pitch, rate } = VOICE_STYLES[style] ?? VOICE_STYLES.normal;
  if (!queue) Speech.stop();
  Speech.speak(SAMPLE[language] ?? SAMPLE.en, {
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
