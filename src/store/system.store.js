import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * System-level UI state.
 */
export const useSystemStore = create(
  persist(
    (set) => ({
      activeNav: 'security',
      sidebarCollapsed: false,

      setActiveNav: (activeNav) => set({ activeNav }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    }),
    {
      name: 'cifo-system',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
