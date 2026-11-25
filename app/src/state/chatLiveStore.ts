import { create } from 'zustand';

export interface Typer {
  userId: string;
  name: string;
  avatarKey: string;
  at: number;
}

/**
 * Live chat signals per room: who is typing (expires after a few seconds) and how far each
 * member has read (for the seen ticks). Filled from the room's realtime channel.
 */
interface ChatLiveState {
  typing: Record<string, Typer[]>;
  reads: Record<string, Record<string, number>>;
  setTyping: (roomId: string, t: Typer) => void;
  pruneTyping: (roomId: string) => void;
  setRead: (roomId: string, userId: string, lastReadId: number) => void;
  setReads: (roomId: string, reads: { userId: string; lastReadId: number }[]) => void;
}

export const TYPING_MS = 4000;

export const useChatLiveStore = create<ChatLiveState>((set) => ({
  typing: {},
  reads: {},
  setTyping: (roomId, t) =>
    set((s) => ({ typing: { ...s.typing, [roomId]: [...(s.typing[roomId] ?? []).filter((x) => x.userId !== t.userId), t] } })),
  pruneTyping: (roomId) =>
    set((s) => {
      const list = (s.typing[roomId] ?? []).filter((x) => Date.now() - x.at < TYPING_MS);
      return list.length === (s.typing[roomId] ?? []).length ? s : { typing: { ...s.typing, [roomId]: list } };
    }),
  setRead: (roomId, userId, lastReadId) =>
    set((s) => ({ reads: { ...s.reads, [roomId]: { ...(s.reads[roomId] ?? {}), [userId]: Math.max(lastReadId, s.reads[roomId]?.[userId] ?? 0) } } })),
  setReads: (roomId, reads) =>
    set((s) => ({ reads: { ...s.reads, [roomId]: Object.fromEntries(reads.map((r) => [r.userId, Number(r.lastReadId)])) } })),
}));
