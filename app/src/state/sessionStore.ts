import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

/** Mirror of the Supabase auth session (Supabase persists it; this just makes it reactive). */
interface SessionState {
  session: Session | null;
  isReady: boolean;
  setSession: (session: Session | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  isReady: false,
  setSession: (session) => set({ session, isReady: true }),
}));
