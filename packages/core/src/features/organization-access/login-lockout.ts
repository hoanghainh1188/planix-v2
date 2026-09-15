export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60_000;

export interface LoginLockoutState {
  readonly failedLoginCount: number;
  readonly lockedUntil: Date | null;
}

/** Account lockout after repeated failures (FR-006). Pure; returns new state objects. */
export function isLocked(state: LoginLockoutState, now: Date): boolean {
  return state.lockedUntil !== null && now.getTime() < state.lockedUntil.getTime();
}

export function recordFailedLogin(state: LoginLockoutState, now: Date): LoginLockoutState {
  const failedLoginCount = state.failedLoginCount + 1;
  if (failedLoginCount >= MAX_FAILED_LOGINS) {
    return { failedLoginCount: 0, lockedUntil: new Date(now.getTime() + LOCKOUT_DURATION_MS) };
  }
  return { failedLoginCount, lockedUntil: null };
}

export function recordSuccessfulLogin(): LoginLockoutState {
  return { failedLoginCount: 0, lockedUntil: null };
}
