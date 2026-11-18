import { create } from 'zustand';
import { prizeOrder, PrizeType } from '@/game/engine/ticket';
import type { Winner } from '@/types/api';

export interface PrizeWin {
  prize: PrizeType;
  amount: number;
  winners: Winner[];
}

export interface WinnerAnnouncement {
  /** gameId:callIndex — everything won on the same called number is one card. */
  id: string;
  items: PrizeWin[];
}

/**
 * Queue of winner announcements shown on every phone in the room. Prizes completed on the
 * same called number (e.g. Line 3 + Full Housie) merge into one card instead of showing one
 * after the other; a shared prize arriving again (first winner, then both) replaces its item.
 */
interface WinnerState {
  queue: WinnerAnnouncement[];
  announce: (a: PrizeWin & { gameId: string; callIndex: number }) => void;
  dismiss: () => void;
  clear: () => void;
}

export const useWinnerStore = create<WinnerState>((set) => ({
  queue: [],
  announce: ({ gameId, callIndex, ...win }) =>
    set((s) => {
      const id = `${gameId}:${callIndex}`;
      const at = s.queue.findIndex((q) => q.id === id);
      if (at < 0) return { queue: [...s.queue, { id, items: [win] }] };
      const entry = s.queue[at];
      const items = [...entry.items.filter((i) => i.prize !== win.prize), win].sort((a, b) => prizeOrder(a.prize) - prizeOrder(b.prize));
      const queue = s.queue.slice();
      queue[at] = { id, items };
      return { queue };
    }),
  dismiss: () => set((s) => ({ queue: s.queue.slice(1) })),
  clear: () => set({ queue: [] }),
}));
