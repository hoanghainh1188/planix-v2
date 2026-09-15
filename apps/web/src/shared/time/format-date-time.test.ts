import { describe, expect, it } from 'vitest';
import { formatDateTime } from './format-date-time.ts';

describe('formatDateTime (FR-030, Q16)', () => {
  it('shows a UTC instant in the user time zone', () => {
    expect(formatDateTime('2026-09-14T16:30:00Z', { timeZone: 'Asia/Ho_Chi_Minh', locale: 'vi' })).toBe(
      '23:30 14/09/2026',
    );
  });

  it('crosses the date boundary correctly', () => {
    expect(formatDateTime('2026-09-14T18:00:00Z', { timeZone: 'Asia/Ho_Chi_Minh', locale: 'vi' })).toBe(
      '01:00 15/09/2026',
    );
    expect(formatDateTime('2026-09-14T18:00:00Z', { timeZone: 'UTC', locale: 'en' })).toBe('18:00 09/14/2026');
  });

  it('does not depend on the machine time zone', () => {
    const original = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      expect(formatDateTime('2026-09-14T16:30:00Z', { timeZone: 'Asia/Ho_Chi_Minh', locale: 'vi' })).toBe(
        '23:30 14/09/2026',
      );
    } finally {
      process.env.TZ = original;
    }
  });

  it('rejects timestamps that are not explicit UTC', () => {
    expect(() => formatDateTime('2026-09-14T16:30:00', { timeZone: 'Asia/Ho_Chi_Minh', locale: 'vi' })).toThrow();
  });
});
