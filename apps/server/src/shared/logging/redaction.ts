import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import { stripSensitive } from '@planix/core/shared/sensitive-field/sensitive-field.ts';
import type { AppLogger } from './app-logger.ts';

export const REDACTED = '[REDACTED]';

const SECRET_KEYS = new Set([
  'password',
  'newPassword',
  'token',
  'tokenHash',
  'passwordHash',
  'idHash',
  'csrfTokenHash',
]);
const SECRET_HEADERS = new Set(['cookie', 'set-cookie', 'x-csrf-token', 'authorization']);
const TOKEN_PATHS = /^(\/api\/v1\/invitations\/)[^/]+/;

/** Path without query string and with invitation tokens masked. */
export function redactPath(url: string): string {
  const path = url.split('?')[0] ?? '';
  return path.replace(TOKEN_PATHS, `$1${REDACTED}`);
}

export function redactHeaders(headers: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name, SECRET_HEADERS.has(name.toLowerCase()) ? REDACTED : value]),
  );
}

/** Masks secret keys at any depth and, when a schema is given, every sensitive field. */
export function redactValue(value: unknown, schema?: z.ZodType): unknown {
  const masked = schema === undefined ? value : maskSensitive(schema, value);
  return maskSecrets(masked);
}

function maskSensitive(schema: z.ZodType, value: unknown): unknown {
  const visible = stripSensitive(schema, value, () => true, { undeclaredKeys: 'keep' });
  const hidden = stripSensitive(schema, value, () => false, { undeclaredKeys: 'keep' });
  return reinsertRedacted(visible, hidden);
}

function reinsertRedacted(full: unknown, stripped: unknown): unknown {
  if (Array.isArray(full) && Array.isArray(stripped)) {
    return full.map((item, i) => reinsertRedacted(item, stripped[i]));
  }
  if (isRecord(full) && isRecord(stripped)) {
    return Object.fromEntries(
      Object.entries(full).map(([key, nested]) => [
        key,
        key in stripped ? reinsertRedacted(nested, stripped[key]) : REDACTED,
      ]),
    );
  }
  return full;
}

function maskSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSecrets);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, SECRET_KEYS.has(key) ? REDACTED : maskSecrets(nested)]),
    );
  }
  return value;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Express middleware: one structured line per request — method, redacted path, status, duration. Never the body. */
export function requestLoggingMiddleware(logger: AppLogger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      logger.event('http_request', {
        method: req.method,
        path: redactPath(req.originalUrl),
        status: res.statusCode,
        durationMs: Number((process.hrtime.bigint() - started) / 1_000_000n),
      });
    });
    next();
  };
}
