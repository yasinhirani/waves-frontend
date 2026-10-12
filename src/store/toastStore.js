import { create } from 'zustand';

let id = 0;
export const useToastStore = create((set) => ({
  toasts: [],
  push: (message, kind = 'info') => {
    const toast = { id: ++id, message, kind };
    set((s) => ({ toasts: [...s.toasts.slice(-2), toast] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== toast.id) })), 3500);
  }
}));

export const toast = {
  error: (m) => useToastStore.getState().push(m, 'error'),
  info: (m) => useToastStore.getState().push(m, 'info')
};
