import type { TenantContext } from '@planix/core/shared/tenant-context.ts';
import type { Tx } from '../../../shared/db/client.ts';
import { DomainError } from '../../../shared/errors/domain-error.ts';

export const ACCOUNTABLE_QUERY = Symbol('AccountableQuery');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AccountableIdentity {
  readonly projectMemberId: string;
  readonly userId: string;
}

/**
 * Accountable lookup for other features, e.g. Change Control applying a Baseline (FR-021, OI-07,
 * contracts/authorization.md §4). Runs in the caller's transaction — never opens a connection of its own (decision
 * 2026-09-15-005-accountable-query-takes-transaction) — and filters by `tenant` in addition to RLS.
 */
export class AccountableQuery {
  async getAccountable(tx: Tx, tenant: TenantContext, projectId: string): Promise<AccountableIdentity> {
    if (!UUID.test(projectId)) throw new DomainError('RESOURCE_NOT_FOUND');
    const { rows } = await tx.client.query<{ project_member_id: string | null; user_id: string | null }>(
      `SELECT pm.id AS project_member_id, m.user_id
         FROM project p
         LEFT JOIN raci_assignment r ON r.project_id = p.id AND r.raci_role = 'accountable'
         LEFT JOIN project_member pm ON pm.id = r.project_member_id
         LEFT JOIN organization_membership m ON m.id = pm.membership_id
        WHERE p.id = $1 AND p.organization_id = $2`,
      [projectId, tenant.organizationId],
    );
    const row = rows[0];
    if (row === undefined) throw new DomainError('RESOURCE_NOT_FOUND');
    // Decision single-accountable-per-project: a project without Accountable is a broken invariant, not a state.
    if (row.project_member_id === null || row.user_id === null) {
      throw new Error(`Project ${projectId} has no Accountable`);
    }
    return { projectMemberId: row.project_member_id, userId: row.user_id };
  }

  async isAccountable(tx: Tx, tenant: TenantContext, projectId: string, userId: string): Promise<boolean> {
    return (await this.getAccountable(tx, tenant, projectId)).userId === userId;
  }
}
