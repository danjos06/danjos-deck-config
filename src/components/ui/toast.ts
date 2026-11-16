import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';
export interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

interface ToastState {
  items: ToastItem[];
  push: (kind: ToastKind, text: string) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToastStore = create<ToastState>()((set, get) => ({
  items: [],
  push: (kind, text) => {
    const id = ++seq;
    set((s) => ({ items: [...s.items.slice(-3), { id, kind, text }] }));
    window.setTimeout(() => get().dismiss(id), kind === 'error' ? 6500 : 3500);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (t: string) => useToastStore.getState().push('success', t),
  error: (t: string) => useToastStore.getState().push('error', t),
  info: (t: string) => useToastStore.getState().push('info', t),
};
