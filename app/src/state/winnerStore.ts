import { create } from 'zustand';
import type { PrizeType } from '@/game/engine/ticket';
import type { Winner } from '@/types/api';

export interface WinnerAnnouncement {
  id: string;
  prize: PrizeType;
  amount: number;
  winners: Winner[];
}

/**
 * Queue of winner announcements shown one after another on every phone in the room.
 * A shared prize arrives as two broadcasts (first winner, then both): the later one
 * replaces the queued/showing entry for the same prize instead of adding a duplicate.
 */
interface WinnerState {
  queue: WinnerAnnouncement[];
  announce: (a: Omit<WinnerAnnouncement, 'id'> & { gameId: string }) => void;
  dismiss: () => void;
  clear: () => void;
}

export const useWinnerStore = create<WinnerState>((set) => ({
  queue: [],
  announce: ({ gameId, ...a }) =>
    set((s) => {
      const id = `${gameId}:${a.prize}`;
      const existing = s.queue.findIndex((q) => q.id === id);
      if (existing >= 0) {
        const queue = s.queue.slice();
        queue[existing] = { id, ...a };
        return { queue };
      }
      return { queue: [...s.queue, { id, ...a }] };
    }),
  dismiss: () => set((s) => ({ queue: s.queue.slice(1) })),
  clear: () => set({ queue: [] }),
}));
