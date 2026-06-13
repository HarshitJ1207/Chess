import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      userId: null,
      username: null,
      setAuth: (token, userId, username) => set({ token, userId, username }),
      clearAuth: () => set({ token: null, userId: null, username: null }),
    }),
    { name: 'chess-auth' },
  ),
);
