import { normalizeRoles } from '@planix/core/features/organization-access/membership-invariants.ts';
import type { SystemRole } from '@planix/core/features/organization-access/roles.ts';
import type { MembershipStatus, MemberView } from '@planix/core/features/organization-access/schemas/members.ts';
import type { Tx } from '../../../shared/db/client.ts';

export const MEMBERS_REPOSITORY = Symbol('MembersRepository');

const MEMBER_SELECT = `
  SELECT m.id AS membership_id, m.user_id, u.email, m.status,
         coalesce(array_agg(r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles
    FROM organization_membership m
    JOIN app_user u ON u.id = m.user_id
    LEFT JOIN membership_role r ON r.membership_id = m.id`;

interface MemberRow {
  membership_id: string;
  user_id: string;
  email: string;
  status: MembershipStatus;
  roles: SystemRole[];
}

const toView = (row: MemberRow): MemberView => ({
  membershipId: row.membership_id,
  userId: row.user_id,
  email: row.email,
  status: row.status,
  roles: normalizeRoles(row.roles),
});

/** Organization membership data access; every query runs in the request's tenant transaction (RLS). */
export class MembersRepository {
  async list(tx: Tx, organizationId: string, status?: MembershipStatus): Promise<MemberView[]> {
    const { rows } = await tx.client.query<MemberRow>(
      `${MEMBER_SELECT}
        WHERE m.organization_id = $1 AND ($2::text IS NULL OR m.status = $2)
        GROUP BY m.id, u.email
        ORDER BY u.email`,
      [organizationId, status ?? null],
    );
    return rows.map(toView);
  }

  async find(tx: Tx, organizationId: string, membershipId: string): Promise<MemberView | undefined> {
    const { rows } = await tx.client.query<MemberRow>(
      `${MEMBER_SELECT} WHERE m.organization_id = $1 AND m.id = $2 GROUP BY m.id, u.email`,
      [organizationId, membershipId],
    );
    return rows[0] === undefined ? undefined : toView(rows[0]);
  }

  /**
   * Locks the active admin memberships and the target membership (in id order, so concurrent callers cannot
   * deadlock), then re-reads the admins with a fresh statement: a concurrent change committed while waiting for
   * the lock is visible (FR-014, data-model §membership_role).
   */
  async lockAdmins(tx: Tx, organizationId: string, membershipId: string): Promise<ReadonlySet<string>> {
    await tx.client.query(
      `SELECT m.id FROM organization_membership m
        WHERE m.organization_id = $1
          AND (m.id = $2 OR (m.status = 'active' AND EXISTS (
                SELECT 1 FROM membership_role r WHERE r.membership_id = m.id AND r.role = 'admin')))
        ORDER BY m.id
        FOR UPDATE`,
      [organizationId, membershipId],
    );
    const { rows } = await tx.client.query<{ id: string }>(
      `SELECT m.id FROM organization_membership m JOIN membership_role r ON r.membership_id = m.id
        WHERE m.organization_id = $1 AND m.status = 'active' AND r.role = 'admin'`,
      [organizationId],
    );
    return new Set(rows.map((r) => r.id));
  }

  async replaceRoles(
    tx: Tx,
    organizationId: string,
    membershipId: string,
    roles: readonly SystemRole[],
    now: Date,
  ): Promise<void> {
    await tx.client.query('DELETE FROM membership_role WHERE membership_id = $1 AND NOT (role = ANY($2::text[]))', [
      membershipId,
      roles,
    ]);
    await tx.client.query(
      `INSERT INTO membership_role (organization_id, membership_id, role, granted_at)
       SELECT $1, $2, role, $4 FROM unnest($3::text[]) AS role
       ON CONFLICT (membership_id, role) DO NOTHING`,
      [organizationId, membershipId, roles, now],
    );
  }

  async accountableProjectIds(tx: Tx, membershipId: string): Promise<string[]> {
    const { rows } = await tx.client.query<{ project_id: string }>(
      `SELECT DISTINCT r.project_id FROM raci_assignment r
         JOIN project_member pm ON pm.id = r.project_member_id
        WHERE pm.membership_id = $1 AND pm.status = 'active' AND r.raci_role = 'accountable'`,
      [membershipId],
    );
    return rows.map((r) => r.project_id);
  }

  /** Removes roles, project memberships (kept as `removed`) and RACI, then marks the membership deactivated. */
  async deactivate(tx: Tx, membershipId: string, now: Date): Promise<void> {
    await tx.client.query(
      `DELETE FROM raci_assignment WHERE project_member_id IN (
         SELECT id FROM project_member WHERE membership_id = $1 AND status = 'active')`,
      [membershipId],
    );
    await tx.client.query(
      "UPDATE project_member SET status = 'removed', removed_at = $2 WHERE membership_id = $1 AND status = 'active'",
      [membershipId, now],
    );
    await tx.client.query('DELETE FROM membership_role WHERE membership_id = $1', [membershipId]);
    await tx.client.query(
      "UPDATE organization_membership SET status = 'deactivated', deactivated_at = $2, updated_at = $2 WHERE id = $1",
      [membershipId, now],
    );
  }

  async reactivate(
    tx: Tx,
    organizationId: string,
    membershipId: string,
    roles: readonly SystemRole[],
    now: Date,
  ): Promise<void> {
    await tx.client.query(
      "UPDATE organization_membership SET status = 'active', deactivated_at = NULL, updated_at = $2 WHERE id = $1",
      [membershipId, now],
    );
    await this.replaceRoles(tx, organizationId, membershipId, roles, now);
  }
}
