import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      username: null,
      anonymous: false,
      setAuth: (token, username, anonymous = false) => set({ token, username, anonymous }),
      clearAuth: () => set({ token: null, username: null, anonymous: false }),
    }),
    { name: 'chess-auth' },
  ),
);
