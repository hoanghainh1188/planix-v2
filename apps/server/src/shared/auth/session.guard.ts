import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { Principal } from '@planix/core/features/organization-access/principal.ts';
import { tenantFromVerifiedSession } from '@planix/core/shared/tenant-context.ts';
import { DATABASE } from '../app-tokens.ts';
import type { Database, Tx } from '../db/client.ts';
import { openRequestTransaction, rollbackRequestTransaction } from '../db/request-transaction.ts';
import { DomainError } from '../errors/domain-error.ts';
import { PRINCIPAL_LOADER, type PrincipalLoader } from './principal.loader.ts';
import { ORGANIZATION_SCOPED, PUBLIC_ROUTE } from './route-scope.decorators.ts';
import { SESSION_COOKIE, parseCookies } from './session-cookie.ts';
import { SESSION_STORE, type SessionStore, type StoredSession } from './session-store.ts';

export interface AuthenticatedRequest extends Request {
  auth?: StoredSession;
  principal?: Principal;
  tx?: Tx;
}

/** Resolves the server-side session and, on organization routes, the verified principal (FR-007, SC-004). */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(DATABASE) private readonly db: Database,
    @Inject(SESSION_STORE) private readonly sessions: SessionStore,
    @Inject(PRINCIPAL_LOADER) private readonly principals: PrincipalLoader,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(PUBLIC_ROUTE, targets) === true;
    const organizationScoped =
      this.reflector.getAllAndOverride<boolean | undefined>(ORGANIZATION_SCOPED, targets) === true;

    const token = parseCookies(req.headers.cookie).get(SESSION_COOKIE);
    const session = token === undefined ? undefined : await this.sessions.resolve(token);
    if (session !== undefined) req.auth = session;
    if (session === undefined) {
      if (isPublic) return true;
      throw new DomainError('AUTH_REQUIRED');
    }
    if (!organizationScoped) return true;

    const organizationId = session.activeOrganizationId;
    if (organizationId === null) throw new DomainError('ACTIVE_ORGANIZATION_REQUIRED');

    const res = context.switchToHttp().getResponse<Response>();
    const tx = await openRequestTransaction(req, res, this.db, tenantFromVerifiedSession(organizationId));
    const principal = await this.principals.load(tx, session.userId, organizationId);
    if (principal === undefined || principal.membershipStatus !== 'active') {
      // Release the request's connection first: never hold two at once (security review: pool deadlock).
      await rollbackRequestTransaction(req);
      await this.sessions.setActiveOrganization(session.idHash, null);
      throw new DomainError('MEMBERSHIP_INACTIVE');
    }
    req.principal = principal;
    return true;
  }
}
