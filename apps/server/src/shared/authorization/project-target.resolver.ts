import type { Principal, Target } from '@planix/core/features/organization-access/principal.ts';
import type { RaciRole } from '@planix/core/features/organization-access/roles.ts';
import type { Tx } from '../db/client.ts';

export const PROJECT_TARGET_RESOLVER = Symbol('ProjectTargetResolver');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Loads the caller's relation to a project inside the tenant transaction (no cache — SC-004).
 * Returns undefined when the project does not exist in the active organization (FR-003).
 */
export class ProjectTargetResolver {
  async resolve(tx: Tx, principal: Principal, projectId: string): Promise<Target | undefined> {
    if (!UUID.test(projectId)) return undefined;
    const { rows } = await tx.client.query<{ project_member_id: string | null; raci_roles: RaciRole[] }>(
      `SELECT pm.id AS project_member_id,
              coalesce(array_agg(r.raci_role) FILTER (WHERE r.raci_role IS NOT NULL), '{}') AS raci_roles
         FROM project p
         LEFT JOIN organization_membership m ON m.user_id = $2 AND m.status = 'active'
         LEFT JOIN project_member pm ON pm.project_id = p.id AND pm.membership_id = m.id AND pm.status = 'active'
         LEFT JOIN raci_assignment r ON r.project_member_id = pm.id
        WHERE p.id = $1
        GROUP BY p.id, pm.id`,
      [projectId, principal.userId],
    );
    const row = rows[0];
    if (row === undefined) return undefined;
    return {
      kind: 'project',
      projectId,
      projectMembership: row.project_member_id === null ? 'none' : 'active',
      raciRoles: new Set(row.raci_roles),
    };
  }
}
