/** Default upper bound for how long shutdown waits for background work (e.g. emails after a response). */
export const DEFAULT_DRAIN_LIMIT_MS = 30_000;

export type FailureReporter = (message: string) => void;

/**
 * Work started after a response has been sent (research R4 timing, email after commit). Failures are reported by
 * label and error name only — messages can carry one-time links. Shutdown waits for pending work, but never longer
 * than the drain limit, so a hung dependency cannot block a restart (security review).
 */
export class BackgroundJobs {
  readonly #pending = new Set<Promise<void>>();

  constructor(private readonly report: FailureReporter) {}

  get pending(): number {
    return this.#pending.size;
  }

  run(label: string, work: () => Promise<void>): void {
    const job: Promise<void> = work()
      .catch((error: unknown) => {
        this.report(`${label} failed (${error instanceof Error ? error.name : 'unknown'})`);
      })
      .finally(() => this.#pending.delete(job));
    this.#pending.add(job);
  }

  async drain(limitMs: number = DEFAULT_DRAIN_LIMIT_MS): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const limit = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, limitMs);
      timer.unref();
    });
    try {
      await Promise.race([Promise.all(this.#pending), limit]);
    } finally {
      clearTimeout(timer);
    }
  }
}
