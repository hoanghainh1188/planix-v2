import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { applyRateLimits, DEFAULT_RATE_LIMIT, type RateLimitOptions } from './shared/auth/rate-limit.middleware.ts';
import { DomainErrorFilter } from './shared/errors/domain-error.filter.ts';
import type { AppLogger } from './shared/logging/app-logger.ts';
import { requestLoggingMiddleware } from './shared/logging/redaction.ts';

/** Largest JSON or urlencoded body accepted on any route (decision 2026-09-15-005-payload-too-large). */
export const BODY_LIMIT = '100kb';

export interface ConfigureAppOptions {
  readonly rateLimit?: RateLimitOptions;
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
  // First, so every response — rate-limited and error ones included — carries the headers (T125).
  app.use(helmet());
  express.useBodyParser('json', { limit: BODY_LIMIT });
  express.useBodyParser('urlencoded', { limit: BODY_LIMIT, extended: false });
  app.use(requestLoggingMiddleware(logger));
  applyRateLimits(app, options.rateLimit ?? DEFAULT_RATE_LIMIT);
  app.useGlobalFilters(new DomainErrorFilter());
  return app;
}
