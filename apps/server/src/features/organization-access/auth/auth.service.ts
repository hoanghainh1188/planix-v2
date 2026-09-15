import { Inject, Injectable } from '@nestjs/common';
import {
  isLocked,
  recordFailedLogin,
  recordSuccessfulLogin,
} from '@planix/core/features/organization-access/login-lockout.ts';
import {
  chooseActiveOrganization,
  type SessionPayload,
} from '@planix/core/features/organization-access/schemas/auth.ts';
import { tenantFromVerifiedSession } from '@planix/core/shared/tenant-context.ts';
import { DATABASE } from '../../../shared/app-tokens.ts';
import { AUDIT_WRITER, type AuditWriter } from '../../../shared/audit/audit-writer.ts';
import { PASSWORD_HASHER, type PasswordHasher } from '../../../shared/auth/password-hasher.ts';
import { SESSION_STORE, type SessionStore, type StoredSession } from '../../../shared/auth/session-store.ts';
import { CLOCK, type ClockPort } from '../../../shared/clock/clock.ts';
import { withAnonymousTransaction, withTenantTransaction, type Database } from '../../../shared/db/client.ts';
import { DomainError } from '../../../shared/errors/domain-error.ts';
import { buildSessionPayload, loadMemberships, loadUser } from '../session-payload.ts';

interface LoginRow {
  id: string;
  password_hash: string;
  failed_login_count: number;
  locked_until: Date | null;
  last_active_organization_id: string | null;
}

export interface SignedIn {
  readonly payload: SessionPayload;
  readonly sessionToken: string;
  readonly csrfToken: string;
}

/** Email + password sign-in with lockout, organization auto-selection and switching (FR-005–FR-008, FR-017). */
@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(SESSION_STORE) private readonly sessions: SessionStore,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter,
  ) {}

  async login(email: string, password: string): Promise<SignedIn> {
    const now = this.clock.now();
    const { rows } = await withAnonymousTransaction(this.db, (tx) =>
      tx.client.query<LoginRow>(
        'SELECT id, password_hash, failed_login_count, locked_until, last_active_organization_id FROM app_user WHERE email = $1',
        [email],
      ),
    );
    const user = rows[0];
    const state = user && { failedLoginCount: user.failed_login_count, lockedUntil: user.locked_until };

    if (user === undefined || state === undefined || isLocked(state, now)) {
      await this.hasher.verifyOrDummy(undefined, password);
      await this.#auditLogin(user?.id ?? null, 'denied');
      throw new DomainError('AUTH_INVALID_CREDENTIALS');
    }
    if (!(await this.hasher.verify(user.password_hash, password))) {
      const next = recordFailedLogin(state, now);
      await withAnonymousTransaction(this.db, async (tx) => {
        await tx.client.query('UPDATE app_user SET failed_login_count = $2, locked_until = $3 WHERE id = $1', [
          user.id,
          next.failedLoginCount,
          next.lockedUntil,
        ]);
        await this.audit.record(tx, this.#loginEntry(user.id, 'denied'));
      });
      throw new DomainError('AUTH_INVALID_CREDENTIALS');
    }

    const reset = recordSuccessfulLogin();
    await withAnonymousTransaction(this.db, async (tx) => {
      await tx.client.query('UPDATE app_user SET failed_login_count = $2, locked_until = $3 WHERE id = $1', [
        user.id,
        reset.failedLoginCount,
        reset.lockedUntil,
      ]);
      await this.audit.record(tx, this.#loginEntry(user.id, 'succeeded'));
    });

    const memberships = await loadMemberships(this.db, user.id);
    const activeOrganizationId = chooseActiveOrganization(memberships, user.last_active_organization_id);
    const { sessionToken, csrfToken } = await this.sessions.create(user.id, activeOrganizationId);
    return { payload: await this.session(user.id, activeOrganizationId), sessionToken, csrfToken };
  }

  async session(userId: string, activeOrganizationId: string | null): Promise<SessionPayload> {
    const user = await loadUser(this.db, userId);
    if (user === undefined) throw new DomainError('AUTH_REQUIRED');
    return buildSessionPayload(this.db, user, activeOrganizationId);
  }

  async logout(session: StoredSession): Promise<void> {
    await this.sessions.delete(session.idHash);
  }

  async switchOrganization(session: StoredSession, organizationId: string): Promise<SessionPayload> {
    const memberships = await loadMemberships(this.db, session.userId);
    if (!memberships.some((m) => m.organizationId === organizationId && m.status === 'active')) {
      throw new DomainError('RESOURCE_NOT_FOUND');
    }
    await this.sessions.setActiveOrganization(session.idHash, organizationId);
    await withTenantTransaction(this.db, tenantFromVerifiedSession(organizationId), async (tx) => {
      await tx.client.query('UPDATE app_user SET last_active_organization_id = $2, updated_at = now() WHERE id = $1', [
        session.userId,
        organizationId,
      ]);
      await this.audit.record(tx, {
        organizationId,
        actorUserId: session.userId,
        actorKind: 'user',
        action: 'auth.session.switch-organization',
        targetType: 'organization',
        targetId: organizationId,
        outcome: 'succeeded',
        before: { activeOrganizationId: session.activeOrganizationId },
        after: { activeOrganizationId: organizationId },
      });
    });
    return this.session(session.userId, organizationId);
  }

  async #auditLogin(userId: string | null, outcome: 'succeeded' | 'denied'): Promise<void> {
    await withAnonymousTransaction(this.db, (tx) => this.audit.record(tx, this.#loginEntry(userId, outcome)));
  }

  #loginEntry(userId: string | null, outcome: 'succeeded' | 'denied') {
    return {
      organizationId: null,
      actorUserId: outcome === 'succeeded' ? userId : null,
      actorKind: 'user' as const,
      action: 'auth.login',
      targetType: 'appUser',
      targetId: userId,
      outcome,
    };
  }
}
