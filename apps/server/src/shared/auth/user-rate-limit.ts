import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { MemoryStore, type Options } from 'express-rate-limit';
import { DomainError } from '../errors/domain-error.ts';
import type { RateLimitOptions } from './rate-limit.middleware.ts';
import type { AuthenticatedRequest } from './session.guard.ts';

export const INVITATION_RATE_LIMITER = Symbol('InvitationRateLimiter');

/**
 * Default: 50 invitations per user per hour — generous for onboarding a team, but stops an admin session from being
 * used as a spam relay (security review, decision tech-stack amendment 2026-09-15).
 */
export const DEFAULT_INVITATION_RATE_LIMIT: RateLimitOptions = { windowMs: 60 * 60_000, limit: 50 };

/** Fixed-window counter per signed-in user (express-rate-limit MemoryStore; not shared across instances). */
export class UserRateLimiter {
  readonly #store = new MemoryStore();

  constructor(private readonly options: RateLimitOptions) {
    this.#store.init({ windowMs: options.windowMs } as Options);
  }

  /** Counts one attempt; false when the user is over the limit for the current window. */
  async consume(userId: string): Promise<boolean> {
    const { totalHits } = await this.#store.increment(userId);
    return totalHits <= this.options.limit;
  }

  shutdown(): void {
    this.#store.shutdown();
  }
}

/** Route guard limiting how many invitations one user can send; runs after SessionGuard and AuthorizationGuard. */
@Injectable()
export class InvitationRateLimitGuard implements CanActivate {
  constructor(@Inject(INVITATION_RATE_LIMITER) private readonly limiter: UserRateLimiter) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const userId = context.switchToHttp().getRequest<AuthenticatedRequest>().auth?.userId;
    if (userId === undefined) throw new DomainError('AUTH_REQUIRED');
    if (!(await this.limiter.consume(userId))) throw new DomainError('RATE_LIMITED');
    return true;
  }
}
