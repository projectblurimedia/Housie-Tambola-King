import { create } from 'zustand';

/** How a room counts money: free (none), coins (play coins), amount (casual ₹, just for scoring). */
export type StakeMode = 'free' | 'coins' | 'amount';

/**
 * The stake of the room on screen. The room screen sets it, and every amount shown inside the
 * room (pot, prizes, standings, winner card) formats by it; outside a room it's 'amount' (₹).
 */
export const useStakeStore = create<{ mode: StakeMode; setMode: (m: StakeMode) => void }>((set) => ({
  mode: 'amount',
  setMode: (mode) => set({ mode }),
}));

export const isFreeRoom = () => useStakeStore.getState().mode === 'free';
