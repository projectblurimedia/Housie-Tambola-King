import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info' | 'prize';

export interface ToastMessage {
  id: number;
  variant: ToastVariant;
  title: string;
  message?: string;
}

interface ToastState {
  toast: ToastMessage | null;
  hide: () => void;
}

let nextId = 0;

export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  hide: () => set({ toast: null }),
}));

/** Callable from anywhere (mutation callbacks, realtime handlers). */
export function showToast(toast: Omit<ToastMessage, 'id'>): void {
  nextId += 1;
  useToastStore.setState({ toast: { ...toast, id: nextId } });
}
