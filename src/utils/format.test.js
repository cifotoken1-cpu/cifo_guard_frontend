import { describe, it, expect } from 'vitest';
import { pad, formatDate, formatTime, formatUptime, relativeTime } from './format';

describe('pad', () => {
  it('pads single digit with leading zero', () => {
    expect(pad(5)).toBe('05');
    expect(pad(0)).toBe('00');
  });

  it('does not pad two-digit numbers', () => {
    expect(pad(15)).toBe('15');
    expect(pad(99)).toBe('99');
  });

  it('handles strings as input via String()', () => {
    expect(pad('7')).toBe('07');
  });
});

describe('formatDate', () => {
  it('formats Date as "Day, D Mon YYYY"', () => {
    // 2026-05-08 is a Friday
    const d = new Date(2026, 4, 8);
    expect(formatDate(d)).toBe('Friday, 8 May 2026');
  });

  it('uses 3-letter month abbreviation', () => {
    expect(formatDate(new Date(2026, 0, 1))).toMatch(/Jan/);
    expect(formatDate(new Date(2026, 11, 31))).toMatch(/Dec/);
  });
});

describe('formatTime', () => {
  it('formats Date as HH:MM:SS', () => {
    const d = new Date(2026, 4, 8, 9, 7, 5);
    expect(formatTime(d)).toBe('09:07:05');
  });

  it('handles midnight correctly', () => {
    const d = new Date(2026, 4, 8, 0, 0, 0);
    expect(formatTime(d)).toBe('00:00:00');
  });
});

describe('formatUptime', () => {
  it('returns 00:00:00 for zero or negative', () => {
    expect(formatUptime(0)).toBe('00:00:00');
    expect(formatUptime(-1000)).toBe('00:00:00');
    expect(formatUptime(null)).toBe('00:00:00');
    expect(formatUptime(undefined)).toBe('00:00:00');
  });

  it('formats milliseconds to HH:MM:SS', () => {
    expect(formatUptime(1000)).toBe('00:00:01');
    expect(formatUptime(60_000)).toBe('00:01:00');
    expect(formatUptime(3_600_000)).toBe('01:00:00');
    expect(formatUptime(3_661_000)).toBe('01:01:01');
  });

  it('handles uptimes longer than 24 hours', () => {
    // 25 hours = 90_000_000 ms
    expect(formatUptime(90_000_000)).toBe('25:00:00');
  });
});

describe('relativeTime', () => {
  it('returns empty string for falsy input', () => {
    expect(relativeTime(null)).toBe('');
    expect(relativeTime(undefined)).toBe('');
    expect(relativeTime('')).toBe('');
  });

  it('returns empty string for invalid date', () => {
    expect(relativeTime('not a date')).toBe('');
  });

  it('strips "about " prefix', () => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const result = relativeTime(oneHourAgo);
    expect(result).not.toMatch(/^about /);
  });

  it('replaces "less than a minute ago" with "just now"', () => {
    const justNow = Date.now() - 5 * 1000;
    const result = relativeTime(justNow);
    expect(result).toBe('just now');
  });

  it('accepts ISO string, Date, or epoch ms', () => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const fromMs = relativeTime(oneHourAgo);
    const fromDate = relativeTime(new Date(oneHourAgo));
    const fromIso = relativeTime(new Date(oneHourAgo).toISOString());

    // All three should produce same string
    expect(fromMs).toBe(fromDate);
    expect(fromDate).toBe(fromIso);
  });
});
