/** Injectable time source so lockout, session expiry and token expiry are testable (constitution Principle IV). */
export interface ClockPort {
  now(): Date;
}

export const CLOCK = Symbol('ClockPort');

export const systemClock: ClockPort = {
  now: () => new Date(),
};
