import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Browser } from '../../../test/browser.ts';
import { useTestDatabase } from '../../../test/postgres.ts';
import { RecordingMailSender } from '../../../test/recording-mail-sender.ts';
import { seedMembership, seedOrganization, seedUser } from '../../../test/seed.ts';
import { signedInMember, type SignedInMember } from '../../../test/signed-in-member.ts';
import { createTestApp } from '../../../test/test-app.ts';

const db = useTestDatabase();
const mail = new RecordingMailSender();
let app: INestApplication;
let organizationId: string;
let admin: SignedInMember;

const newEmail = () => `invitee-${randomUUID().slice(0, 8)}@acme.test`;
const tokenOf = (email: string) => {
  const message = mail.lastTo(email);
  return message?.kind === 'organizationInvitation' ? message.acceptUrl.split('/invitations/')[1] : undefined;
};

beforeAll(async () => {
  app = await createTestApp({ database: db, mailSender: mail });
});

afterAll(() => app.close());

beforeEach(async () => {
  organizationId = await seedOrganization(db, 'Acme');
  admin = await signedInMember(app, db, organizationId, ['admin'], { locale: 'en' });
});

describe('organization invitations (FR-009, Q4)', () => {
  it('invites with the member role by default, emails in the inviter locale and never returns the token', async () => {
    const email = newEmail();
    const response = await admin.browser.post('/org/invitations', { email });
    expect(response.status).toBe(201);
    expect(response.body.invitation).toEqual({
      id: expect.any(String),
      email,
      roles: ['member'],
      status: 'pending',
      expiresAt: expect.any(String),
      invitedBy: { userId: admin.userId, kind: 'organizationAdmin' },
    });
    const message = mail.lastTo(email);
    expect(message).toMatchObject({ kind: 'organizationInvitation', locale: 'en', organizationName: 'Acme' });
    const token = tokenOf(email)!;
    expect(JSON.stringify(response.body)).not.toContain(token);

    const accepted = await (
      await new Browser(app).open()
    ).post(`/invitations/${token}/accept`, {
      password: 'granite-harbor-77',
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body.memberships).toEqual([
      { organizationId, organizationName: 'Acme', status: 'active', roles: ['member'] },
    ]);
  });

  it('re-inviting the same email revokes the earlier pending invitation', async () => {
    const email = newEmail();
    const first = await admin.browser.post('/org/invitations', { email, roles: ['member'] });
    const firstToken = tokenOf(email)!;
    const second = await admin.browser.post('/org/invitations', { email, roles: ['projectManager', 'finance'] });
    expect(second.status).toBe(201);
    expect(second.body.invitation.roles).toEqual(['projectManager', 'finance']);

    const pending = await admin.browser.get('/org/invitations?status=pending');
    expect(pending.status).toBe(200);
    expect(pending.body.items.map((i: { id: string }) => i.id)).toEqual([second.body.invitation.id]);
    const revoked = await admin.browser.get('/org/invitations?status=revoked');
    expect(revoked.body.items.map((i: { id: string }) => i.id)).toEqual([first.body.invitation.id]);
    expect(JSON.stringify([pending.body, revoked.body])).not.toContain(firstToken);

    const stale = await (await new Browser(app).open()).get(`/invitations/${firstToken}`);
    expect(stale.status).toBe(410);
  });

  it('rejects inviting an active member or a deactivated member', async () => {
    const active = newEmail();
    await seedMembership(db, organizationId, await seedUser(db, active));
    const activeResponse = await admin.browser.post('/org/invitations', { email: active });
    expect(activeResponse.status).toBe(409);
    expect(activeResponse.body.error.code).toBe('ALREADY_MEMBER');

    const deactivated = newEmail();
    const membershipId = await seedMembership(db, organizationId, await seedUser(db, deactivated));
    await db.ownerPool.query(
      "UPDATE organization_membership SET status = 'deactivated', deactivated_at = now() WHERE id = $1",
      [membershipId],
    );
    const deactivatedResponse = await admin.browser.post('/org/invitations', { email: deactivated });
    expect(deactivatedResponse.status).toBe(409);
    expect(deactivatedResponse.body.error.code).toBe('MEMBER_DEACTIVATED_USE_REACTIVATE');
  });

  it('a person who belongs to another organization can still be invited', async () => {
    const email = newEmail();
    await seedMembership(db, await seedOrganization(db, 'Beta'), await seedUser(db, email));
    expect((await admin.browser.post('/org/invitations', { email })).status).toBe(201);
  });

  it('revokes a pending invitation once', async () => {
    const created = await admin.browser.post('/org/invitations', { email: newEmail() });
    const id: string = created.body.invitation.id;
    expect((await admin.browser.delete(`/org/invitations/${id}`)).status).toBe(204);
    const again = await admin.browser.delete(`/org/invitations/${id}`);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INVITATION_NOT_PENDING');
    expect((await admin.browser.delete(`/org/invitations/${randomUUID()}`)).status).toBe(404);
    expect((await admin.browser.delete('/org/invitations/not-a-uuid')).status).toBe(404);
  });

  it('validates the request', async () => {
    expect((await admin.browser.post('/org/invitations', { email: 'nope' })).status).toBe(400);
    expect((await admin.browser.post('/org/invitations', { email: newEmail(), roles: [] })).status).toBe(400);
    expect((await admin.browser.post('/org/invitations', { email: newEmail(), roles: ['owner'] })).status).toBe(400);
    expect((await admin.browser.get('/org/invitations?status=unknown')).status).toBe(400);
  });

  it('writes an audit entry without the token', async () => {
    const email = newEmail();
    const created = await admin.browser.post('/org/invitations', { email });
    const { rows } = await db.ownerPool.query<{ actor_user_id: string; after: unknown }>(
      "SELECT actor_user_id, after FROM audit_entry WHERE action = 'org.member.invite' AND target_id = $1",
      [created.body.invitation.id],
    );
    expect(rows).toEqual([{ actor_user_id: admin.userId, after: { email, roles: ['member'] } }]);
  });

  it('denies members without org.member.invite', async () => {
    const member = await signedInMember(app, db, organizationId, ['projectManager', 'finance']);
    const invite = await member.browser.post('/org/invitations', { email: newEmail() });
    expect(invite.status).toBe(403);
    expect(invite.body.error.code).toBe('FORBIDDEN');
    expect((await member.browser.get('/org/invitations')).status).toBe(403);
  });
});
