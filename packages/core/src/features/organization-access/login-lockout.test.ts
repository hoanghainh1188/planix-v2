import { describe, expect, it } from 'vitest';
import {
  LOCKOUT_DURATION_MS,
  MAX_FAILED_LOGINS,
  isLocked,
  recordFailedLogin,
  recordSuccessfulLogin,
} from './login-lockout.ts';

const NOW = new Date('2026-09-15T08:00:00.000Z');
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

describe('login lockout (FR-006, Q12)', () => {
  it('locks for 15 minutes on the 5th consecutive failure and resets the counter', () => {
    expect(MAX_FAILED_LOGINS).toBe(5);
    expect(LOCKOUT_DURATION_MS).toBe(15 * 60_000);
    let state = { failedLoginCount: 0, lockedUntil: null as Date | null };
    for (let i = 1; i <= 4; i++) {
      state = recordFailedLogin(state, NOW);
      expect(state).toEqual({ failedLoginCount: i, lockedUntil: null });
    }
    state = recordFailedLogin(state, NOW);
    expect(state).toEqual({ failedLoginCount: 0, lockedUntil: minutes(15) });
  });

  it('keeps the account locked until lockedUntil, even for a correct password', () => {
    const locked = { failedLoginCount: 0, lockedUntil: minutes(15) };
    expect(isLocked(locked, minutes(14))).toBe(true);
    expect(isLocked(locked, minutes(15))).toBe(false);
    expect(isLocked({ failedLoginCount: 3, lockedUntil: null }, NOW)).toBe(false);
  });

  it('resets the counter after a successful login', () => {
    expect(recordSuccessfulLogin()).toEqual({ failedLoginCount: 0, lockedUntil: null });
  });

  it('does not mutate the previous state', () => {
    const state = Object.freeze({ failedLoginCount: 2, lockedUntil: null });
    expect(recordFailedLogin(state, NOW)).toEqual({ failedLoginCount: 3, lockedUntil: null });
  });
});
