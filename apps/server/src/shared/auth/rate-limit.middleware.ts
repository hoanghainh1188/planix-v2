import type { INestApplication } from '@nestjs/common';
import { rateLimit } from 'express-rate-limit';

export interface RateLimitOptions {
  readonly windowMs: number;
  readonly limit: number;
}

/** Default: 30 requests per IP per 15 minutes on credential endpoints (per-account lockout is separate, FR-006). */
export const DEFAULT_RATE_LIMIT: RateLimitOptions = { windowMs: 15 * 60_000, limit: 30 };

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * IP rate limits for state-changing requests under /auth/* and /invitations/* — login, password reset, accepting
 * an invitation (research R4; express-rate-limit replaces @nestjs/throttler). Reads are not counted: the web app
 * loads GET /auth/session on every page, and invitation tokens are 256-bit (decision tech-stack, amendment
 * 2026-09-15).
 */
export function applyRateLimits(app: INestApplication, options: RateLimitOptions = DEFAULT_RATE_LIMIT): void {
  for (const prefix of ['/api/v1/auth', '/api/v1/invitations']) {
    app.use(
      prefix,
      rateLimit({
        windowMs: options.windowMs,
        limit: options.limit,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        skip: (req) => READ_METHODS.has(req.method),
        handler: (_req, res) => {
          res.status(429).json({ error: { code: 'RATE_LIMITED', params: {} } });
        },
      }),
    );
  }
}
