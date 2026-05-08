import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup DOM between tests
afterEach(() => {
  cleanup();
});

// Reset zustand persist localStorage between tests
afterEach(() => {
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
});
