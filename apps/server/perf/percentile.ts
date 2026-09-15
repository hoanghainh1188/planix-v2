/**
 * Nearest-rank percentile: the smallest sample with at least `p`% of all samples at or below it. autocannon reports
 * p90 and p97.5 but not p95, which SC-006 is stated in, so the load test computes it from every response time.
 */
export function percentile(samples: readonly number[], p: number): number {
  if (samples.length === 0) throw new Error('percentile of an empty sample');
  if (!(p > 0 && p <= 100)) throw new Error(`percentile must be in (0, 100], got ${p}`);
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[rank - 1]!;
}
