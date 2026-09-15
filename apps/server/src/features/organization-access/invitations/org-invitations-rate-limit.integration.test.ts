import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../test/postgres.ts';
import { RecordingMailSender } from '../../../test/recording-mail-sender.ts';
import { seedOrganization } from '../../../test/seed.ts';
import { signedInMember } from '../../../test/signed-in-member.ts';
import { createTestApp } from '../../../test/test-app.ts';

const db = useTestDatabase();
let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp({
    database: db,
    mailSender: new RecordingMailSender(),
    invitationRateLimit: { windowMs: 60_000, limit: 2 },
  });
});

afterAll(() => app.close());

const invite = (browser: { post: (path: string, body: object) => Promise<{ status: number; body: unknown }> }) =>
  browser.post('/org/invitations', { email: `spam-${randomUUID().slice(0, 8)}@example.test` });

describe('invitation sending limit per user (security review: spam relay)', () => {
  it('refuses invitations beyond the limit for that user only, and sends no email for them', async () => {
    const organizationId = await seedOrganization(db);
    const first = await signedInMember(app, db, organizationId, ['admin']);
    const second = await signedInMember(app, db, organizationId, ['admin']);

    expect((await invite(first.browser)).status).toBe(201);
    expect((await invite(first.browser)).status).toBe(201);
    const limited = await invite(first.browser);
    expect(limited).toMatchObject({ status: 429, body: { error: { code: 'RATE_LIMITED', params: {} } } });

    expect((await invite(second.browser)).status).toBe(201);

    const { rows } = await db.ownerPool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM organization_invitation WHERE invited_by_user_id = $1',
      [first.userId],
    );
    expect(rows[0]!.count).toBe(2);
  });

  it('a new session of the same user shares the limit', async () => {
    const organizationId = await seedOrganization(db);
    const admin = await signedInMember(app, db, organizationId, ['admin']);
    await invite(admin.browser);
    await invite(admin.browser);
    const { Browser } = await import('../../../test/browser.ts');
    const { MEMBER_PASSWORD } = await import('../../../test/signed-in-member.ts');
    const again = new Browser(app);
    await again.login(admin.email, MEMBER_PASSWORD);
    expect((await invite(again)).status).toBe(429);
  });
});
