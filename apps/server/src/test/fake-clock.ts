import type { ClockPort } from '../shared/clock/clock.ts';

export class FakeClock implements ClockPort {
  #now: Date;

  constructor(start = '2026-09-15T00:00:00.000Z') {
    this.#now = new Date(start);
  }

  now(): Date {
    return new Date(this.#now);
  }

  advance(milliseconds: number): void {
    this.#now = new Date(this.#now.getTime() + milliseconds);
  }
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
