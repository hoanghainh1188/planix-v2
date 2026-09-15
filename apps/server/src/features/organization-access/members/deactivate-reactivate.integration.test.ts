import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Browser } from '../../../test/browser.ts';
import { useTestDatabase } from '../../../test/postgres.ts';
import { RecordingMailSender } from '../../../test/recording-mail-sender.ts';
import { seedMembership, seedOrganization, seedProject, seedProjectMember } from '../../../test/seed.ts';
import { MEMBER_PASSWORD, signedInMember, type SignedInMember } from '../../../test/signed-in-member.ts';
import { createTestApp } from '../../../test/test-app.ts';

const db = useTestDatabase();
let app: INestApplication;
let organizationId: string;
let admin: SignedInMember;
let projectId: string;

beforeAll(async () => {
  app = await createTestApp({ database: db, mailSender: new RecordingMailSender() });
});

afterAll(() => app.close());

beforeEach(async () => {
  organizationId = await seedOrganization(db, 'Acme');
  admin = await signedInMember(app, db, organizationId, ['admin']);
  projectId = await seedProject(db, organizationId, admin.membershipId);
});

describe('deactivate and reactivate members (FR-015, FR-017, SC-004, Q10)', () => {
  it('deactivates a signed-in member: next request is refused, project membership and RACI are removed, history kept', async () => {
    const member = await signedInMember(app, db, organizationId, ['projectManager', 'finance']);
    const projectMemberId = await seedProjectMember(db, organizationId, projectId, member.membershipId, [
      'responsible',
      'consulted',
    ]);
    expect((await member.browser.get('/org/members')).status).toBe(200);

    const response = await admin.browser.post(`/org/members/${member.membershipId}/deactivate`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ membershipId: member.membershipId, status: 'deactivated', roles: [] });

    const next = await member.browser.get('/org/members');
    expect(next.status).toBe(403);
    expect(next.body.error.code).toBe('MEMBERSHIP_INACTIVE');

    const projectMember = await db.ownerPool.query<{ status: string; removed_at: Date | null }>(
      'SELECT status, removed_at FROM project_member WHERE id = $1',
      [projectMemberId],
    );
    expect(projectMember.rows).toEqual([{ status: 'removed', removed_at: expect.any(Date) }]);
    const raci = await db.ownerPool.query('SELECT 1 FROM raci_assignment WHERE project_member_id = $1', [
      projectMemberId,
    ]);
    expect(raci.rowCount).toBe(0);
    const audit = await db.ownerPool.query<{ before: unknown }>(
      "SELECT before FROM audit_entry WHERE action = 'org.member.deactivate' AND target_id = $1",
      [member.membershipId],
    );
    expect(audit.rows).toEqual([{ before: { status: 'active', roles: ['projectManager', 'finance'] } }]);

    const deactivatedList = await admin.browser.get('/org/members?status=deactivated');
    expect(deactivatedList.body.items.map((i: { membershipId: string }) => i.membershipId)).toEqual([
      member.membershipId,
    ]);
  });

  it('refuses to deactivate the Accountable of a project and changes nothing', async () => {
    const member = await signedInMember(app, db, organizationId, ['projectManager']);
    await seedProjectMember(db, organizationId, projectId, member.membershipId, ['accountable']);
    const response = await admin.browser.post(`/org/members/${member.membershipId}/deactivate`);
    expect(response.status).toBe(409);
    expect(response.body.error).toEqual({ code: 'ACCOUNTABLE_REQUIRED', params: { projectIds: [projectId] } });
    expect((await member.browser.get('/org/members')).status).toBe(200);
  });

  it('refuses to deactivate the last admin (Q5)', async () => {
    const response = await admin.browser.post(`/org/members/${admin.membershipId}/deactivate`);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('LAST_ADMIN_REQUIRED');
  });

  it('reactivates with only the member role and no project membership', async () => {
    const member = await signedInMember(app, db, organizationId, ['projectManager']);
    await seedProjectMember(db, organizationId, projectId, member.membershipId, ['informed']);
    await admin.browser.post(`/org/members/${member.membershipId}/deactivate`);

    const response = await admin.browser.post(`/org/members/${member.membershipId}/reactivate`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ membershipId: member.membershipId, status: 'active', roles: ['member'] });

    const again = new Browser(app);
    expect((await again.login(member.email, MEMBER_PASSWORD)).body.activeOrganizationId).toBe(organizationId);
    expect((await again.get('/org/members')).status).toBe(200);
    const active = await db.ownerPool.query(
      "SELECT 1 FROM project_member WHERE membership_id = $1 AND status = 'active'",
      [member.membershipId],
    );
    expect(active.rowCount).toBe(0);

    const notDeactivated = await admin.browser.post(`/org/members/${member.membershipId}/reactivate`);
    expect(notDeactivated.status).toBe(409);
    expect(notDeactivated.body.error.code).toBe('MEMBERSHIP_NOT_DEACTIVATED');
  });

  it('deactivation in one organization does not affect the same person in another', async () => {
    const member = await signedInMember(app, db, organizationId, ['member']);
    const betaId = await seedOrganization(db, 'Beta');
    await seedMembership(db, betaId, member.userId, ['member']);
    expect((await admin.browser.post(`/org/members/${member.membershipId}/deactivate`)).status).toBe(200);

    expect((await member.browser.put('/auth/session/active-organization', { organizationId: betaId })).status).toBe(
      200,
    );
    expect((await member.browser.get('/org/members')).status).toBe(200);
  });

  it('returns 404 for unknown or other-organization memberships and 403 without permission', async () => {
    expect((await admin.browser.post(`/org/members/${randomUUID()}/deactivate`)).status).toBe(404);
    const other = await signedInMember(app, db, await seedOrganization(db, 'Beta'), ['admin']);
    expect((await admin.browser.post(`/org/members/${other.membershipId}/reactivate`)).status).toBe(404);

    const member = await signedInMember(app, db, organizationId, ['portfolioLead']);
    const denied = await member.browser.post(`/org/members/${admin.membershipId}/deactivate`);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
  });
});
