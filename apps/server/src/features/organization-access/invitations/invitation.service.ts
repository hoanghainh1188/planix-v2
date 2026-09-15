import { Inject, Injectable, Logger, type BeforeApplicationShutdown } from '@nestjs/common';
import { checkPasswordPolicy } from '@planix/core/features/organization-access/password-policy/password-policy.ts';
import type { SessionPayload } from '@planix/core/features/organization-access/schemas/auth.ts';
import type { Principal } from '@planix/core/features/organization-access/principal.ts';
import type { SystemRole } from '@planix/core/features/organization-access/roles.ts';
import type { InvitationStatus, InvitationView } from '@planix/core/features/organization-access/schemas/members.ts';
import { tenantFromVerifiedSession } from '@planix/core/shared/tenant-context.ts';
import { normalizeRoles } from '@planix/core/features/organization-access/membership-invariants.ts';
import { APP_CONFIG, DATABASE, type AppConfig } from '../../../shared/app-tokens.ts';
import { AUDIT_WRITER, type AuditWriter } from '../../../shared/audit/audit-writer.ts';
import { PASSWORD_HASHER, type PasswordHasher } from '../../../shared/auth/password-hasher.ts';
import { generateToken } from '../../../shared/auth/secure-token.ts';
import { SESSION_STORE, type SessionStore, type StoredSession } from '../../../shared/auth/session-store.ts';
import { CLOCK, type ClockPort } from '../../../shared/clock/clock.ts';
import { withAnonymousTransaction, withTenantTransaction, type Database, type Tx } from '../../../shared/db/client.ts';
import { DomainError } from '../../../shared/errors/domain-error.ts';
import { MAIL_SENDER, type MailSender } from '../../../shared/mail/mail-sender.ts';
import { INVITATION_TTL_MS } from '../platform/platform.service.ts';
import { buildSessionPayload, loadUser } from '../session-payload.ts';
import {
  INVITATION_REPOSITORY,
  ORGANIZATION_INVITATION_REPOSITORY,
  type InvitationByToken,
  type InvitationRepository,
  type OrganizationInvitationRepository,
} from './invitation.repository.ts';

const UNIQUE_VIOLATION = '23505';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
export class InvitationService implements BeforeApplicationShutdown {
  readonly #logger = new Logger('InvitationService');
  readonly #pendingEmails = new Set<Promise<void>>();

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(SESSION_STORE) private readonly sessions: SessionStore,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter,
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    @Inject(ORGANIZATION_INVITATION_REPOSITORY)
    private readonly organizationInvitations: OrganizationInvitationRepository,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
  ) {}

  /**
   * Admin invites a person by email (FR-009) inside the request's tenant transaction. A pending invitation for the
   * same email is revoked first. The email (in the inviter's locale) is handed to `afterCommit`: it is sent only
   * once the invitation is committed, and the response does not wait for it (code review: email after commit).
   */
  async invite(
    tx: Tx,
    principal: Principal,
    email: string,
    roles: readonly SystemRole[] = ['member'],
    afterCommit: (work: () => void) => void,
  ): Promise<InvitationView> {
    const { organizationId } = principal;
    const status = await this.organizationInvitations.membershipStatusByEmail(tx, organizationId, email);
    if (status === 'active') throw new DomainError('ALREADY_MEMBER');
    if (status === 'deactivated') throw new DomainError('MEMBER_DEACTIVATED_USE_REACTIVATE');

    const now = this.clock.now();
    const token = generateToken();
    const normalized = normalizeRoles(roles);
    await this.organizationInvitations.revokePendingForEmail(tx, organizationId, email);
    const invitation = await this.organizationInvitations.create(tx, {
      organizationId,
      email,
      roles: normalized,
      token,
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
      invitedByUserId: principal.userId,
      now,
    });
    await this.audit.record(tx, {
      organizationId,
      actorUserId: principal.userId,
      actorKind: 'user',
      action: 'org.member.invite',
      targetType: 'organizationInvitation',
      targetId: invitation.id,
      outcome: 'succeeded',
      after: { email, roles: normalized },
    });

    const { rows } = await tx.client.query<{ organization_name: string; locale: 'vi' | 'en' }>(
      `SELECT o.name AS organization_name, u.locale
         FROM organization o CROSS JOIN app_user u WHERE o.id = $1 AND u.id = $2`,
      [organizationId, principal.userId],
    );
    const message = {
      kind: 'organizationInvitation',
      locale: rows[0]?.locale ?? 'vi',
      organizationName: rows[0]?.organization_name ?? '',
      acceptUrl: `${this.config.appBaseUrl}/invitations/${token}`,
    } as const;
    afterCommit(() => this.#sendInBackground(email, message));
    return invitation;
  }

  /** Lets invitation emails already scheduled after commit go out before the application stops. */
  async beforeApplicationShutdown(): Promise<void> {
    await Promise.all(this.#pendingEmails);
  }

  #sendInBackground(email: string, message: Parameters<MailSender['send']>[1]): void {
    const job: Promise<void> = this.mail
      .send(email, message)
      .catch((error: unknown) => {
        // Never log the error message: it may carry the invitation link.
        this.#logger.error(`invitation email failed (${error instanceof Error ? error.name : 'unknown'})`);
      })
      .finally(() => this.#pendingEmails.delete(job));
    this.#pendingEmails.add(job);
  }

  listForOrganization(tx: Tx, principal: Principal, status?: InvitationStatus): Promise<InvitationView[]> {
    return this.organizationInvitations.list(tx, principal.organizationId, this.clock.now(), status);
  }

  async revoke(tx: Tx, principal: Principal, invitationId: string): Promise<void> {
    if (!UUID.test(invitationId)) throw new DomainError('RESOURCE_NOT_FOUND');
    const invitation = await this.organizationInvitations.lockForRevocation(
      tx,
      principal.organizationId,
      invitationId,
      this.clock.now(),
    );
    if (invitation === undefined) throw new DomainError('RESOURCE_NOT_FOUND');
    if (invitation.status !== 'pending') throw new DomainError('INVITATION_NOT_PENDING');
    await this.organizationInvitations.markRevoked(tx, invitationId);
    await this.audit.record(tx, {
      organizationId: principal.organizationId,
      actorUserId: principal.userId,
      actorKind: 'user',
      action: 'org.invitation.revoke',
      targetType: 'organizationInvitation',
      targetId: invitationId,
      outcome: 'succeeded',
      before: { status: 'pending' },
      after: { status: 'revoked' },
    });
  }

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
