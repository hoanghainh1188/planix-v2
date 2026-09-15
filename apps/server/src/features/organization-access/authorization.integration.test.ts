import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PERMISSION_MATRIX } from '@planix/core/features/organization-access/permission-matrix.ts';
import { SYSTEM_ROLES, type SystemRole } from '@planix/core/features/organization-access/roles.ts';
import { organizationRoutes, sendToRoute, type OrganizationRoute } from '../../test/organization-routes.ts';
import { useTestDatabase } from '../../test/postgres.ts';
import { RecordingMailSender } from '../../test/recording-mail-sender.ts';
import { seedOrganization, seedProject, seedProjectMember } from '../../test/seed.ts';
import { signedInMember, type SignedInMember } from '../../test/signed-in-member.ts';
import { createTestApp } from '../../test/test-app.ts';

const db = useTestDatabase();
let app: INestApplication;
let organizationId: string;
let projectId: string;
let projectRoutes: OrganizationRoute[];

beforeAll(async () => {
  app = await createTestApp({ database: db, mailSender: new RecordingMailSender() });
  organizationId = await seedOrganization(db, 'Acme');
  const owner = await signedInMember(app, db, organizationId, ['projectManager']);
  projectId = await seedProject(db, organizationId, owner.membershipId);
  await seedProjectMember(db, organizationId, projectId, owner.membershipId, ['accountable']);
  projectRoutes = organizationRoutes(app).filter((route) => PERMISSION_MATRIX[route.action].scope === 'project');
});

afterAll(() => app.close());

/** Params that pass authorization but point at nothing, so an allowed request has no side effect. */
const paramsFor = (route: OrganizationRoute) =>
  Object.fromEntries(
    [...route.path.matchAll(/:(\w+)/g)].map(([, name]) => [name!, name === 'projectId' ? projectId : randomUUID()]),
  );
const bodyFor = (route: OrganizationRoute) =>
  route.method === 'POST' || route.method === 'PUT' ? { membershipId: randomUUID() } : undefined;

async function caller(roles: readonly SystemRole[], projectMember: boolean): Promise<SignedInMember> {
  const member = await signedInMember(app, db, organizationId, roles);
  if (projectMember) await seedProjectMember(db, organizationId, projectId, member.membershipId);
  return member;
}

const deniedAudits = async (userId: string, action: string) => {
  const { rows } = await db.ownerPool.query<{ target_type: string; after: unknown }>(
    `SELECT target_type, after FROM audit_entry
      WHERE outcome = 'denied' AND actor_user_id = $1 AND action = $2 AND target_id = $3 AND organization_id = $4`,
    [userId, action, projectId, organizationId],
  );
  return rows;
};

describe('two-layer decision on every project route: role AND project membership (FR-022–024, SC-002, Q7)', () => {
  it('finds the project routes', () => {
    expect(projectRoutes.map((r) => r.key)).toEqual(
      expect.arrayContaining(['GET /projects/:projectId', 'POST /projects/:projectId/members']),
    );
  });

  it('allows only "permitted role × project member"; every other combination is 403 and audited as denied', async () => {
    for (const route of projectRoutes) {
      const allowedRoles: readonly SystemRole[] = PERMISSION_MATRIX[route.action].roles;
      const permitted = allowedRoles.find((role) => role !== 'admin') ?? allowedRoles[0]!;
      const notPermitted = SYSTEM_ROLES.find((role) => !allowedRoles.includes(role));

      const combinations: Array<{ label: string; roles: SystemRole[]; member: boolean; allowed: boolean }> = [
        { label: 'role × member', roles: [permitted], member: true, allowed: true },
        { label: 'role × not member', roles: [permitted], member: false, allowed: false },
      ];
      // Some actions are allowed for every system role; the "no role" rows do not exist for them.
      if (notPermitted !== undefined) {
        combinations.push(
          { label: 'no role × member', roles: [notPermitted], member: true, allowed: false },
          { label: 'no role × not member', roles: [notPermitted], member: false, allowed: false },
        );
      }

      for (const combination of combinations) {
        const member = await caller(combination.roles, combination.member);
        const response = await sendToRoute(member, route, paramsFor(route), bodyFor(route));
        const context = `${route.key} ${combination.label} (${combination.roles.join()})`;
        if (combination.allowed) {
          expect(response.status, context).not.toBe(403);
          expect(await deniedAudits(member.userId, route.action), context).toEqual([]);
        } else {
          expect({ status: response.status, code: response.body?.error?.code }, context).toEqual({
            status: 403,
            code: 'FORBIDDEN',
          });
          expect(await deniedAudits(member.userId, route.action), context).toHaveLength(1);
        }
      }
    }
  });

  it('an admin who is not a project member is refused, with a denied audit entry (FR-016, Q8)', async () => {
    const admin = await caller(['admin'], false);
    const response = await admin.browser.get(`/projects/${projectId}`);
    expect(response.status).toBe(403);
    expect(await deniedAudits(admin.userId, 'project.read')).toEqual([
      { target_type: 'project', after: { reason: 'NOT_PROJECT_MEMBER' } },
    ]);
  });

  it('records why a member without a permitted role was refused (Q7)', async () => {
    const member = await caller(['member'], true);
    const response = await member.browser.post(`/projects/${projectId}/members`, { membershipId: randomUUID() });
    expect(response.status).toBe(403);
    expect(await deniedAudits(member.userId, 'project.member.manage')).toEqual([
      { target_type: 'project', after: { reason: 'ROLE_NOT_PERMITTED' } },
    ]);
  });

  it('does not audit a project of another organization as a denial on this one (404, FR-003)', async () => {
    const outsider = await caller(['projectManager'], false);
    const response = await outsider.browser.get(`/projects/${randomUUID()}`);
    expect(response.status).toBe(404);
    const { rowCount } = await db.ownerPool.query(
      "SELECT 1 FROM audit_entry WHERE outcome = 'denied' AND actor_user_id = $1",
      [outsider.userId],
    );
    expect(rowCount).toBe(0);
  });
});
