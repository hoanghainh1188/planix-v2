import { RACI_ROLES, type RaciRole } from '@planix/core/features/organization-access/roles.ts';
import type {
  AccountableView,
  ProjectMemberView,
  ProjectView,
} from '@planix/core/features/organization-access/schemas/projects.ts';
import type { Tx } from '../../../shared/db/client.ts';

export const PROJECTS_REPOSITORY = Symbol('ProjectsRepository');

const UNIQUE_VIOLATION = '23505';

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  created_at: Date;
}

const toProject = (row: ProjectRow): ProjectView => ({
  id: row.id,
  name: row.name,
  description: row.description,
  status: row.status,
  createdAt: row.created_at.toISOString(),
});

const orderedRaci = (roles: readonly RaciRole[]): RaciRole[] => RACI_ROLES.filter((role) => roles.includes(role));

/** Projects, project members and their RACI roles; every query runs in the request's tenant transaction (RLS). */
export class ProjectsRepository {
  async activeMembershipId(tx: Tx, organizationId: string, userId: string): Promise<string | undefined> {
    const { rows } = await tx.client.query<{ id: string }>(
      "SELECT id FROM organization_membership WHERE organization_id = $1 AND user_id = $2 AND status = 'active'",
      [organizationId, userId],
    );
    return rows[0]?.id;
  }

  /**
   * Locks the membership FOR SHARE until the transaction ends: a concurrent deactivation (which locks it FOR UPDATE)
   * either finishes first — the row is re-checked and no longer active — or waits and then removes the new project
   * member (code review: add vs deactivate race).
   */
  async isActiveMembership(tx: Tx, organizationId: string, membershipId: string): Promise<boolean> {
    const { rowCount } = await tx.client.query(
      "SELECT 1 FROM organization_membership WHERE organization_id = $1 AND id = $2 AND status = 'active' FOR SHARE",
      [organizationId, membershipId],
    );
    return rowCount === 1;
  }

  /** Project + creator as project member + creator as Accountable, in the caller's transaction (FR-018). */
  async create(
    tx: Tx,
    input: { organizationId: string; name: string; description: string | null; membershipId: string; now: Date },
  ): Promise<{ project: ProjectView; projectMemberId: string }> {
    const project = await tx.client.query<ProjectRow>(
      `INSERT INTO project (organization_id, name, description, created_by_membership_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING id, name, description, status, created_at`,
      [input.organizationId, input.name, input.description, input.membershipId, input.now],
    );
    const projectId = project.rows[0]!.id;
    const projectMemberId = await this.addMember(tx, input.organizationId, projectId, input.membershipId, input.now);
    await tx.client.query(
      `INSERT INTO raci_assignment (organization_id, project_id, project_member_id, raci_role, assigned_at)
       VALUES ($1, $2, $3, 'accountable', $4)`,
      [input.organizationId, projectId, projectMemberId, input.now],
    );
    return { project: toProject(project.rows[0]!), projectMemberId };
  }

  async find(tx: Tx, organizationId: string, projectId: string): Promise<ProjectView | undefined> {
    const { rows } = await tx.client.query<ProjectRow>(
      'SELECT id, name, description, status, created_at FROM project WHERE organization_id = $1 AND id = $2',
      [organizationId, projectId],
    );
    return rows[0] === undefined ? undefined : toProject(rows[0]);
  }

  /** Projects in which the user is an active project member — no exception for any role (FR-016). */
  async listForUser(tx: Tx, organizationId: string, userId: string): Promise<ProjectView[]> {
    const { rows } = await tx.client.query<ProjectRow>(
      `SELECT p.id, p.name, p.description, p.status, p.created_at
         FROM project p
         JOIN project_member pm ON pm.project_id = p.id AND pm.status = 'active'
         JOIN organization_membership m ON m.id = pm.membership_id AND m.status = 'active' AND m.user_id = $2
        WHERE p.organization_id = $1
        ORDER BY p.created_at DESC, p.id`,
      [organizationId, userId],
    );
    return rows.map(toProject);
  }

  async accountable(tx: Tx, projectId: string): Promise<AccountableView | undefined> {
    const { rows } = await tx.client.query<{
      project_member_id: string;
      membership_id: string;
      user_id: string;
      email: string;
    }>(
      `SELECT pm.id AS project_member_id, m.id AS membership_id, m.user_id, u.email
         FROM raci_assignment r
         JOIN project_member pm ON pm.id = r.project_member_id
         JOIN organization_membership m ON m.id = pm.membership_id
         JOIN app_user u ON u.id = m.user_id
        WHERE r.project_id = $1 AND r.raci_role = 'accountable'`,
      [projectId],
    );
    const row = rows[0];
    return row === undefined
      ? undefined
      : {
          projectMemberId: row.project_member_id,
          membershipId: row.membership_id,
          userId: row.user_id,
          email: row.email,
        };
  }

  async members(tx: Tx, projectId: string): Promise<ProjectMemberView[]> {
    const { rows } = await tx.client.query<{
      project_member_id: string;
      membership_id: string;
      email: string;
      raci_roles: RaciRole[];
    }>(
      `SELECT pm.id AS project_member_id, pm.membership_id, u.email,
              coalesce(array_agg(r.raci_role) FILTER (WHERE r.raci_role IS NOT NULL), '{}') AS raci_roles
         FROM project_member pm
         JOIN organization_membership m ON m.id = pm.membership_id
         JOIN app_user u ON u.id = m.user_id
         LEFT JOIN raci_assignment r ON r.project_member_id = pm.id
        WHERE pm.project_id = $1 AND pm.status = 'active'
        GROUP BY pm.id, u.email
        ORDER BY u.email`,
      [projectId],
    );
    return rows.map((row) => ({
      projectMemberId: row.project_member_id,
      membershipId: row.membership_id,
      email: row.email,
      raciRoles: orderedRaci(row.raci_roles),
    }));
  }

  /**
   * Inserts an active project member. The partial unique index (project_id, membership_id) WHERE status = 'active'
   * decides concurrent additions: the losing insert raises a unique violation (see isUniqueViolation).
   */
  async addMember(tx: Tx, organizationId: string, projectId: string, membershipId: string, now: Date): Promise<string> {
    const { rows } = await tx.client.query<{ id: string }>(
      `INSERT INTO project_member (organization_id, project_id, membership_id, added_at)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [organizationId, projectId, membershipId, now],
    );
    return rows[0]!.id;
  }

  /** Locks an active project member of the project and returns its RACI roles. */
  async lockActiveMember(
    tx: Tx,
    projectId: string,
    projectMemberId: string,
  ): Promise<{ membershipId: string; raciRoles: RaciRole[] } | undefined> {
    const locked = await tx.client.query<{ membership_id: string }>(
      "SELECT membership_id FROM project_member WHERE id = $1 AND project_id = $2 AND status = 'active' FOR UPDATE",
      [projectMemberId, projectId],
    );
    if (locked.rows[0] === undefined) return undefined;
    const { rows } = await tx.client.query<{ raci_role: RaciRole }>(
      'SELECT raci_role FROM raci_assignment WHERE project_member_id = $1',
      [projectMemberId],
    );
    return { membershipId: locked.rows[0].membership_id, raciRoles: orderedRaci(rows.map((r) => r.raci_role)) };
  }

  /** Replaces responsible/consulted/informed; the accountable assignment is never touched here. */
  async replaceAssignableRaciRoles(
    tx: Tx,
    input: {
      organizationId: string;
      projectId: string;
      projectMemberId: string;
      raciRoles: readonly RaciRole[];
      now: Date;
    },
  ): Promise<void> {
    const assignable = input.raciRoles.filter((role) => role !== 'accountable');
    await tx.client.query(
      `DELETE FROM raci_assignment
        WHERE project_member_id = $1 AND raci_role <> 'accountable' AND NOT (raci_role = ANY($2::text[]))`,
      [input.projectMemberId, assignable],
    );
    await tx.client.query(
      `INSERT INTO raci_assignment (organization_id, project_id, project_member_id, raci_role, assigned_at)
       SELECT $1, $2, $3, role, $5 FROM unnest($4::text[]) AS role
       ON CONFLICT (project_member_id, raci_role) DO NOTHING`,
      [input.organizationId, input.projectId, input.projectMemberId, assignable, input.now],
    );
  }

  /** Moves the single accountable assignment; the partial unique index backs the invariant. */
  async moveAccountable(
    tx: Tx,
    input: {
      organizationId: string;
      projectId: string;
      fromProjectMemberId: string;
      toProjectMemberId: string;
      now: Date;
    },
  ): Promise<void> {
    await tx.client.query(
      "DELETE FROM raci_assignment WHERE project_id = $1 AND project_member_id = $2 AND raci_role = 'accountable'",
      [input.projectId, input.fromProjectMemberId],
    );
    await tx.client.query(
      `INSERT INTO raci_assignment (organization_id, project_id, project_member_id, raci_role, assigned_at)
       VALUES ($1, $2, $3, 'accountable', $4)`,
      [input.organizationId, input.projectId, input.toProjectMemberId, input.now],
    );
  }

  async removeMember(tx: Tx, projectMemberId: string, now: Date): Promise<void> {
    await tx.client.query('DELETE FROM raci_assignment WHERE project_member_id = $1', [projectMemberId]);
    await tx.client.query("UPDATE project_member SET status = 'removed', removed_at = $2 WHERE id = $1", [
      projectMemberId,
      now,
    ]);
  }
}

/**
 * Lock order for changing the Accountable (never reversed elsewhere, so no deadlock): project row → candidate's
 * organization membership → candidate's project member. Member removal locks only the project member (FOR UPDATE);
 * deactivation locks memberships (FOR UPDATE) before touching project members.
 */
export class AccountableLocks {
  static async lockProject(tx: Tx, projectId: string): Promise<void> {
    await tx.client.query('SELECT id FROM project WHERE id = $1 FOR UPDATE', [projectId]);
  }

  /** Locks the candidate (membership FOR SHARE, then project member FOR SHARE); false if not an active member. */
  static async lockActiveCandidate(tx: Tx, projectId: string, projectMemberId: string): Promise<boolean> {
    const found = await tx.client.query<{ membership_id: string }>(
      'SELECT membership_id FROM project_member WHERE id = $1 AND project_id = $2',
      [projectMemberId, projectId],
    );
    const membershipId = found.rows[0]?.membership_id;
    if (membershipId === undefined) return false;
    const membership = await tx.client.query(
      "SELECT 1 FROM organization_membership WHERE id = $1 AND status = 'active' FOR SHARE",
      [membershipId],
    );
    if (membership.rowCount !== 1) return false;
    const member = await tx.client.query(
      "SELECT 1 FROM project_member WHERE id = $1 AND project_id = $2 AND status = 'active' FOR SHARE",
      [projectMemberId, projectId],
    );
    return member.rowCount === 1;
  }
}

export const isUniqueViolation = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === UNIQUE_VIOLATION;
