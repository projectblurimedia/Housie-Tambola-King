import { create } from 'zustand';

export interface PauseRequest {
  gameId: string;
  userId: string;
  name: string;
  /** ISO time the request was made. */
  at: string;
}

/**
 * Players' "please pause" requests as they arrive live (host only). The host's banner merges
 * these with the ones in the room state (so a missed live message still shows), and hides
 * everything up to `dismissedAt` once the host pauses or closes the banner.
 */
interface PauseRequestState {
  items: PauseRequest[];
  dismissedAt: number;
  add: (r: PauseRequest) => void;
  dismiss: () => void;
}

export const usePauseRequestStore = create<PauseRequestState>((set) => ({
  items: [],
  dismissedAt: 0,
  add: (r) => set((s) => ({ items: [...s.items.filter((x) => x.userId !== r.userId || x.gameId !== r.gameId), r].slice(-10) })),
  dismiss: () => set({ items: [], dismissedAt: Date.now() }),
}));
