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

export const INVITATION_REPOSITORY = Symbol('InvitationRepository');
