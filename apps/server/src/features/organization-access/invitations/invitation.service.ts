import { Inject, Injectable } from '@nestjs/common';
import { checkPasswordPolicy } from '@planix/core/features/organization-access/password-policy/password-policy.ts';
import type { SessionPayload } from '@planix/core/features/organization-access/schemas/auth.ts';
import { tenantFromVerifiedSession } from '@planix/core/shared/tenant-context.ts';
import { DATABASE } from '../../../shared/app-tokens.ts';
import { AUDIT_WRITER, type AuditWriter } from '../../../shared/audit/audit-writer.ts';
import { PASSWORD_HASHER, type PasswordHasher } from '../../../shared/auth/password-hasher.ts';
import { SESSION_STORE, type SessionStore, type StoredSession } from '../../../shared/auth/session-store.ts';
import { CLOCK, type ClockPort } from '../../../shared/clock/clock.ts';
import { withAnonymousTransaction, withTenantTransaction, type Database, type Tx } from '../../../shared/db/client.ts';
import { DomainError } from '../../../shared/errors/domain-error.ts';
import { buildSessionPayload, loadUser } from '../session-payload.ts';
import { INVITATION_REPOSITORY, type InvitationByToken, type InvitationRepository } from './invitation.repository.ts';

const UNIQUE_VIOLATION = '23505';

export interface InvitationDescription {
  readonly organizationName: string;
  readonly email: string;
  readonly requiresAccountCreation: boolean;
}

export interface AcceptedInvitation {
  readonly payload: SessionPayload;
  /** Present only when a new session was created (new account). */
  readonly newSession?: { readonly sessionToken: string; readonly csrfToken: string };
}

/** Accepting organization invitations (FR-005, FR-010, FR-017). Accounts are created only here. */
@Injectable()
export class InvitationService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(SESSION_STORE) private readonly sessions: SessionStore,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter,
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
  ) {}

  async describe(token: string): Promise<InvitationDescription> {
    const invitation = await this.#validInvitation(token);
    return {
      organizationName: invitation.organizationName,
      email: invitation.email,
      requiresAccountCreation: (await this.#existingUserId(invitation.email)) === undefined,
    };
  }

  async accept(
    token: string,
    password: string | undefined,
    session: StoredSession | undefined,
  ): Promise<AcceptedInvitation> {
    const invitation = await this.#validInvitation(token);
    const existingUserId = await this.#existingUserId(invitation.email);

    let passwordHash: string | undefined;
    if (existingUserId === undefined) {
      const policy = checkPasswordPolicy(password ?? '');
      if (!policy.ok) throw new DomainError('PASSWORD_POLICY_VIOLATION', { rule: policy.rule });
      passwordHash = await this.hasher.hash(password ?? '');
    } else {
      if (session === undefined) throw new DomainError('AUTH_REQUIRED');
      if (session.userId !== existingUserId) throw new DomainError('INVITATION_EMAIL_MISMATCH');
    }

    const now = this.clock.now();
    const organizationId = invitation.organizationId;
    const userId = await withTenantTransaction(this.db, tenantFromVerifiedSession(organizationId), async (tx) => {
      const locked = await this.invitations.lockForAcceptance(tx, invitation.id);
      if (locked === undefined || locked.status !== 'pending' || locked.expiresAt.getTime() <= now.getTime()) {
        throw new DomainError('TOKEN_INVALID_OR_EXPIRED');
      }
      const id = existingUserId ?? (await this.#createAccount(tx, invitation.email, passwordHash!));

      const existing = await tx.client.query<{ status: string }>(
        'SELECT status FROM organization_membership WHERE user_id = $1 AND organization_id = $2',
        [id, organizationId],
      );
      if (existing.rows[0]?.status === 'active') throw new DomainError('ALREADY_MEMBER');
      if (existing.rows[0]?.status === 'deactivated') throw new DomainError('MEMBER_DEACTIVATED_USE_REACTIVATE');

      const membership = await tx.client.query<{ id: string }>(
        'INSERT INTO organization_membership (organization_id, user_id) VALUES ($1, $2) RETURNING id',
        [organizationId, id],
      );
      for (const role of invitation.roles) {
        await tx.client.query(
          'INSERT INTO membership_role (organization_id, membership_id, role) VALUES ($1, $2, $3)',
          [organizationId, membership.rows[0]!.id, role],
        );
      }
      await this.invitations.markAccepted(tx, invitation.id, now);
      await tx.client.query('UPDATE app_user SET last_active_organization_id = $2, updated_at = $3 WHERE id = $1', [
        id,
        organizationId,
        now,
      ]);
      await this.audit.record(tx, {
        organizationId,
        actorUserId: id,
        actorKind: 'user',
        action: 'org.invitation.accept',
        targetType: 'organizationInvitation',
        targetId: invitation.id,
        outcome: 'succeeded',
        after: { roles: invitation.roles },
      });
      return id;
    });

    let newSession: AcceptedInvitation['newSession'];
    if (session === undefined) newSession = await this.sessions.create(userId, organizationId);
    else await this.sessions.setActiveOrganization(session.idHash, organizationId);

    const user = await loadUser(this.db, userId);
    const payload = await buildSessionPayload(this.db, user!, organizationId);
    return newSession === undefined ? { payload } : { payload, newSession };
  }

  /**
   * Creates the account for a first-time invitee. If another invitation for the same email created it a moment
   * earlier (unique violation), the invitee must now sign in with that account to accept (FR-005).
   */
  async #createAccount(tx: Tx, email: string, passwordHash: string): Promise<string> {
    try {
      const { rows } = await tx.client.query<{ id: string }>(
        'INSERT INTO app_user (email, password_hash) VALUES ($1, $2) RETURNING id',
        [email, passwordHash],
      );
      return rows[0]!.id;
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) throw new DomainError('AUTH_REQUIRED');
      throw error;
    }
  }

  async #validInvitation(token: string): Promise<InvitationByToken> {
    const invitation = await withAnonymousTransaction(this.db, (tx) => this.invitations.findByToken(tx, token));
    if (
      invitation === undefined ||
      invitation.status !== 'pending' ||
      invitation.expiresAt.getTime() <= this.clock.now().getTime()
    ) {
      throw new DomainError('TOKEN_INVALID_OR_EXPIRED');
    }
    return invitation;
  }

  async #existingUserId(email: string): Promise<string | undefined> {
    const { rows } = await withAnonymousTransaction(this.db, (tx) =>
      tx.client.query<{ id: string }>('SELECT id FROM app_user WHERE email = $1', [email]),
    );
    return rows[0]?.id;
  }
}
