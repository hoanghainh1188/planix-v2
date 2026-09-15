import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../test/postgres.ts';
import { RecordingMailSender } from '../../test/recording-mail-sender.ts';
import { seedOrganization } from '../../test/seed.ts';
import { signedInMember, type SignedInMember } from '../../test/signed-in-member.ts';
import { createTestApp } from '../../test/test-app.ts';

const ROUNDS = 5;
const db = useTestDatabase();
let app: INestApplication;
let organizationId: string;
let admin: SignedInMember;
let pm: SignedInMember;
let projectId: string;

beforeAll(async () => {
  app = await createTestApp({ database: db, mailSender: new RecordingMailSender() });
  organizationId = await seedOrganization(db, 'Acme');
  admin = await signedInMember(app, db, organizationId, ['admin']);
  pm = await signedInMember(app, db, organizationId, ['projectManager']);
  projectId = (await pm.browser.post('/projects', { name: 'Immediacy' })).body.project.id;
});

afterAll(() => app.close());

describe('permission changes apply to the very next request (SC-004)', () => {
  it('removing the role that allowed an action', async () => {
    const other = await signedInMember(app, db, organizationId, ['projectManager']);
    await pm.browser.post(`/projects/${projectId}/members`, { membershipId: other.membershipId });
    const target = await signedInMember(app, db, organizationId, ['member']);
    let allowedAfterRevocation = 0;
    for (let round = 0; round < ROUNDS; round++) {
      await admin.browser.put(`/org/members/${other.membershipId}/roles`, { roles: ['projectManager'] });
      const granted = await other.browser.post(`/projects/${projectId}/members`, { membershipId: target.membershipId });
      expect([201, 409]).toContain(granted.status);
      await admin.browser.put(`/org/members/${other.membershipId}/roles`, { roles: ['member'] });
      const next = await other.browser.post(`/projects/${projectId}/members`, { membershipId: target.membershipId });
      if (next.status !== 403) allowedAfterRevocation++;
    }
    expect(allowedAfterRevocation).toBe(0);
  });

  it('removing the person from the project', async () => {
    let allowedAfterRemoval = 0;
    for (let round = 0; round < ROUNDS; round++) {
      const colleague = await signedInMember(app, db, organizationId, ['member']);
      const added = await pm.browser.post(`/projects/${projectId}/members`, { membershipId: colleague.membershipId });
      expect((await colleague.browser.get(`/projects/${projectId}`)).status).toBe(200);
      await pm.browser.delete(`/projects/${projectId}/members/${added.body.projectMemberId}`);
      if ((await colleague.browser.get(`/projects/${projectId}`)).status !== 403) allowedAfterRemoval++;
    }
    expect(allowedAfterRemoval).toBe(0);
  });

  it('deactivating the membership', async () => {
    let allowedAfterDeactivation = 0;
    for (let round = 0; round < ROUNDS; round++) {
      const colleague = await signedInMember(app, db, organizationId, ['member']);
      await pm.browser.post(`/projects/${projectId}/members`, { membershipId: colleague.membershipId });
      expect((await colleague.browser.get(`/projects/${projectId}`)).status).toBe(200);
      await admin.browser.post(`/org/members/${colleague.membershipId}/deactivate`);
      const next = await colleague.browser.get(`/projects/${projectId}`);
      if (next.status !== 403 || next.body.error.code !== 'MEMBERSHIP_INACTIVE') allowedAfterDeactivation++;
    }
    expect(allowedAfterDeactivation).toBe(0);
  });
});
