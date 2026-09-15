import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../test/postgres.ts';
import { RecordingMailSender } from '../../../test/recording-mail-sender.ts';
import { seedMembership, seedOrganization, seedUser } from '../../../test/seed.ts';
import { signedInMember, type SignedInMember } from '../../../test/signed-in-member.ts';
import { createTestApp } from '../../../test/test-app.ts';

const db = useTestDatabase();
let app: INestApplication;
let organizationId: string;
let pm: SignedInMember;
let projectId: string;
let pmProjectMemberId: string;
let memberMembershipId: string;
let memberEmail: string;

beforeAll(async () => {
  app = await createTestApp({ database: db, mailSender: new RecordingMailSender() });
});

afterAll(() => app.close());

beforeEach(async () => {
  organizationId = await seedOrganization(db, 'Acme');
  pm = await signedInMember(app, db, organizationId, ['projectManager']);
  const created = await pm.browser.post('/projects', { name: 'Website' });
  projectId = created.body.project.id;
  pmProjectMemberId = created.body.accountable.projectMemberId;
  memberEmail = `member-${randomUUID().slice(0, 8)}@acme.test`;
  memberMembershipId = await seedMembership(db, organizationId, await seedUser(db, memberEmail), ['member']);
});

const membersPath = () => `/projects/${projectId}/members`;

describe('project members (FR-013, FR-019, FR-020, Q9)', () => {
  it('adds an active organization member once; lists members with their RACI roles', async () => {
    const added = await pm.browser.post(membersPath(), { membershipId: memberMembershipId });
    expect(added.status).toBe(201);
    expect(added.body).toEqual({
      projectMemberId: expect.any(String),
      membershipId: memberMembershipId,
      email: memberEmail,
      raciRoles: [],
    });

    const again = await pm.browser.post(membersPath(), { membershipId: memberMembershipId });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_PROJECT_MEMBER');

    const list = await pm.browser.get(membersPath());
    expect(list.status).toBe(200);
    expect(list.body.items).toEqual(
      expect.arrayContaining([
        {
          projectMemberId: pmProjectMemberId,
          membershipId: pm.membershipId,
          email: pm.email,
          raciRoles: ['accountable'],
        },
        {
          projectMemberId: added.body.projectMemberId,
          membershipId: memberMembershipId,
          email: memberEmail,
          raciRoles: [],
        },
      ]),
    );
    expect(list.body.items).toHaveLength(2);
  });

  it('two simultaneous additions of the same person create one project member', async () => {
    const results = await Promise.all([
      pm.browser.post(membersPath(), { membershipId: memberMembershipId }),
      pm.browser.post(membersPath(), { membershipId: memberMembershipId }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const { rows } = await db.ownerPool.query(
      "SELECT 1 FROM project_member WHERE project_id = $1 AND membership_id = $2 AND status = 'active'",
      [projectId, memberMembershipId],
    );
    expect(rows).toHaveLength(1);
  });

  it('refuses memberships of another organization, deactivated or unknown ones with 404', async () => {
    const otherOrganization = await seedOrganization(db, 'Beta');
    const foreign = await seedMembership(db, otherOrganization, await seedUser(db));
    const deactivated = await seedMembership(db, organizationId, await seedUser(db));
    await db.ownerPool.query(
      "UPDATE organization_membership SET status = 'deactivated', deactivated_at = now() WHERE id = $1",
      [deactivated],
    );
    for (const membershipId of [foreign, deactivated, randomUUID()]) {
      const response = await pm.browser.post(membersPath(), { membershipId });
      expect(response.status, membershipId).toBe(404);
      expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
    }
    expect((await pm.browser.post(membersPath(), { membershipId: 'nope' })).status).toBe(400);
  });

  it('removes a member: status removed, RACI removed, history kept', async () => {
    const added = await pm.browser.post(membersPath(), { membershipId: memberMembershipId });
    const projectMemberId: string = added.body.projectMemberId;
    await db.ownerPool.query(
      "INSERT INTO raci_assignment (organization_id, project_id, project_member_id, raci_role) VALUES ($1, $2, $3, 'responsible')",
      [organizationId, projectId, projectMemberId],
    );

    expect((await pm.browser.delete(`${membersPath()}/${projectMemberId}`)).status).toBe(204);

    const row = await db.ownerPool.query<{ status: string; removed_at: Date | null }>(
      'SELECT status, removed_at FROM project_member WHERE id = $1',
      [projectMemberId],
    );
    expect(row.rows).toEqual([{ status: 'removed', removed_at: expect.any(Date) }]);
    expect(
      (await db.ownerPool.query('SELECT 1 FROM raci_assignment WHERE project_member_id = $1', [projectMemberId]))
        .rowCount,
    ).toBe(0);
    const list = await pm.browser.get(membersPath());
    expect(list.body.items.map((i: { projectMemberId: string }) => i.projectMemberId)).toEqual([pmProjectMemberId]);
    const audit = await db.ownerPool.query(
      "SELECT 1 FROM audit_entry WHERE action = 'project.member.remove' AND target_id = $1",
      [projectMemberId],
    );
    expect(audit.rowCount).toBe(1);

    expect((await pm.browser.delete(`${membersPath()}/${projectMemberId}`)).status).toBe(404);
    expect((await pm.browser.post(membersPath(), { membershipId: memberMembershipId })).status).toBe(201);
  });

  it('refuses to remove the Accountable (decision single-accountable-per-project)', async () => {
    const response = await pm.browser.delete(`${membersPath()}/${pmProjectMemberId}`);
    expect(response.status).toBe(409);
    expect(response.body.error).toEqual({ code: 'ACCOUNTABLE_REQUIRED', params: { projectIds: [projectId] } });
  });

  it('returns 404 for a project member of another project or an unknown id', async () => {
    const otherProject = (await pm.browser.post('/projects', { name: 'Other' })).body;
    expect((await pm.browser.delete(`${membersPath()}/${otherProject.accountable.projectMemberId}`)).status).toBe(404);
    expect((await pm.browser.delete(`${membersPath()}/${randomUUID()}`)).status).toBe(404);
    expect((await pm.browser.delete(`${membersPath()}/nope`)).status).toBe(404);
  });

  it('portfolio leads who are project members manage members; functional managers do not', async () => {
    const lead = await signedInMember(app, db, organizationId, ['portfolioLead']);
    const fm = await signedInMember(app, db, organizationId, ['functionalManager']);
    await pm.browser.post(membersPath(), { membershipId: lead.membershipId });
    await pm.browser.post(membersPath(), { membershipId: fm.membershipId });

    const byLead = await lead.browser.post(membersPath(), { membershipId: memberMembershipId });
    expect(byLead.status).toBe(201);
    expect((await lead.browser.delete(`${membersPath()}/${byLead.body.projectMemberId}`)).status).toBe(204);

    const byFm = await fm.browser.post(membersPath(), { membershipId: memberMembershipId });
    expect(byFm.status).toBe(403);
    expect(byFm.body.error.code).toBe('FORBIDDEN');
    expect((await fm.browser.get(membersPath())).status).toBe(200);
  });
});
