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
  // Vibrate only when the player has vibration on (never as a stand-in for sound).
  if (withHaptics) {
    HAPTIC_PATTERNS[kind].forEach((ms) =>
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined), ms),
    );
  }
}

const STRIKE_SOURCE: number = require('../../assets/sounds/strike.wav');
let strikePlayer: Player | null = null;

/** Short "pop" when a player strikes a number (sound only; the strike already gives a haptic). */
export function playStrikeSound() {
  const mod = loadAudio();
  if (!mod) return;
  try {
    strikePlayer = strikePlayer ?? mod.createAudioPlayer(STRIKE_SOURCE);
    strikePlayer.volume = 0.7;
    Promise.resolve(strikePlayer.seekTo(0)).catch(() => undefined);
    strikePlayer.play();
  } catch {
    // No audio in this build.
  }
}

export type GameSound = 'dice' | 'step' | 'ladder' | 'snake' | 'seeds' | 'move' | 'cut' | 'home' | 'deal' | 'reveal' | 'right' | 'wrong' | 'pass' | 'pick' | 'show';
const GAME_SOURCES: Record<GameSound, number> = {
  dice: require('../../assets/sounds/dice.wav'),
  step: require('../../assets/sounds/step.wav'),
  ladder: require('../../assets/sounds/ladder.wav'),
  snake: require('../../assets/sounds/snake.wav'),
  seeds: require('../../assets/sounds/seeds.wav'),
  move: require('../../assets/sounds/move.wav'),
  cut: require('../../assets/sounds/cut.wav'),
  home: require('../../assets/sounds/home.wav'),
  // Find Seeta
  deal: require('../../assets/sounds/deal.wav'),
  reveal: require('../../assets/sounds/reveal.wav'),
  right: require('../../assets/sounds/right.wav'),
  wrong: require('../../assets/sounds/wrong.wav'),
  // Show
  pass: require('../../assets/sounds/pass.wav'),
  pick: require('../../assets/sounds/pick.wav'),
  show: require('../../assets/sounds/show.wav'),
};
const gamePlayers: Partial<Record<GameSound, Player>> = {};
const GAME_VOLUME: Record<GameSound, number> = { dice: 0.95, step: 0.5, ladder: 0.85, snake: 0.85, seeds: 0.9, move: 0.55, cut: 0.9, home: 0.85, deal: 0.7, reveal: 0.8, right: 0.9, wrong: 0.8, pass: 0.6, pick: 0.5, show: 0.95 };

/**
 * Board-game effects: dice, a pop per square, ladder harp, snake slide (Snakes & Ladders);
 * seeds, step, cut and home (Ashta Chamma).
 * Only when the player has Sounds on (Profile); silent on builds without the audio module.
 */
export function playGameSound(kind: GameSound) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useSettingsStore } = require('@/state/settingsStore') as typeof import('@/state/settingsStore');
  if (!useSettingsStore.getState().sounds) return;
  const mod = loadAudio();
  if (!mod) return;
  try {
    const player = gamePlayers[kind] ?? (gamePlayers[kind] = mod.createAudioPlayer(GAME_SOURCES[kind]));
    player.volume = GAME_VOLUME[kind];
    Promise.resolve(player.seekTo(0)).catch(() => undefined);
    player.play();
  } catch {
    // No audio in this build.
  }
}
