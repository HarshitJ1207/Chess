import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      username: null,
      setAuth: (token, username) => set({ token, username }),
      clearAuth: () => set({ token: null, username: null }),
    }),
    { name: 'chess-auth' },
  ),
);
