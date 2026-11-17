import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { newDrawOrder } from '@/game/engine/ticket';

/**
 * Caller Mode board for a real-life game. Persisted, so closing the app mid-game
 * (or a phone call) doesn't lose the numbers already called.
 */
interface CallerState {
  drawOrder: number[];
  called: number[];
  intervalSeconds: number;
  callNext: () => number | null;
  undo: () => void;
  reset: () => void;
  setInterval: (s: number) => void;
}

export const useCallerStore = create<CallerState>()(
  persist(
    (set, get) => ({
      drawOrder: newDrawOrder(),
      called: [],
      intervalSeconds: 6,
      callNext: () => {
        const { drawOrder, called } = get();
        if (called.length >= 90) return null;
        const n = drawOrder[called.length];
        set({ called: [...called, n] });
        return n;
      },
      undo: () => set((s) => ({ called: s.called.slice(0, -1) })),
      reset: () => set({ drawOrder: newDrawOrder(), called: [] }),
      setInterval: (intervalSeconds) => set({ intervalSeconds }),
    }),
    { name: 'caller-storage', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
