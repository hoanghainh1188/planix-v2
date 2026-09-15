import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { applyRateLimits, DEFAULT_RATE_LIMIT, type RateLimitOptions } from './shared/auth/rate-limit.middleware.ts';
import { DomainErrorFilter } from './shared/errors/domain-error.filter.ts';
import type { AppLogger } from './shared/logging/app-logger.ts';
import { requestLoggingMiddleware } from './shared/logging/redaction.ts';

/** Largest request body accepted on any route, whatever its content type (decision 2026-09-15-005-payload-too-large). */
export const BODY_LIMIT_BYTES = 100 * 1024;

/**
 * Refuses a declared body over the limit before any guard or handler runs. The JSON and urlencoded parsers enforce the
 * limit on bodies they read; other content types are never parsed, so this is their only size check (security review).
 */
function declaredBodyLimit(req: Request, _res: Response, next: NextFunction): void {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > BODY_LIMIT_BYTES) {
    next(Object.assign(new Error('request entity too large'), { type: 'entity.too.large', status: 413 }));
    return;
  }
  next();
}

export interface ConfigureAppOptions {
  readonly rateLimit?: RateLimitOptions;
  /**
   * Number of proxies in front of the server. The hosting proxy appends the client address to X-Forwarded-For without
   * removing what the client sent, so only a hop count is safe; `true` would let any client pick its own IP (#14).
   */
  readonly trustProxyHops?: number;
}

/** Cross-cutting HTTP setup shared by main.ts and integration tests. */
export function configureApp(
  app: INestApplication,
  logger: AppLogger,
  options: ConfigureAppOptions = {},
): INestApplication {
  app.setGlobalPrefix('api/v1');
  const express = app as NestExpressApplication;
  // helmet() also removes x-powered-by; disabling it here too keeps the header gone if helmet is ever reconfigured.
  express.disable('x-powered-by');
  if (options.trustProxyHops !== undefined) express.set('trust proxy', options.trustProxyHops);
  // First, so every response — rate-limited and error ones included — carries the headers (T125).
  app.use(helmet());
  app.use(declaredBodyLimit);
  express.useBodyParser('json', { limit: BODY_LIMIT_BYTES });
  express.useBodyParser('urlencoded', { limit: BODY_LIMIT_BYTES, extended: false });
  app.use(requestLoggingMiddleware(logger));
  applyRateLimits(app, options.rateLimit ?? DEFAULT_RATE_LIMIT);
  app.useGlobalFilters(new DomainErrorFilter());
  return app;
}
