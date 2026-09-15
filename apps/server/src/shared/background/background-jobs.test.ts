import { describe, expect, it } from 'vitest';
import { BackgroundJobs } from './background-jobs.ts';

describe('background jobs started after a response (security review: unbounded pending emails)', () => {
  it('drains finished and running jobs', async () => {
    const jobs = new BackgroundJobs(() => undefined);
    let done = false;
    jobs.run('email', async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      done = true;
    });
    await jobs.drain(1_000);
    expect(done).toBe(true);
    expect(jobs.pending).toBe(0);
  });

  it('stops waiting after the drain limit when a job hangs', async () => {
    const jobs = new BackgroundJobs(() => undefined);
    jobs.run('email', () => new Promise<void>(() => undefined));
    const started = Date.now();
    await jobs.drain(100);
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(jobs.pending).toBe(1);
  });

  it('reports a failure by label and error name only', async () => {
    const reported: string[] = [];
    const jobs = new BackgroundJobs((message) => reported.push(message));
    jobs.run('invitation email', () => Promise.reject(new TypeError('secret https://app/invitations/abc')));
    await jobs.drain(1_000);
    expect(reported).toEqual(['invitation email failed (TypeError)']);
  });
});
