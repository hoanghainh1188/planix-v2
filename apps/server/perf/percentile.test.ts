import { describe, expect, it } from 'vitest';
import { percentile } from './percentile.ts';

describe('percentile (nearest-rank) for the load test (T123, SC-006)', () => {
  it('returns the smallest value with at least p% of samples at or below it', () => {
    const samples = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    expect(percentile(samples, 95)).toBe(95);
    expect(percentile(samples, 50)).toBe(50);
    expect(percentile(samples, 100)).toBe(100);
  });

  it('does not depend on the order of the samples', () => {
    expect(percentile([900, 10, 1200, 30, 20, 40, 50, 60, 70, 80], 95)).toBe(1200);
    expect(percentile([900, 10, 1200, 30, 20, 40, 50, 60, 70, 80], 90)).toBe(900);
  });

  it('rounds the rank up, so a small sample never under-reports the tail', () => {
    expect(percentile([5, 1, 3], 95)).toBe(5);
    expect(percentile([7], 95)).toBe(7);
  });

  it('refuses an empty sample and a percentile outside (0, 100]', () => {
    expect(() => percentile([], 95)).toThrow();
    expect(() => percentile([1], 0)).toThrow();
    expect(() => percentile([1], 101)).toThrow();
  });
});
