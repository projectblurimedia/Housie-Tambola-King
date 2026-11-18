import { create } from 'zustand';
import type { PrizeType } from '@/game/engine/ticket';
import type { Winner } from '@/types/api';

/** A fastest-finger claim waiting for everyone to check their tickets ("check before announcing"). */
export interface ClaimCheck {
  gameId: string;
  prize: PrizeType;
  /** The called-number position the prize was completed on. */
  callIndex: number;
  winners: Winner[];
  /** Server time the check window closes. */
  deadline: string;
}

interface ClaimCheckState {
  checks: ClaimCheck[];
  add: (c: ClaimCheck) => void;
  /** Settled / announced: no longer waiting. */
  remove: (gameId: string, prize: PrizeType) => void;
  clear: () => void;
}

export const useClaimCheckStore = create<ClaimCheckState>((set) => ({
  checks: [],
  add: (c) => set((s) => ({ checks: [...s.checks.filter((x) => !(x.gameId === c.gameId && x.prize === c.prize)), c] })),
  remove: (gameId, prize) => set((s) => ({ checks: s.checks.filter((x) => !(x.gameId === gameId && x.prize === prize)) })),
  clear: () => set({ checks: [] }),
}));
