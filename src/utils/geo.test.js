import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getGPS, FALLBACK_GPS } from './geo';

describe('FALLBACK_GPS', () => {
  it('has the shape backend expects', () => {
    expect(FALLBACK_GPS).toHaveProperty('latitude');
    expect(FALLBACK_GPS).toHaveProperty('longitude');
    expect(FALLBACK_GPS).toHaveProperty('accuracy');
  });

  it('has valid coordinate types', () => {
    expect(typeof FALLBACK_GPS.latitude).toBe('number');
    expect(typeof FALLBACK_GPS.longitude).toBe('number');
    expect(typeof FALLBACK_GPS.accuracy).toBe('number');
  });

  it('has coordinates within valid Earth ranges', () => {
    expect(FALLBACK_GPS.latitude).toBeGreaterThanOrEqual(-90);
    expect(FALLBACK_GPS.latitude).toBeLessThanOrEqual(90);
    expect(FALLBACK_GPS.longitude).toBeGreaterThanOrEqual(-180);
    expect(FALLBACK_GPS.longitude).toBeLessThanOrEqual(180);
  });

  it('has high uncertainty (accuracy field) signaling fallback nature', () => {
    expect(FALLBACK_GPS.accuracy).toBeGreaterThan(1000);
  });
});

describe('getGPS', () => {
  let originalGeolocation;

  beforeEach(() => {
    originalGeolocation = global.navigator?.geolocation;
  });

  afterEach(() => {
    if (originalGeolocation !== undefined) {
      Object.defineProperty(global.navigator, 'geolocation', {
        value: originalGeolocation,
        configurable: true,
      });
    }
  });

  it('rejects when geolocation API is not supported', async () => {
    // 'in' check requires the property to be ABSENT, not just undefined
    delete global.navigator.geolocation;

    await expect(getGPS()).rejects.toThrow(/not supported/i);
  });

  it('resolves with normalized coords when geolocation succeeds', async () => {
    const mockPos = {
      coords: { latitude: -6.2, longitude: 106.8, accuracy: 12.5 },
    };
    Object.defineProperty(global.navigator, 'geolocation', {
      value: {
        getCurrentPosition: (success) => success(mockPos),
      },
      configurable: true,
    });

    await expect(getGPS()).resolves.toEqual({
      latitude: -6.2,
      longitude: 106.8,
      accuracy: 12.5,
    });
  });

  it('rejects with error message when geolocation fails', async () => {
    Object.defineProperty(global.navigator, 'geolocation', {
      value: {
        getCurrentPosition: (_success, error) =>
          error({ message: 'Permission denied' }),
      },
      configurable: true,
    });

    await expect(getGPS()).rejects.toThrow('Permission denied');
  });
});
