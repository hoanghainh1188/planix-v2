import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Browser } from '../../../test/browser.ts';
import { FakeClock } from '../../../test/fake-clock.ts';
import { useTestDatabase } from '../../../test/postgres.ts';
import { RecordingMailSender } from '../../../test/recording-mail-sender.ts';
import { seedOrganization, seedUserWithPassword } from '../../../test/seed.ts';
import { MEMBER_PASSWORD, signedInMember, type SignedInMember } from '../../../test/signed-in-member.ts';
import { createTestApp } from '../../../test/test-app.ts';

const db = useTestDatabase();
// Q16: 23:30 in Asia/Ho_Chi_Minh is 16:30 UTC.
const clock = new FakeClock('2026-09-15T16:30:00.000Z');
let app: INestApplication;
let admin: SignedInMember;

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

/** Values of every `…At` field (createdAt, expiresAt…) anywhere in a JSON body, whatever their format. */
function timestampsIn(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(timestampsIn);
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, nested]) =>
      /At$/.test(key) ? [nested, ...timestampsIn(nested)] : timestampsIn(nested),
    );
  }
  return [];
}

beforeAll(async () => {
  app = await createTestApp({ database: db, mailSender: new RecordingMailSender(), clock });
  admin = await signedInMember(app, db, await seedOrganization(db, 'Acme'), ['admin', 'projectManager']);
});

afterAll(() => app.close());

describe('PATCH /me — language and time zone (FR-029, FR-030)', () => {
  it('saves locale and IANA time zone and returns them in the session', async () => {
    const response = await admin.browser.patch('/me', { locale: 'en', timeZone: 'Europe/London' });
    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ locale: 'en', timeZone: 'Europe/London' });
    expect((await admin.browser.get('/auth/session')).body.user).toMatchObject({
      locale: 'en',
      timeZone: 'Europe/London',
    });
    expect((await admin.browser.patch('/me', { locale: 'vi' })).body.user).toMatchObject({
      locale: 'vi',
      timeZone: 'Europe/London',
    });
  });

  it('refuses locales other than vi/en and invalid time zones with 400 VALIDATION_FAILED', async () => {
    for (const body of [
      { locale: 'fr' },
      { locale: 'EN' },
      { timeZone: 'Mars/Olympus_Mons' },
      { timeZone: '' },
      { timeZone: 'UTC+7' },
      { locale: 42 },
    ]) {
      const response = await admin.browser.patch('/me', body);
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    }
  });

  it('needs only a session — no organization — and a CSRF token', async () => {
    const email = `solo-${randomUUID().slice(0, 8)}@example.test`;
    await seedUserWithPassword(db, email, MEMBER_PASSWORD);
    const solo = new Browser(app);
    expect((await solo.login(email, MEMBER_PASSWORD)).body.activeOrganizationId).toBeNull();
    expect((await solo.patch('/me', { timeZone: 'Asia/Tokyo' })).status).toBe(200);

    expect((await new Browser(app).patch('/me', { locale: 'en' })).status).toBe(401);
    const withoutCsrf = new Browser(app);
    await withoutCsrf.login(email, MEMBER_PASSWORD);
    withoutCsrf.cookies.delete('planix_csrf');
    expect((await withoutCsrf.patch('/me', { locale: 'en' })).status).toBe(403);
  });
});

describe('timestamps are stored and returned in UTC (FR-030, SC-007, Q16)', () => {
  it('stores an invitation created at 23:30 Asia/Ho_Chi_Minh as 16:30Z and returns ISO 8601 ending in Z', async () => {
    const created = await admin.browser.post('/org/invitations', {
      email: `q16-${randomUUID().slice(0, 8)}@acme.test`,
    });
    expect(created.status).toBe(201);
    const { rows } = await db.ownerPool.query<{ created_at: string; expires_at: string }>(
      "SELECT to_char(created_at AT TIME ZONE 'UTC', 'HH24:MI') AS created_at, expires_at::text FROM organization_invitation WHERE id = $1",
      [created.body.invitation.id],
    );
    expect(rows[0]!.created_at).toBe('16:30');
    expect(created.body.invitation.expiresAt).toBe('2026-09-22T16:30:00.000Z');
  });

  it('uses ISO 8601 UTC for every timestamp in organization, project and invitation responses', async () => {
    await admin.browser.post('/projects', { name: 'UTC project' });
    const bodies = [
      (await admin.browser.get('/org/invitations')).body,
      (await admin.browser.get('/projects')).body,
      (await admin.browser.get('/auth/session')).body,
    ];
    const timestamps = bodies.flatMap(timestampsIn);
    expect(timestamps.length).toBeGreaterThan(0);
    for (const timestamp of timestamps) expect(timestamp).toMatch(ISO_UTC);
  });
});
