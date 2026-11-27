import { create } from 'zustand';

export interface TypingPerson {
  userId: string;
  name: string;
  avatarKey: string;
  at: number;
}

/** Who is typing in which party game's chat (from the "typing" broadcast; stale after 4 s). */
export const usePartyTyping = create<{
  typing: Record<string, Record<string, TypingPerson>>;
  set: (partyId: string, p: Omit<TypingPerson, 'at'>) => void;
  clear: (partyId: string, userId: string) => void;
}>((set) => ({
  typing: {},
  set: (partyId, p) =>
    set((s) => ({ typing: { ...s.typing, [partyId]: { ...(s.typing[partyId] ?? {}), [p.userId]: { ...p, at: Date.now() } } } })),
  clear: (partyId, userId) =>
    set((s) => {
      const room = { ...(s.typing[partyId] ?? {}) };
      delete room[userId];
      return { typing: { ...s.typing, [partyId]: room } };
    }),
}));
export const TYPING_MS = 4000;
