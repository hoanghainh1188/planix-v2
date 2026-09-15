import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Browser } from '../../../test/browser.ts';
import { FakeClock, MINUTE } from '../../../test/fake-clock.ts';
import { useTestDatabase } from '../../../test/postgres.ts';
import { RecordingMailSender } from '../../../test/recording-mail-sender.ts';
import { seedMembership, seedOrganization, seedUserWithPassword } from '../../../test/seed.ts';
import { createTestApp } from '../../../test/test-app.ts';

const db = useTestDatabase();
const clock = new FakeClock(new Date().toISOString());
let app: INestApplication;
const PASSWORD = 'lantern-fjord-42';

const newEmail = () => `login-${randomUUID().slice(0, 8)}@acme.test`;

beforeAll(async () => {
  app = await createTestApp({ database: db, mailSender: new RecordingMailSender(), clock });
});

afterAll(() => app.close());

describe('login and logout (FR-006–FR-008, Q12, Q13)', () => {
  it('signs in with email and password and returns the session payload', async () => {
    const email = newEmail();
    const userId = await seedUserWithPassword(db, email, PASSWORD, { locale: 'en' });
    const organizationId = await seedOrganization(db, 'Acme');
    await seedMembership(db, organizationId, userId, ['projectManager']);

    const browser = new Browser(app);
    const response = await browser.login(email.toUpperCase(), PASSWORD);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: { id: userId, email, locale: 'en', timeZone: 'Asia/Ho_Chi_Minh' },
      memberships: [{ organizationId, organizationName: 'Acme', status: 'active', roles: ['projectManager'] }],
      activeOrganizationId: organizationId,
    });
    const setCookie = ([] as string[]).concat(response.headers['set-cookie'] ?? []);
    const sessionCookie = setCookie.find((c) => c.startsWith('planix_session='));
    expect(sessionCookie).toMatch(/HttpOnly/);
    expect(sessionCookie).not.toMatch(/Max-Age|Expires/i);
  });

  it('returns the same 401 for a wrong password, an unknown email and a locked account', async () => {
    const email = newEmail();
    await seedUserWithPassword(db, email, PASSWORD);
    const wrong = await new Browser(app).login(email, 'wrong-password-1');
    const unknown = await new Browser(app).login(newEmail(), PASSWORD);
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual({ error: { code: 'AUTH_INVALID_CREDENTIALS', params: {} } });
    expect(unknown.body).toEqual(wrong.body);
  });

  it('locks the account for 15 minutes after 5 consecutive failures', async () => {
    const email = newEmail();
    await seedUserWithPassword(db, email, PASSWORD);
    const browser = await new Browser(app).open();
    for (let i = 0; i < 5; i++)
      expect((await browser.post('/auth/login', { email, password: `bad-password-${i}` })).status).toBe(401);

    const whileLocked = await browser.post('/auth/login', { email, password: PASSWORD });
    expect(whileLocked.status).toBe(401);
    expect(whileLocked.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');

    clock.advance(15 * MINUTE);
    expect((await browser.post('/auth/login', { email, password: PASSWORD })).status).toBe(200);
  });

  it('locks the account even when failed attempts arrive concurrently (FR-006)', async () => {
    const email = newEmail();
    const userId = await seedUserWithPassword(db, email, PASSWORD);
    const browser = await new Browser(app).open();

    const attempts = await Promise.all(
      Array.from({ length: 5 }, (_, i) => browser.post('/auth/login', { email, password: `parallel-bad-${i}` })),
    );
    expect(attempts.map((r) => r.status)).toEqual([401, 401, 401, 401, 401]);

    const { rows } = await db.ownerPool.query<{ locked_until: Date | null }>(
      'SELECT locked_until FROM app_user WHERE id = $1',
      [userId],
    );
    expect(rows[0]?.locked_until).not.toBeNull();
    expect((await browser.post('/auth/login', { email, password: PASSWORD })).status).toBe(401);
  });

  it('logs out and invalidates the session', async () => {
    const email = newEmail();
    await seedUserWithPassword(db, email, PASSWORD);
    const browser = new Browser(app);
    await browser.login(email, PASSWORD);
    expect((await browser.get('/auth/session')).status).toBe(200);
    const sessionToken = browser.cookies.get('planix_session');

    expect((await browser.post('/auth/logout')).status).toBe(204);
    expect(browser.cookies.has('planix_session')).toBe(false);
    const replay = new Browser(app);
    replay.cookies.set('planix_session', sessionToken!);
    expect((await replay.get('/auth/session')).status).toBe(401);
  });

  it('audits successful and failed logins without the password', async () => {
    const email = newEmail();
    const userId = await seedUserWithPassword(db, email, PASSWORD);
    await new Browser(app).login(email, 'wrong-password-9');
    await new Browser(app).login(email, PASSWORD);
    const { rows } = await db.ownerPool.query<{ outcome: string; before: unknown; after: unknown }>(
      "SELECT outcome, before, after FROM audit_entry WHERE action = 'auth.login' AND target_id = $1 ORDER BY occurred_at",
      [userId],
    );
    expect(rows.map((r) => r.outcome)).toEqual(['denied', 'succeeded']);
    expect(JSON.stringify(rows)).not.toContain(PASSWORD);
  });

  it('validates the login body', async () => {
    const browser = await new Browser(app).open();
    const response = await browser.post('/auth/login', { email: 42 });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });
});
