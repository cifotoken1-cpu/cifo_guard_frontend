import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * System-level UI state.
 * NOTE: armed/mode are currently client-side only — backend doesn't yet
 * expose POST /api/system/arm. Persist locally so refresh remembers state.
 */
export const useSystemStore = create(
  persist(
    (set) => ({
      armed: false,
      mode: 'home', // 'home' | 'night' | 'silent' | 'panic'
      activeNav: 'security',
      sidebarCollapsed: false,

      setArmed: (armed) => set({ armed }),
      setMode: (mode) => set({ mode }),
      setActiveNav: (activeNav) => set({ activeNav }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    }),
    {
      name: 'cifo-system',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
