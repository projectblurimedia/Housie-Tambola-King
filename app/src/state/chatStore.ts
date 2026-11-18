import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * This phone's chat preferences: players it has muted (their messages are hidden here only)
 * and the last message seen per room (for the unread badge).
 */
interface ChatState {
  muted: Record<string, true>;
  lastSeen: Record<string, number>;
  toggleMute: (userId: string) => void;
  markSeen: (roomId: string, messageId: number) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      muted: {},
      lastSeen: {},
      toggleMute: (userId) =>
        set((s) => {
          const muted = { ...s.muted };
          if (muted[userId]) delete muted[userId];
          else muted[userId] = true;
          return { muted };
        }),
      markSeen: (roomId, messageId) =>
        set((s) => (s.lastSeen[roomId] && s.lastSeen[roomId] >= messageId ? s : { lastSeen: { ...s.lastSeen, [roomId]: messageId } })),
    }),
    { name: 'chat-storage', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
