import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Auth state. JWT token is persisted to localStorage so refresh keeps user logged in.
 */
export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      role: null,

      login: ({ token, user, role }) => set({ token, user, role }),
      logout: () => set({ token: null, user: null, role: null }),
      setUser: (user) => set({ user }),
    }),
    {
      name: 'cifo-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        role: state.role,
      }),
    }
  )
);
