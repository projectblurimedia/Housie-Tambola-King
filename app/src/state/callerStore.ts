import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { newDrawOrder } from '@/game/engine/ticket';
import type { SupportedLanguage } from '@/localization/languages';

export const CALLER_SPEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/**
 * Caller Mode board for a real-life game. Persisted, so closing the app mid-game
 * (or a phone call) doesn't lose the numbers already called.
 */
interface CallerState {
  drawOrder: number[];
  called: number[];
  /** Seconds between automatic calls (1–10). */
  intervalSeconds: number;
  /** Caller voice language, independent of the app language. */
  voiceLanguage: SupportedLanguage;
  callNext: () => number | null;
  undo: () => void;
  reset: () => void;
  setInterval: (s: number) => void;
  setVoiceLanguage: (l: SupportedLanguage) => void;
}

export const useCallerStore = create<CallerState>()(
  persist(
    (set, get) => ({
      drawOrder: newDrawOrder(),
      called: [],
      intervalSeconds: 4,
      voiceLanguage: 'en',
      callNext: () => {
        const { drawOrder, called } = get();
        if (called.length >= 90) return null;
        const n = drawOrder[called.length];
        set({ called: [...called, n] });
        return n;
      },
      undo: () => set((s) => ({ called: s.called.slice(0, -1) })),
      reset: () => set({ drawOrder: newDrawOrder(), called: [] }),
      setInterval: (intervalSeconds) => set({ intervalSeconds: Math.min(10, Math.max(1, intervalSeconds)) }),
      setVoiceLanguage: (voiceLanguage) => set({ voiceLanguage }),
    }),
    {
      name: 'caller-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // v2: speeds became 1–10 s and a voice language was added.
      version: 2,
      migrate: (state) => {
        const s = state as Partial<CallerState>;
        return { ...s, intervalSeconds: Math.min(10, Math.max(1, s.intervalSeconds ?? 4)), voiceLanguage: s.voiceLanguage ?? 'en' } as CallerState;
      },
    },
  ),
);
