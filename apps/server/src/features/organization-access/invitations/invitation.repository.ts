import type { InvitationStatus, InvitationView } from '@planix/core/features/organization-access/schemas/members.ts';
import { hashToken } from '../../../shared/auth/secure-token.ts';
import type { Tx } from '../../../shared/db/client.ts';

export interface InvitationByToken {
  readonly id: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly email: string;
  readonly roles: readonly string[];
  readonly status: 'pending' | 'accepted' | 'revoked' | 'expired';
  readonly expiresAt: Date;
}

/** Invitation data access. Token lookup goes only through app_find_invitation_by_token_hash (R3 path 2). */
export class InvitationRepository {
  async findByToken(tx: Tx, token: string): Promise<InvitationByToken | undefined> {
    const { rows } = await tx.client.query<{
      id: string;
      organization_id: string;
      organization_name: string;
      email: string;
      roles: string[];
      status: InvitationByToken['status'];
      expires_at: Date;
    }>('SELECT * FROM app_find_invitation_by_token_hash($1)', [hashToken(token)]);
    const row = rows[0];
    return row === undefined
      ? undefined
      : {
          id: row.id,
          organizationId: row.organization_id,
          organizationName: row.organization_name,
          email: row.email,
          roles: row.roles,
          status: row.status,
          expiresAt: row.expires_at,
        };
  }

  /** Locks the invitation row inside the tenant transaction and returns its current state. */
  async lockForAcceptance(tx: Tx, invitationId: string): Promise<{ status: string; expiresAt: Date } | undefined> {
    const { rows } = await tx.client.query<{ status: string; expires_at: Date }>(
      'SELECT status, expires_at FROM organization_invitation WHERE id = $1 FOR UPDATE',
      [invitationId],
    );
    const row = rows[0];
    return row === undefined ? undefined : { status: row.status, expiresAt: row.expires_at };
  }

  async markAccepted(tx: Tx, invitationId: string, acceptedAt: Date): Promise<void> {
    await tx.client.query("UPDATE organization_invitation SET status = 'accepted', accepted_at = $2 WHERE id = $1", [
      invitationId,
      acceptedAt,
    ]);
  }
}

interface InvitationRow {
  id: string;
  email: string;
  roles: string[];
  status: InvitationStatus;
  expires_at: Date;
  invited_by_user_id: string;
  invited_by_kind: 'organizationAdmin' | 'platformOperator';
}

/** A pending invitation past its expiry is reported as `expired` (data-model §organization_invitation). */
const EFFECTIVE_STATUS = "CASE WHEN status = 'pending' AND expires_at <= $2 THEN 'expired' ELSE status END";
const VIEW_COLUMNS = `id, email, roles, ${EFFECTIVE_STATUS} AS status, expires_at, invited_by_user_id, invited_by_kind`;

function toView(row: InvitationRow): InvitationView {
  return {
    id: row.id,
    email: row.email,
    roles: row.roles,
    status: row.status,
    expiresAt: row.expires_at.toISOString(),
    invitedBy: { userId: row.invited_by_user_id, kind: row.invited_by_kind },
  };
}

/** Organization-side invitation management; every query runs in the request's tenant transaction (RLS). */
export class OrganizationInvitationRepository {
  async membershipStatusByEmail(
    tx: Tx,
    organizationId: string,
    email: string,
  ): Promise<'active' | 'deactivated' | undefined> {
    const { rows } = await tx.client.query<{ status: 'active' | 'deactivated' }>(
      `SELECT m.status FROM organization_membership m JOIN app_user u ON u.id = m.user_id
        WHERE m.organization_id = $1 AND u.email = $2`,
      [organizationId, email],
    );
    return rows[0]?.status;
  }

  async revokePendingForEmail(tx: Tx, organizationId: string, email: string): Promise<void> {
    await tx.client.query(
      "UPDATE organization_invitation SET status = 'revoked' WHERE organization_id = $1 AND email = $2 AND status = 'pending'",
      [organizationId, email],
    );
  }

  async create(
    tx: Tx,
    input: {
      organizationId: string;
      email: string;
      roles: readonly string[];
      token: string;
      expiresAt: Date;
      invitedByUserId: string;
      now: Date;
    },
  ): Promise<InvitationView> {
    const { rows } = await tx.client.query<InvitationRow>(
      `INSERT INTO organization_invitation
         (organization_id, email, roles, token_hash, expires_at, invited_by_user_id, invited_by_kind, created_at)
       VALUES ($1, $3, $4, $5, $6, $7, 'organizationAdmin', $2)
       RETURNING ${VIEW_COLUMNS}`,
      [
        input.organizationId,
        input.now,
        input.email,
        input.roles,
        hashToken(input.token),
        input.expiresAt,
        input.invitedByUserId,
      ],
    );
    return toView(rows[0]!);
  }

  async list(tx: Tx, organizationId: string, now: Date, status?: InvitationStatus): Promise<InvitationView[]> {
    const { rows } = await tx.client.query<InvitationRow>(
      `SELECT ${VIEW_COLUMNS} FROM organization_invitation
        WHERE organization_id = $1 AND ($3::text IS NULL OR ${EFFECTIVE_STATUS} = $3)
        ORDER BY created_at DESC, id`,
      [organizationId, now, status ?? null],
    );
    return rows.map(toView);
  }

  /** Locks one invitation of the organization and returns its effective status. */
  async lockForRevocation(
    tx: Tx,
    organizationId: string,
    invitationId: string,
    now: Date,
  ): Promise<InvitationView | undefined> {
    const { rows } = await tx.client.query<InvitationRow>(
      `SELECT ${VIEW_COLUMNS} FROM organization_invitation WHERE organization_id = $1 AND id = $3 FOR UPDATE`,
      [organizationId, now, invitationId],
    );
    return rows[0] === undefined ? undefined : toView(rows[0]);
  }

  async markRevoked(tx: Tx, invitationId: string): Promise<void> {
    await tx.client.query("UPDATE organization_invitation SET status = 'revoked' WHERE id = $1", [invitationId]);
  }
}

export const ORGANIZATION_INVITATION_REPOSITORY = Symbol('OrganizationInvitationRepository');

export const INVITATION_REPOSITORY = Symbol('InvitationRepository');
