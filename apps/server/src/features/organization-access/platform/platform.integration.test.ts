import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SESSION_COOKIE, CSRF_COOKIE } from '../../../shared/auth/session-cookie.ts';
import { SessionStore } from '../../../shared/auth/session-store.ts';
import { systemClock } from '../../../shared/clock/clock.ts';
import { withPlatformTransaction } from '../../../shared/db/client.ts';
import { SmtpMailSender } from '../../../shared/mail/smtp-mail-sender.ts';
import { Browser } from '../../../test/browser.ts';
import { TestMailpit } from '../../../test/mailpit.ts';
import { useTestDatabase } from '../../../test/postgres.ts';
import { seedMembership, seedOperator, seedOrganization, seedUser } from '../../../test/seed.ts';
import { createTestApp } from '../../../test/test-app.ts';

const db = useTestDatabase();
const sessions = new SessionStore(db, systemClock);
let mailpit: TestMailpit;
let mail: SmtpMailSender;
let app: INestApplication;

async function signedIn(userId: string, organizationId: string | null): Promise<Browser> {
  const browser = new Browser(app);
  const { sessionToken, csrfToken } = await sessions.create(userId, organizationId);
  browser.cookies.set(SESSION_COOKIE, sessionToken);
  browser.cookies.set(CSRF_COOKIE, csrfToken);
  return browser;
}

beforeAll(async () => {
  mailpit = await TestMailpit.start();
  mail = new SmtpMailSender({ smtpUrl: mailpit.smtpUrl, from: 'Planix <no-reply@planix.test>' });
  app = await createTestApp({ database: db, mailSender: mail });
});

afterAll(async () => {
  await app.close();
  await mail.close();
  await mailpit.stop();
});

describe('Platform Operator (FR-004, Q1, R11)', () => {
  it('creates an organization and emails the first admin invitation', async () => {
    const operator = await signedIn(await seedOperator(db), null);
    const email = `admin-${randomUUID().slice(0, 8)}@acme.test`;

    const response = await operator.post('/platform/organizations', { name: 'Acme', firstAdminEmail: email });

    expect(response.status).toBe(201);
    expect(response.body.organization).toMatchObject({ name: 'Acme', status: 'active' });
    expect(response.body.invitation).toMatchObject({ email, roles: ['admin'], status: 'pending' });
    expect(JSON.stringify(response.body)).not.toMatch(/token/i);

    const [message] = await mailpit.messagesTo(email);
    expect(message?.Subject).toContain('Acme');
    expect(await mailpit.text(message!.ID)).toMatch(/https:\/\/app\.planix\.test\/invitations\/[A-Za-z0-9_-]{43}/);

    const { rows } = await db.ownerPool.query<{ actor_kind: string; action: string }>(
      'SELECT actor_kind, action FROM audit_entry WHERE organization_id = $1',
      [response.body.organization.id],
    );
    expect(rows).toContainEqual({ actor_kind: 'platformOperator', action: 'platform.organization.create' });
  });

  it('forbids non-operators, including admins of other organizations', async () => {
    const organizationId = await seedOrganization(db);
    const adminId = await seedUser(db);
    await seedMembership(db, organizationId, adminId, ['admin']);
    const admin = await signedIn(adminId, organizationId);
    const response = await admin.post('/platform/organizations', { name: 'Evil', firstAdminEmail: 'x@evil.test' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect((await admin.get('/platform/organizations')).status).toBe(403);
  });

  it('lists organizations without membership or project data', async () => {
    const operator = await signedIn(await seedOperator(db), null);
    const created = await operator.post('/platform/organizations', {
      name: 'Listed',
      firstAdminEmail: `l-${randomUUID()}@t.test`,
    });
    const response = await operator.get('/platform/organizations');
    expect(response.status).toBe(200);
    const item = response.body.items.find((i: { id: string }) => i.id === created.body.organization.id);
    expect(Object.keys(item).sort()).toEqual(['activeAdminCount', 'createdAt', 'id', 'name', 'status']);
    expect(item.activeAdminCount).toBe(0);
    expect(item.createdAt).toMatch(/Z$/);
  });

  it('re-sends the admin invitation and revokes the previous pending one', async () => {
    const operator = await signedIn(await seedOperator(db), null);
    const email = `resend-${randomUUID().slice(0, 8)}@acme.test`;
    const created = await operator.post('/platform/organizations', { name: 'Resend', firstAdminEmail: email });
    const organizationId = created.body.organization.id as string;

    const resent = await operator.post(`/platform/organizations/${organizationId}/admin-invitations`, { email });
    expect(resent.status).toBe(201);

    const { rows } = await db.ownerPool.query<{ status: string }>(
      'SELECT status FROM organization_invitation WHERE organization_id = $1 ORDER BY created_at',
      [organizationId],
    );
    expect(rows.map((r) => r.status)).toEqual(['revoked', 'pending']);
    expect(await mailpit.messagesTo(email)).toHaveLength(2);
  });

  it('answers 404 when re-sending for an unknown organization', async () => {
    const operator = await signedIn(await seedOperator(db), null);
    const response = await operator.post(`/platform/organizations/${randomUUID()}/admin-invitations`, {
      email: 'a@b.test',
    });
    expect(response.status).toBe(404);
  });

  it('validates the request body', async () => {
    const operator = await signedIn(await seedOperator(db), null);
    const response = await operator.post('/platform/organizations', { name: '', firstAdminEmail: 'not-an-email' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('cannot insert non-admin invitations at the database level', async () => {
    const organizationId = await seedOrganization(db);
    const operatorId = await seedOperator(db);
    await expect(
      withPlatformTransaction(db, (tx) =>
        tx.client.query(
          `INSERT INTO organization_invitation (organization_id, email, roles, token_hash, expires_at, invited_by_user_id, invited_by_kind)
           VALUES ($1, 'm@t.test', '{member}', $2, now() + interval '7 days', $3, 'platformOperator')`,
          [organizationId, Buffer.from(randomUUID()), operatorId],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});
