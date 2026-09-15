import { extname, join, sep } from 'node:path';
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

/** Hashed build output (Vite `assets/`) never changes under the same name; everything else must be revalidated. */
const IMMUTABLE_ASSET = 'public, max-age=31536000, immutable';

/**
 * Serves the built web app on the API's origin (decision 2026-09-15-018-demo-deploy): session cookies are
 * SameSite=Lax and public routes check Origin, so web and API must share one origin. Client-side routes (GET, no file
 * extension, outside /api) get index.html; missing files and every /api path fall through to the API's JSON answers.
 */
function serveWebApp(express: NestExpressApplication, webDistDir: string): void {
  const indexHtml = join(webDistDir, 'index.html');
  express.useStaticAssets(webDistDir, {
    index: false,
    setHeaders: (res: Response, path: string) => {
      res.setHeader('Cache-Control', path.includes(`${sep}assets${sep}`) ? IMMUTABLE_ASSET : 'no-cache');
    },
  });
  express.use((req: Request, res: Response, next: NextFunction) => {
    const clientRoute =
      (req.method === 'GET' || req.method === 'HEAD') &&
      req.path !== '/api' &&
      !req.path.startsWith('/api/') &&
      extname(req.path) === '';
    if (!clientRoute) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });
}

export interface ConfigureAppOptions {
  readonly rateLimit?: RateLimitOptions;
  /**
   * Number of proxies in front of the server. The hosting proxy appends the client address to X-Forwarded-For without
   * removing what the client sent, so only a hop count is safe; `true` would let any client pick its own IP (#14).
   */
  readonly trustProxyHops?: number;
  /** Directory of the built web app to serve on the same origin; unset = API only (development runs Vite). */
  readonly webDistDir?: string;
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
  if (options.webDistDir !== undefined) serveWebApp(express, options.webDistDir);
  express.useBodyParser('json', { limit: BODY_LIMIT_BYTES });
  express.useBodyParser('urlencoded', { limit: BODY_LIMIT_BYTES, extended: false });
  app.use(requestLoggingMiddleware(logger));
  applyRateLimits(app, options.rateLimit ?? DEFAULT_RATE_LIMIT);
  app.useGlobalFilters(new DomainErrorFilter());
  return app;
}
