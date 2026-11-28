import { create } from 'zustand';

/**
 * "I have it too" during a check: the called numbers on my tickets that I haven't struck yet glow
 * (like the auto hint) until the next number is called — so a player sees exactly what they missed.
 */
type MissedHint = { gameId: string | null; call: number; set: (gameId: string, call: number) => void };

export const useMissedHint = create<MissedHint>((set) => ({
  gameId: null,
  call: -1,
  set: (gameId, call) => set({ gameId, call }),
}));
