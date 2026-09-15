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
let admin: SignedInMember;

const activeAdminCount = async () => {
  const { rows } = await db.ownerPool.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM organization_membership m JOIN membership_role r ON r.membership_id = m.id
      WHERE m.organization_id = $1 AND m.status = 'active' AND r.role = 'admin'`,
    [organizationId],
  );
  return rows[0]!.count;
};

beforeAll(async () => {
  app = await createTestApp({ database: db, mailSender: new RecordingMailSender() });
});

afterAll(() => app.close());

beforeEach(async () => {
  organizationId = await seedOrganization(db, 'Acme');
  admin = await signedInMember(app, db, organizationId, ['admin']);
});

describe('organization members and system roles (FR-012, FR-014, Q4, Q5)', () => {
  it('lists members with their roles', async () => {
    const member = await signedInMember(app, db, organizationId, ['finance', 'projectManager']);
    const response = await member.browser.get('/org/members');
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual(
      expect.arrayContaining([
        {
          membershipId: admin.membershipId,
          userId: admin.userId,
          email: admin.email,
          status: 'active',
          roles: ['admin'],
        },
        {
          membershipId: member.membershipId,
          userId: member.userId,
          email: member.email,
          status: 'active',
          roles: ['projectManager', 'finance'],
        },
      ]),
    );
    expect(response.body.items).toHaveLength(2);
  });

  it('assigns several roles; permissions are their union and apply on the very next request (SC-004)', async () => {
    const member = await signedInMember(app, db, organizationId, ['member']);
    const invite = () => member.browser.post('/org/invitations', { email: `x-${randomUUID().slice(0, 8)}@acme.test` });
    expect((await invite()).status).toBe(403);

    const granted = await admin.browser.put(`/org/members/${member.membershipId}/roles`, {
      roles: ['finance', 'admin', 'projectManager'],
    });
    expect(granted.status).toBe(200);
    expect(granted.body).toMatchObject({
      membershipId: member.membershipId,
      roles: ['admin', 'projectManager', 'finance'],
    });
    expect((await invite()).status).toBe(201);

    expect((await admin.browser.put(`/org/members/${member.membershipId}/roles`, { roles: ['member'] })).status).toBe(
      200,
    );
    expect((await invite()).status).toBe(403);
  });

  it('records the roles before and after in the audit trail', async () => {
    const member = await signedInMember(app, db, organizationId, ['member']);
    await admin.browser.put(`/org/members/${member.membershipId}/roles`, { roles: ['finance', 'projectManager'] });
    const { rows } = await db.ownerPool.query<{ actor_user_id: string; before: unknown; after: unknown }>(
      "SELECT actor_user_id, before, after FROM audit_entry WHERE action = 'org.member.role.assign' AND target_id = $1",
      [member.membershipId],
    );
    expect(rows).toEqual([
      {
        actor_user_id: admin.userId,
        before: { roles: ['member'] },
        after: { roles: ['projectManager', 'finance'] },
      },
    ]);
  });

  it('refuses to remove admin from the last admin (Q5)', async () => {
    const response = await admin.browser.put(`/org/members/${admin.membershipId}/roles`, { roles: ['member'] });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('LAST_ADMIN_REQUIRED');
    expect(await activeAdminCount()).toBe(1);
  });

  it('two admins removing each other at the same time leaves exactly one admin', async () => {
    const second = await signedInMember(app, db, organizationId, ['admin']);
    const results = await Promise.all([
      admin.browser.put(`/org/members/${second.membershipId}/roles`, { roles: ['member'] }),
      second.browser.put(`/org/members/${admin.membershipId}/roles`, { roles: ['member'] }),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409]);
    expect(results.find((r) => r.status === 409)?.body.error.code).toBe('LAST_ADMIN_REQUIRED');
    expect(await activeAdminCount()).toBe(1);
  });

  it('validates roles and returns 404 for unknown members', async () => {
    const member = await signedInMember(app, db, organizationId, ['member']);
    expect((await admin.browser.put(`/org/members/${member.membershipId}/roles`, { roles: [] })).status).toBe(400);
    expect((await admin.browser.put(`/org/members/${member.membershipId}/roles`, { roles: ['owner'] })).status).toBe(
      400,
    );
    const unknown = await admin.browser.put(`/org/members/${randomUUID()}/roles`, { roles: ['member'] });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect((await admin.browser.put('/org/members/nope/roles', { roles: ['member'] })).status).toBe(404);
  });

  it('denies role assignment without org.member.role.assign', async () => {
    const lead = await signedInMember(app, db, organizationId, ['portfolioLead']);
    const response = await lead.browser.put(`/org/members/${lead.membershipId}/roles`, { roles: ['admin'] });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
