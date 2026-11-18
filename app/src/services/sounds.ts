import * as Haptics from 'expo-haptics';
import { requireOptionalNativeModule } from 'expo';
import { FAST_PRIZES, LINE_PRIZES, COLUMN_PRIZES, PrizeType } from '@/game/engine/ticket';

export type PrizeSound = 'fast' | 'line' | 'column' | 'fullhouse';

const SOURCES: Record<PrizeSound, number> = {
  fast: require('../../assets/sounds/fast.wav'),
  line: require('../../assets/sounds/line.wav'),
  column: require('../../assets/sounds/column.wav'),
  fullhouse: require('../../assets/sounds/fullhouse.wav'),
};

export function soundFor(prize: PrizeType): PrizeSound {
  if (prize === 'full_house') return 'fullhouse';
  if (FAST_PRIZES.includes(prize)) return 'fast';
  if (LINE_PRIZES.includes(prize)) return 'line';
  if (COLUMN_PRIZES.includes(prize)) return 'column';
  return 'fast';
}

/** Several prizes on one number play one sound: Full Housie wins, then lines, columns, fast. */
const PRIORITY: PrizeSound[] = ['fullhouse', 'line', 'column', 'fast'];
export function pickSound(prizes: PrizeType[]): PrizeSound {
  const kinds = new Set(prizes.map(soundFor));
  return PRIORITY.find((k) => kinds.has(k)) ?? 'fast';
}

type Player = { play: () => void; seekTo: (s: number) => Promise<void> | void; volume: number };
type AudioModule = {
  createAudioPlayer: (source: number) => Player;
  setAudioModeAsync?: (mode: Record<string, unknown>) => Promise<void>;
};

/**
 * expo-audio is loaded lazily: builds made before it was added have no native module, and
 * they fall back to a haptic pattern. The native module must be checked FIRST — requiring a
 * package whose native side is missing is a fatal error in Metro (try/catch can't stop it).
 */
let audio: AudioModule | null | undefined;
function loadAudio(): AudioModule | null {
  if (audio !== undefined) return audio;
  if (!requireOptionalNativeModule('ExpoAudio')) {
    audio = null;
    return audio;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    audio = require('expo-audio') as AudioModule;
    audio.setAudioModeAsync?.({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => undefined);
  } catch {
    audio = null;
  }
  return audio;
}

const players: Partial<Record<PrizeSound, Player>> = {};

const HAPTIC_PATTERNS: Record<PrizeSound, number[]> = {
  fast: [0, 90, 180],
  line: [0, 220],
  column: [0, 120, 240],
  fullhouse: [0, 150, 300, 450, 700],
};

export function playPrizeSound(kind: PrizeSound, withHaptics = true) {
  const mod = loadAudio();
  let played = false;
  if (mod) {
    try {
      const player = players[kind] ?? (players[kind] = mod.createAudioPlayer(SOURCES[kind]));
      player.volume = 1;
      Promise.resolve(player.seekTo(0)).catch(() => undefined);
      player.play();
      played = true;
    } catch {
      played = false;
    }
  }
  if (withHaptics || !played) {
    HAPTIC_PATTERNS[kind].forEach((ms) =>
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined), ms),
    );
  }
}
