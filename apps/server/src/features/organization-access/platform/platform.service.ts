import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, DATABASE, type AppConfig } from '../../../shared/app-tokens.ts';
import { AUDIT_WRITER, type AuditWriter } from '../../../shared/audit/audit-writer.ts';
import { generateToken, hashToken } from '../../../shared/auth/secure-token.ts';
import { CLOCK, type ClockPort } from '../../../shared/clock/clock.ts';
import {
  withAnonymousTransaction,
  withPlatformTransaction,
  type Tx,
  type Database,
} from '../../../shared/db/client.ts';
import { DomainError } from '../../../shared/errors/domain-error.ts';
import { MAIL_SENDER, type MailSender } from '../../../shared/mail/mail-sender.ts';

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface OrganizationView {
  readonly id: string;
  readonly name: string;
  readonly status: 'active' | 'suspended';
  readonly createdAt: string;
}

export interface AdminInvitationView {
  readonly id: string;
  readonly email: string;
  readonly roles: readonly string[];
  readonly status: string;
  readonly expiresAt: string;
  readonly invitedBy: { readonly userId: string; readonly kind: 'platformOperator' };
}

/** Organization lifecycle for platform operators, through planix_platform only (FR-004, R11). */
@Injectable()
export class PlatformService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter,
  ) {}

  async createOrganization(operatorId: string, name: string, firstAdminEmail: string) {
    const token = generateToken();
    const result = await withPlatformTransaction(this.db, async (tx) => {
      const { rows } = await tx.client.query<{
        id: string;
        name: string;
        status: 'active' | 'suspended';
        created_at: Date;
      }>(
        'INSERT INTO organization (name, created_by_operator_id) VALUES ($1, $2) RETURNING id, name, status, created_at',
        [name, operatorId],
      );
      const row = rows[0]!;
      const organization: OrganizationView = {
        id: row.id,
        name: row.name,
        status: row.status,
        createdAt: row.created_at.toISOString(),
      };
      const invitation = await this.#insertAdminInvitation(tx, organization.id, firstAdminEmail, operatorId, token);
      await this.audit.record(tx, {
        organizationId: organization.id,
        actorUserId: operatorId,
        actorKind: 'platformOperator',
        action: 'platform.organization.create',
        targetType: 'organization',
        targetId: organization.id,
        outcome: 'succeeded',
        after: { name, firstAdminEmail },
      });
      return { organization, invitation };
    });
    await this.#sendInvitation(operatorId, firstAdminEmail, name, token);
    return result;
  }

  async listOrganizations() {
    const { rows } = await withPlatformTransaction(this.db, (tx) =>
      tx.client.query<{ id: string; name: string; status: string; created_at: Date; active_admin_count: number }>(
        `SELECT id, name, status, created_at, app_count_active_admins(id) AS active_admin_count
           FROM organization ORDER BY created_at DESC`,
      ),
    );
    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        createdAt: r.created_at.toISOString(),
        activeAdminCount: r.active_admin_count,
      })),
    };
  }

  async resendAdminInvitation(operatorId: string, organizationId: string, email: string) {
    if (!UUID.test(organizationId)) throw new DomainError('RESOURCE_NOT_FOUND');
    const token = generateToken();
    const { invitation, organizationName } = await withPlatformTransaction(this.db, async (tx) => {
      const { rows } = await tx.client.query<{ name: string }>('SELECT name FROM organization WHERE id = $1', [
        organizationId,
      ]);
      if (rows[0] === undefined) throw new DomainError('RESOURCE_NOT_FOUND');
      await tx.client.query(
        `UPDATE organization_invitation SET status = 'revoked'
          WHERE organization_id = $1 AND email = $2 AND status = 'pending'
            AND invited_by_kind = 'platformOperator' AND roles = '{admin}'`,
        [organizationId, email],
      );
      const created = await this.#insertAdminInvitation(tx, organizationId, email, operatorId, token);
      await this.audit.record(tx, {
        organizationId,
        actorUserId: operatorId,
        actorKind: 'platformOperator',
        action: 'platform.invitation.admin.resend',
        targetType: 'organizationInvitation',
        targetId: created.id,
        outcome: 'succeeded',
        after: { email },
      });
      return { invitation: created, organizationName: rows[0].name };
    });
    await this.#sendInvitation(operatorId, email, organizationName, token);
    return { invitation };
  }

  async #insertAdminInvitation(
    tx: Tx,
    organizationId: string,
    email: string,
    operatorId: string,
    token: string,
  ): Promise<AdminInvitationView> {
    const expiresAt = new Date(this.clock.now().getTime() + INVITATION_TTL_MS);
    const { rows } = await tx.client.query<{
      id: string;
      email: string;
      roles: string[];
      status: string;
      expires_at: Date;
    }>(
      `INSERT INTO organization_invitation (organization_id, email, roles, token_hash, expires_at, invited_by_user_id, invited_by_kind)
       VALUES ($1, $2, '{admin}', $3, $4, $5, 'platformOperator')
       RETURNING id, email, roles, status, expires_at`,
      [organizationId, email, hashToken(token), expiresAt, operatorId],
    );
    const row = rows[0]!;
    return {
      id: row.id,
      email: row.email,
      roles: row.roles,
      status: row.status,
      expiresAt: row.expires_at.toISOString(),
      invitedBy: { userId: operatorId, kind: 'platformOperator' },
    };
  }

  async #sendInvitation(operatorId: string, email: string, organizationName: string, token: string): Promise<void> {
    const { rows } = await withAnonymousTransaction(this.db, (tx) =>
      tx.client.query<{ locale: 'vi' | 'en' }>('SELECT locale FROM app_user WHERE id = $1', [operatorId]),
    );
    await this.mail.send(email, {
      kind: 'organizationInvitation',
      locale: rows[0]?.locale ?? 'vi',
      organizationName,
      acceptUrl: `${this.config.appBaseUrl}/invitations/${token}`,
    });
  }
}
