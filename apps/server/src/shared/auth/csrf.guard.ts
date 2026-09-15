import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../app-tokens.ts';
import { DomainError } from '../errors/domain-error.ts';
import { tokenMatches } from './secure-token.ts';
import { CSRF_COOKIE, parseCookies } from './session-cookie.ts';
import type { AuthenticatedRequest } from './session.guard.ts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection (research R4). Runs after SessionGuard.
 * - Signed-in: X-CSRF-Token must match the token bound to the session.
 * - Anonymous: Origin must equal APP_BASE_URL and X-CSRF-Token must equal the CSRF cookie (double submit).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (SAFE_METHODS.has(req.method)) return true;

    const header = req.header('x-csrf-token') ?? '';
    if (header === '') throw new DomainError('CSRF_INVALID');

    if (req.auth !== undefined) {
      if (!tokenMatches(header, req.auth.csrfTokenHash)) throw new DomainError('CSRF_INVALID');
      return true;
    }

    const cookie = parseCookies(req.headers.cookie).get(CSRF_COOKIE);
    if (req.header('origin') !== this.config.appBaseUrl || cookie === undefined || cookie !== header) {
      throw new DomainError('CSRF_INVALID');
    }
    return true;
  }
}
