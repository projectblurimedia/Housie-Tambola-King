import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Numbers the player struck on each ticket. Persisted so an app restart mid-game doesn't
 * wipe the strikes; only the most recent tickets are kept. The server never needs strikes —
 * it checks every claim against the numbers it actually called.
 */
interface MarksState {
  marks: Record<string, number[]>;
  /** Insertion order of ticket ids, oldest first (for pruning). */
  order: string[];
  strike: (ticketId: string, n: number) => void;
  unstrike: (ticketId: string, n: number) => void;
}

const KEEP_TICKETS = 40;

export const useMarksStore = create<MarksState>()(
  persist(
    (set) => ({
      marks: {},
      order: [],
      strike: (ticketId, n) =>
        set((s) => {
          const current = s.marks[ticketId] ?? [];
          if (current.includes(n)) return s;
          const order = s.order.includes(ticketId) ? s.order : [...s.order, ticketId];
          const marks = { ...s.marks, [ticketId]: [...current, n] };
          while (order.length > KEEP_TICKETS) delete marks[order.shift()!];
          return { marks, order };
        }),
      unstrike: (ticketId, n) =>
        set((s) => ({ marks: { ...s.marks, [ticketId]: (s.marks[ticketId] ?? []).filter((x) => x !== n) } })),
    }),
    { name: 'marks-storage', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
