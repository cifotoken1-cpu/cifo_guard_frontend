import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * UI state — modals, toasts, panic confirm, and dashboard panel visibility.
 * Section visibility is persisted to localStorage.
 */
export const useUIStore = create(
  persist(
    (set) => ({
      modal: null, // 'alerts' | 'cameras' | 'panic-confirm' | null
      toasts: [],

      // Dashboard section visibility state
      sectionVisibility: {
        overview: true,
        systemControl: true,
        securityMode: true,
        sensorStatus: true,
        liveCameras: true,
        activityLogPanel: true,
      },

      openModal: (name) => set({ modal: name }),
      closeModal: () => set({ modal: null }),

      addToast: (toast) =>
        set((state) => ({
          toasts: [
            ...state.toasts,
            { id: Date.now() + Math.random(), ...toast },
          ],
        })),
      removeToast: (id) =>
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

      toggleSection: (sectionId) =>
        set((state) => ({
          sectionVisibility: {
            ...state.sectionVisibility,
            [sectionId]: !state.sectionVisibility[sectionId],
          },
        })),

      setSectionVisibility: (config) =>
        set((state) => ({
          sectionVisibility: {
            ...state.sectionVisibility,
            ...config,
          },
        })),

      resetSectionVisibility: () =>
        set({
          sectionVisibility: {
            overview: true,
            systemControl: true,
            securityMode: true,
            sensorStatus: true,
            liveCameras: true,
            activityLogPanel: true,
          },
        }),
    }),
    {
      name: 'cifo-ui-store',
      partialize: (state) => ({
        sectionVisibility: state.sectionVisibility,
      }),
    }
  )
);
