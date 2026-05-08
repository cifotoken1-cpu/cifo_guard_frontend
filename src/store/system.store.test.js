import { describe, it, expect, beforeEach } from 'vitest';
import { useSystemStore } from './system.store';

describe('useSystemStore', () => {
  beforeEach(() => {
    // Reset to defaults — armed/mode were removed in #6/#7 cleanup
    useSystemStore.setState({
      activeNav: 'security',
      sidebarCollapsed: false,
    });
  });

  it('has expected initial state', () => {
    const state = useSystemStore.getState();
    expect(state.activeNav).toBe('security');
    expect(state.sidebarCollapsed).toBe(false);
  });

  it('does NOT expose removed keys (armed, mode, setArmed, setMode)', () => {
    const state = useSystemStore.getState();
    expect(state).not.toHaveProperty('armed');
    expect(state).not.toHaveProperty('mode');
    expect(state).not.toHaveProperty('setArmed');
    expect(state).not.toHaveProperty('setMode');
  });

  describe('setActiveNav', () => {
    it('updates activeNav', () => {
      useSystemStore.getState().setActiveNav('panic');
      expect(useSystemStore.getState().activeNav).toBe('panic');
    });

    it('accepts arbitrary nav id strings', () => {
      const ids = ['security', 'panic', 'incidents', 'map', 'media', 'users'];
      ids.forEach((id) => {
        useSystemStore.getState().setActiveNav(id);
        expect(useSystemStore.getState().activeNav).toBe(id);
      });
    });
  });

  describe('setSidebarCollapsed', () => {
    it('toggles sidebar state', () => {
      useSystemStore.getState().setSidebarCollapsed(true);
      expect(useSystemStore.getState().sidebarCollapsed).toBe(true);

      useSystemStore.getState().setSidebarCollapsed(false);
      expect(useSystemStore.getState().sidebarCollapsed).toBe(false);
    });
  });
});
