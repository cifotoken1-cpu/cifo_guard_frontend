import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './auth.store';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null, role: null });
  });

  it('has null initial state', () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.role).toBeNull();
  });

  describe('login', () => {
    it('sets token, user, and role', () => {
      useAuthStore.getState().login({
        token: 'jwt-xyz',
        user: { id: 1, name: 'Guard A' },
        role: 'GUARD',
      });

      const state = useAuthStore.getState();
      expect(state.token).toBe('jwt-xyz');
      expect(state.user).toEqual({ id: 1, name: 'Guard A' });
      expect(state.role).toBe('GUARD');
    });
  });

  describe('logout', () => {
    it('clears all auth state', () => {
      useAuthStore.setState({
        token: 'jwt-xyz',
        user: { id: 1 },
        role: 'GUARD',
      });

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
      expect(state.role).toBeNull();
    });
  });

  describe('setUser', () => {
    it('updates user without touching token or role', () => {
      useAuthStore.setState({ token: 'keep', role: 'ADMIN', user: { id: 1 } });

      useAuthStore.getState().setUser({ id: 2, name: 'New' });

      const state = useAuthStore.getState();
      expect(state.user).toEqual({ id: 2, name: 'New' });
      expect(state.token).toBe('keep');
      expect(state.role).toBe('ADMIN');
    });
  });
});
