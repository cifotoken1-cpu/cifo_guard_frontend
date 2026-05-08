import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from './ui.store';

const DEFAULT_VISIBILITY = {
  overview: true,
  securityMode: true,
  sensorStatus: true,
  liveCameras: true,
  activityLogPanel: true,
};

describe('useUIStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      modal: null,
      toasts: [],
      sectionVisibility: { ...DEFAULT_VISIBILITY },
    });
  });

  it('has expected initial state', () => {
    const state = useUIStore.getState();
    expect(state.modal).toBeNull();
    expect(state.toasts).toEqual([]);
    expect(state.sectionVisibility).toEqual(DEFAULT_VISIBILITY);
  });

  it('does NOT have removed systemControl in default visibility (post #6 cleanup)', () => {
    const state = useUIStore.getState();
    expect(state.sectionVisibility).not.toHaveProperty('systemControl');
  });

  describe('modal', () => {
    it('openModal sets modal name', () => {
      useUIStore.getState().openModal('panic-confirm');
      expect(useUIStore.getState().modal).toBe('panic-confirm');
    });

    it('closeModal sets modal to null', () => {
      useUIStore.setState({ modal: 'alerts' });
      useUIStore.getState().closeModal();
      expect(useUIStore.getState().modal).toBeNull();
    });
  });

  describe('toasts', () => {
    it('addToast appends to toasts array with generated id', () => {
      useUIStore.getState().addToast({ type: 'info', title: 'Test', msg: 'hi' });
      const toasts = useUIStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0]).toMatchObject({ type: 'info', title: 'Test', msg: 'hi' });
      expect(toasts[0].id).toBeDefined();
    });

    it('multiple toasts get unique ids', () => {
      const { addToast } = useUIStore.getState();
      addToast({ title: 'A' });
      addToast({ title: 'B' });
      addToast({ title: 'C' });

      const ids = useUIStore.getState().toasts.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });

    it('removeToast filters by id', () => {
      const { addToast } = useUIStore.getState();
      addToast({ title: 'A' });
      addToast({ title: 'B' });
      const idToRemove = useUIStore.getState().toasts[0].id;

      useUIStore.getState().removeToast(idToRemove);

      const remaining = useUIStore.getState().toasts;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].title).toBe('B');
    });
  });

  describe('sectionVisibility', () => {
    it('toggleSection flips boolean for given section', () => {
      const { toggleSection } = useUIStore.getState();
      toggleSection('overview');
      expect(useUIStore.getState().sectionVisibility.overview).toBe(false);

      toggleSection('overview');
      expect(useUIStore.getState().sectionVisibility.overview).toBe(true);
    });

    it('setSectionVisibility merges partial config', () => {
      useUIStore.getState().setSectionVisibility({ overview: false, sensorStatus: false });
      const v = useUIStore.getState().sectionVisibility;
      expect(v.overview).toBe(false);
      expect(v.sensorStatus).toBe(false);
      // Others preserved
      expect(v.securityMode).toBe(true);
      expect(v.liveCameras).toBe(true);
    });

    it('resetSectionVisibility restores all true', () => {
      const { setSectionVisibility, resetSectionVisibility } = useUIStore.getState();
      setSectionVisibility({ overview: false, sensorStatus: false, liveCameras: false });
      resetSectionVisibility();

      const v = useUIStore.getState().sectionVisibility;
      Object.values(v).forEach((val) => expect(val).toBe(true));
    });
  });
});
