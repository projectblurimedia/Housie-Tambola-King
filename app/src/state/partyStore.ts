import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ShowItem } from '@/services/partyService';

export interface CustomCategory {
  id: string;
  title: string;
  items: ShowItem[];
}

/** Show categories this phone's player made (kept on the phone, sent to a game when chosen). */
export const usePartyStore = create<{
  categories: CustomCategory[];
  save: (c: CustomCategory) => void;
  remove: (id: string) => void;
}>()(
  persist(
    (set) => ({
      categories: [],
      save: (c) => set((s) => ({ categories: [c, ...s.categories.filter((x) => x.id !== c.id)].slice(0, 12) })),
      remove: (id) => set((s) => ({ categories: s.categories.filter((x) => x.id !== id) })),
    }),
    { name: 'party-storage', storage: createJSONStorage(() => AsyncStorage), partialize: ({ categories }) => ({ categories }) },
  ),
);
