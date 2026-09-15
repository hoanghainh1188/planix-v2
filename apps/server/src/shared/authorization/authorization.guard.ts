import { Inject, Injectable, Logger, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { decide } from '@planix/core/features/organization-access/decide.ts';
import { PERMISSION_MATRIX } from '@planix/core/features/organization-access/permission-matrix.ts';
import type { DenyReason, Principal, Target } from '@planix/core/features/organization-access/principal.ts';
import { tenantFromVerifiedSession } from '@planix/core/shared/tenant-context.ts';
import { DATABASE } from '../app-tokens.ts';
import { AUDIT_WRITER, type AuditWriter } from '../audit/audit-writer.ts';
import type { AuthenticatedRequest } from '../auth/session.guard.ts';
import { withAnonymousTransaction, withTenantTransaction, type Database } from '../db/client.ts';
import { requestTransaction } from '../db/request-transaction.ts';
import { DomainError } from '../errors/domain-error.ts';
import { PLATFORM_ACTION } from './platform-action.decorator.ts';
import { PROJECT_TARGET_RESOLVER, type ProjectTargetResolver } from './project-target.resolver.ts';
import { REQUIRED_ACTION, type RequiredAction } from './require-action.decorator.ts';

/** Deny reason → API error (contracts/authorization.md §3). */
export function toHttpError(reason: DenyReason): DomainError {
  return new DomainError(reason === 'MEMBERSHIP_INACTIVE' ? 'MEMBERSHIP_INACTIVE' : 'FORBIDDEN');
}

/** Enforces the declared action of every route with core decide() (FR-022–FR-024). Runs after SessionGuard. */
@Injectable()
export class AuthorizationGuard implements CanActivate {
  readonly #logger = new Logger('AuthorizationGuard');

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(DATABASE) private readonly db: Database,
    @Inject(PROJECT_TARGET_RESOLVER) private readonly projects: ProjectTargetResolver,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const targets = [context.getHandler(), context.getClass()];

    const platformAction = this.reflector.getAllAndOverride<string | undefined>(PLATFORM_ACTION, targets);
    if (platformAction !== undefined) return this.#checkPlatformOperator(req);

    const required = this.reflector.getAllAndOverride<RequiredAction | undefined>(REQUIRED_ACTION, targets);
    if (required === undefined) return true;

    const principal = req.principal;
    if (principal === undefined) throw new DomainError('AUTH_REQUIRED');

    let target: Target = { kind: 'organization' };
    if (PERMISSION_MATRIX[required.action].scope === 'project') {
      const param: unknown = req.params[required.projectParam];
      const projectId = typeof param === 'string' ? param : '';
      const tx = requestTransaction(req);
      if (tx === undefined) throw new DomainError('AUTH_REQUIRED');
      const resolved = await this.projects.resolve(tx, principal, projectId);
      if (resolved === undefined) throw new DomainError('RESOURCE_NOT_FOUND');
      target = resolved;
    }

    const decision = decide(principal, required.action, target);
    if (!decision.allowed) {
      if (target.kind === 'project')
        await this.#auditDenial(principal, required.action, target.projectId, decision.reason);
      throw toHttpError(decision.reason);
    }
    return true;
  }

  /**
   * FR-027: a refusal on project data is audited. The request's transaction is rolled back on denial, so the entry is
   * written in its own tenant transaction. A failing audit write never turns the refusal into an allow or a 500.
   */
  async #auditDenial(principal: Principal, action: string, projectId: string, reason: DenyReason): Promise<void> {
    try {
      await withTenantTransaction(this.db, tenantFromVerifiedSession(principal.organizationId), (tx) =>
        this.audit.record(tx, {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          actorKind: 'user',
          action,
          targetType: 'project',
          targetId: projectId,
          outcome: 'denied',
          after: { reason },
        }),
      );
    } catch (error) {
      this.#logger.error(`denied-access audit failed (${error instanceof Error ? error.name : 'unknown'})`);
    }
  }

  async #checkPlatformOperator(req: AuthenticatedRequest): Promise<boolean> {
    const userId = req.auth?.userId;
    if (userId === undefined) throw new DomainError('AUTH_REQUIRED');
    const { rowCount } = await withAnonymousTransaction(this.db, (tx) =>
      tx.client.query('SELECT 1 FROM platform_operator_grant WHERE user_id = $1', [userId]),
    );
    if (!rowCount) throw new DomainError('FORBIDDEN');
    return true;
  }
}
