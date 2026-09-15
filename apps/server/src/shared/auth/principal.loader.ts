import type { Principal } from '@planix/core/features/organization-access/principal.ts';
import type { SystemRole } from '@planix/core/features/organization-access/roles.ts';
import type { Tx } from '../db/client.ts';

export const PRINCIPAL_LOADER = Symbol('PrincipalLoader');

/** Loads the caller's membership in the active organization and the union of its roles in ONE query (R12). */
export class PrincipalLoader {
  async load(tx: Tx, userId: string, organizationId: string): Promise<Principal | undefined> {
    const { rows } = await tx.client.query<{ status: 'active' | 'deactivated'; roles: SystemRole[] }>(
      `SELECT m.status, coalesce(array_agg(r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles
         FROM organization_membership m
         LEFT JOIN membership_role r ON r.membership_id = m.id
        WHERE m.user_id = $1 AND m.organization_id = $2
        GROUP BY m.id, m.status`,
      [userId, organizationId],
    );
    const row = rows[0];
    if (row === undefined) return undefined;
    return { userId, organizationId, membershipStatus: row.status, roles: new Set(row.roles) };
  }
}
