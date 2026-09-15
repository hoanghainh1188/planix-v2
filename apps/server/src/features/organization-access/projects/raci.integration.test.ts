import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../test/postgres.ts';
import { RecordingMailSender } from '../../../test/recording-mail-sender.ts';
import { seedOrganization } from '../../../test/seed.ts';
import { signedInMember, type SignedInMember } from '../../../test/signed-in-member.ts';
import { createTestApp } from '../../../test/test-app.ts';

const db = useTestDatabase();
let app: INestApplication;
let organizationId: string;
let pm: SignedInMember;
let projectId: string;
let pmProjectMemberId: string;
let u2: { projectMemberId: string; member: SignedInMember };
let u3: { projectMemberId: string; member: SignedInMember };

beforeAll(async () => {
  app = await createTestApp({ database: db, mailSender: new RecordingMailSender() });
});

afterAll(() => app.close());

async function addToProject(roles: string[]) {
  const member = await signedInMember(app, db, organizationId, roles);
  const added = await pm.browser.post(`/projects/${projectId}/members`, { membershipId: member.membershipId });
  return { projectMemberId: added.body.projectMemberId as string, member };
}

beforeEach(async () => {
  organizationId = await seedOrganization(db, 'Acme');
  pm = await signedInMember(app, db, organizationId, ['projectManager']);
  const created = await pm.browser.post('/projects', { name: 'Website' });
  projectId = created.body.project.id;
  pmProjectMemberId = created.body.accountable.projectMemberId;
  u2 = await addToProject(['member']);
  u3 = await addToProject(['member']);
});

const raciPath = (projectMemberId: string) => `/projects/${projectId}/members/${projectMemberId}/raci`;
const accountablePath = () => `/projects/${projectId}/accountable`;
const accountableRows = async () =>
  (
    await db.ownerPool.query<{ project_member_id: string }>(
      "SELECT project_member_id FROM raci_assignment WHERE project_id = $1 AND raci_role = 'accountable'",
      [projectId],
    )
  ).rows.map((r) => r.project_member_id);

describe('RACI roles (FR-020)', () => {
  it('replaces responsible/consulted/informed of a member; a member may hold several', async () => {
    const set = await pm.browser.put(raciPath(u2.projectMemberId), { raciRoles: ['consulted', 'responsible'] });
    expect(set.status).toBe(200);
    expect(set.body).toEqual({
      projectMemberId: u2.projectMemberId,
      membershipId: u2.member.membershipId,
      email: u2.member.email,
      raciRoles: ['responsible', 'consulted'],
    });
    expect((await pm.browser.put(raciPath(u2.projectMemberId), { raciRoles: ['informed'] })).body.raciRoles).toEqual([
      'informed',
    ]);
    expect((await pm.browser.put(raciPath(u2.projectMemberId), { raciRoles: [] })).body.raciRoles).toEqual([]);
    const audit = await db.ownerPool.query(
      "SELECT 1 FROM audit_entry WHERE action = 'project.raci.update' AND target_id = $1",
      [u2.projectMemberId],
    );
    expect(audit.rowCount).toBe(3);
  });

  it('keeps the Accountable when their R/C/I roles change', async () => {
    const response = await pm.browser.put(raciPath(pmProjectMemberId), { raciRoles: ['responsible'] });
    expect(response.status).toBe(200);
    expect(response.body.raciRoles).toEqual(['responsible', 'accountable']);
    expect(await accountableRows()).toEqual([pmProjectMemberId]);
  });

  it('refuses accountable or unknown roles in the body, and unknown project members', async () => {
    expect((await pm.browser.put(raciPath(u2.projectMemberId), { raciRoles: ['accountable'] })).status).toBe(400);
    expect((await pm.browser.put(raciPath(u2.projectMemberId), { raciRoles: ['owner'] })).status).toBe(400);
    expect((await pm.browser.put(raciPath(u2.projectMemberId), {})).status).toBe(400);
    const unknown = await pm.browser.put(raciPath(randomUUID()), { raciRoles: ['informed'] });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect((await pm.browser.put(raciPath('nope'), { raciRoles: ['informed'] })).status).toBe(404);
  });
});

describe('changing the Accountable (FR-020, Q9)', () => {
  it('replaces the Accountable in one step, with audit before/after', async () => {
    const response = await pm.browser.put(accountablePath(), { projectMemberId: u2.projectMemberId });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      previous: {
        projectMemberId: pmProjectMemberId,
        membershipId: pm.membershipId,
        userId: pm.userId,
        email: pm.email,
      },
      current: {
        projectMemberId: u2.projectMemberId,
        membershipId: u2.member.membershipId,
        userId: u2.member.userId,
        email: u2.member.email,
      },
    });
    expect(await accountableRows()).toEqual([u2.projectMemberId]);
    expect((await pm.browser.get(`/projects/${projectId}`)).body.accountable.projectMemberId).toBe(u2.projectMemberId);

    const audit = await db.ownerPool.query<{ before: unknown; after: unknown }>(
      "SELECT before, after FROM audit_entry WHERE action = 'project.accountable.change' AND target_id = $1",
      [projectId],
    );
    expect(audit.rows).toEqual([
      { before: { projectMemberId: pmProjectMemberId }, after: { projectMemberId: u2.projectMemberId } },
    ]);

    // Q9: the new Accountable cannot be removed; the former one now can.
    const removeNew = await pm.browser.delete(`/projects/${projectId}/members/${u2.projectMemberId}`);
    expect(removeNew.status).toBe(409);
    expect(removeNew.body.error.code).toBe('ACCOUNTABLE_REQUIRED');
  });

  it('answers with previous = current and changes nothing when the candidate already is the Accountable', async () => {
    const response = await pm.browser.put(accountablePath(), { projectMemberId: pmProjectMemberId });
    expect(response.status).toBe(200);
    expect(response.body.previous).toEqual(response.body.current);
    expect(await accountableRows()).toEqual([pmProjectMemberId]);
  });

  it('refuses a candidate who is not an active member of this project with 409 NOT_PROJECT_MEMBER', async () => {
    await pm.browser.delete(`/projects/${projectId}/members/${u3.projectMemberId}`);
    const otherProject = (await pm.browser.post('/projects', { name: 'Other' })).body;
    for (const projectMemberId of [u3.projectMemberId, otherProject.accountable.projectMemberId, randomUUID()]) {
      const response = await pm.browser.put(accountablePath(), { projectMemberId });
      expect(response.status, projectMemberId).toBe(409);
      expect(response.body.error.code).toBe('NOT_PROJECT_MEMBER');
    }
    expect((await pm.browser.put(accountablePath(), { projectMemberId: 'nope' })).status).toBe(400);
    expect(await accountableRows()).toEqual([pmProjectMemberId]);
  });

  it('two simultaneous changes leave exactly one Accountable', async () => {
    const results = await Promise.all([
      pm.browser.put(accountablePath(), { projectMemberId: u2.projectMemberId }),
      pm.browser.put(accountablePath(), { projectMemberId: u3.projectMemberId }),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    const rows = await accountableRows();
    expect(rows).toHaveLength(1);
    expect([u2.projectMemberId, u3.projectMemberId]).toContain(rows[0]);
  });

  it('is limited to project managers who are project members', async () => {
    const lead = await addToProject(['portfolioLead']);
    const response = await lead.member.browser.put(accountablePath(), { projectMemberId: u2.projectMemberId });
    expect(response.status).toBe(403);
    expect((await lead.member.browser.put(raciPath(u2.projectMemberId), { raciRoles: ['informed'] })).status).toBe(403);
  });
});
