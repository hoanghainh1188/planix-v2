import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { withAnonymousTransaction } from '../../../shared/db/client.ts';
import { Browser } from '../../../test/browser.ts';
import { DAY, FakeClock, MINUTE } from '../../../test/fake-clock.ts';
import { useTestDatabase } from '../../../test/postgres.ts';
import { RecordingMailSender } from '../../../test/recording-mail-sender.ts';
import { seedInvitation, seedOrganization, seedUser, seedUserWithPassword } from '../../../test/seed.ts';
import { createTestApp } from '../../../test/test-app.ts';

const db = useTestDatabase();
const clock = new FakeClock(new Date().toISOString());
let app: INestApplication;
let organizationId: string;
let inviterId: string;

const email = () => `invitee-${randomUUID().slice(0, 8)}@acme.test`;
const inSevenDays = () => new Date(clock.now().getTime() + 7 * DAY);

beforeAll(async () => {
  app = await createTestApp({ database: db, mailSender: new RecordingMailSender(), clock });
});

afterAll(() => app.close());

beforeEach(async () => {
  organizationId = await seedOrganization(db, 'Acme');
  inviterId = await seedUser(db);
});

describe('accept invitation (FR-005, FR-010, Q2)', () => {
  it('describes a valid invitation', async () => {
    const address = email();
    const token = await seedInvitation(db, {
      organizationId,
      email: address,
      invitedByUserId: inviterId,
      expiresAt: inSevenDays(),
    });
    const response = await new Browser(app).get(`/invitations/${token}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ organizationName: 'Acme', email: address, requiresAccountCreation: true });
  });

  it('creates the account, membership and roles, then signs in to the inviting organization', async () => {
    const address = email();
    const token = await seedInvitation(db, {
      organizationId,
      email: address,
      roles: ['admin', 'finance'],
      invitedByUserId: inviterId,
      expiresAt: inSevenDays(),
    });
    const browser = await new Browser(app).open();

    const tooShort = await browser.post(`/invitations/${token}/accept`, { password: 'short-11chr' });
    expect(tooShort.status).toBe(400);
    expect(tooShort.body).toEqual({ error: { code: 'PASSWORD_POLICY_VIOLATION', params: { rule: 'MIN_LENGTH_12' } } });

    const accepted = await browser.post(`/invitations/${token}/accept`, { password: 'lantern-fjord-42' });
    expect(accepted.status).toBe(200);
    expect(accepted.body.activeOrganizationId).toBe(organizationId);
    expect(accepted.body.user.email).toBe(address);
    expect(accepted.body.memberships).toEqual([
      { organizationId, organizationName: 'Acme', status: 'active', roles: ['admin', 'finance'] },
    ]);
    expect(browser.cookies.has('planix_session')).toBe(true);

    const { rows } = await db.ownerPool.query<{ status: string; accepted_at: Date | null }>(
      'SELECT status, accepted_at FROM organization_invitation WHERE organization_id = $1',
      [organizationId],
    );
    expect(rows[0]?.status).toBe('accepted');

    const session = await browser.get('/auth/session');
    expect(session.status).toBe(200);
    expect(session.body.activeOrganizationId).toBe(organizationId);
  });

  it.each([
    ['expired after 7 days', 'pending', 7 * DAY + MINUTE],
    ['revoked', 'revoked', 0],
    ['already used', 'accepted', 0],
  ] as const)('rejects an invitation that is %s with 410', async (_label, status, advance) => {
    const token = await seedInvitation(db, {
      organizationId,
      email: email(),
      invitedByUserId: inviterId,
      expiresAt: inSevenDays(),
      status,
    });
    const browser = await new Browser(app).open();
    clock.advance(advance);
    try {
      expect((await browser.get(`/invitations/${token}`)).status).toBe(410);
      const response = await browser.post(`/invitations/${token}/accept`, { password: 'lantern-fjord-42' });
      expect(response.status).toBe(410);
      expect(response.body.error.code).toBe('TOKEN_INVALID_OR_EXPIRED');
    } finally {
      clock.advance(-advance);
    }
  });

  it('rejects unknown tokens with 410', async () => {
    const browser = await new Browser(app).open();
    expect((await browser.get('/invitations/unknown-token')).status).toBe(410);
  });

  it('requires an existing account to be signed in with the invited email', async () => {
    const address = email();
    await seedUserWithPassword(db, address, 'existing-account-pw');
    const token = await seedInvitation(db, {
      organizationId,
      email: address,
      invitedByUserId: inviterId,
      expiresAt: inSevenDays(),
    });

    const description = await new Browser(app).get(`/invitations/${token}`);
    expect(description.body.requiresAccountCreation).toBe(false);

    const other = email();
    await seedUserWithPassword(db, other, 'other-account-pw1');
    const wrongUser = new Browser(app);
    expect((await wrongUser.login(other, 'other-account-pw1')).status).toBe(200);
    const mismatch = await wrongUser.post(`/invitations/${token}/accept`, {});
    expect(mismatch.status).toBe(403);
    expect(mismatch.body.error.code).toBe('INVITATION_EMAIL_MISMATCH');

    const rightUser = new Browser(app);
    expect((await rightUser.login(address, 'existing-account-pw')).status).toBe(200);
    const accepted = await rightUser.post(`/invitations/${token}/accept`, {});
    expect(accepted.status).toBe(200);
    expect(accepted.body.activeOrganizationId).toBe(organizationId);
  });

  it('accepts a double-submitted invitation once and rejects the duplicate without a server error', async () => {
    const address = email();
    const token = await seedInvitation(db, {
      organizationId,
      email: address,
      invitedByUserId: inviterId,
      expiresAt: inSevenDays(),
    });
    const [first, second] = [await new Browser(app).open(), await new Browser(app).open()];
    const responses = await Promise.all([
      first.post(`/invitations/${token}/accept`, { password: 'lantern-fjord-42' }),
      second.post(`/invitations/${token}/accept`, { password: 'lantern-fjord-42' }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 410]);
  });

  it('handles two organizations inviting the same new email accepted at the same time', async () => {
    const address = email();
    const otherOrganizationId = await seedOrganization(db, 'Beta');
    const tokenA = await seedInvitation(db, {
      organizationId,
      email: address,
      invitedByUserId: inviterId,
      expiresAt: inSevenDays(),
    });
    const tokenB = await seedInvitation(db, {
      organizationId: otherOrganizationId,
      email: address,
      invitedByUserId: inviterId,
      expiresAt: inSevenDays(),
    });
    const [a, b] = [await new Browser(app).open(), await new Browser(app).open()];
    const responses = await Promise.all([
      a.post(`/invitations/${tokenA}/accept`, { password: 'lantern-fjord-42' }),
      b.post(`/invitations/${tokenB}/accept`, { password: 'lantern-fjord-42' }),
    ]);
    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).not.toContain(500);
    expect(statuses).toEqual([200, 401]);
    const loser = responses.find((r) => r.status === 401);
    expect(loser?.body.error.code).toBe('AUTH_REQUIRED');
    const { rows } = await db.ownerPool.query('SELECT 1 FROM app_user WHERE email = $1', [address]);
    expect(rows).toHaveLength(1);
  });

  it('offers no self sign-up route', async () => {
    const browser = await new Browser(app).open();
    for (const path of ['/auth/register', '/auth/signup', '/users']) {
      expect((await browser.post(path, { email: email(), password: 'lantern-fjord-42' })).status, path).toBe(404);
    }
  });

  it('lets planix_app read invitations only through the token lookup function', async () => {
    await seedInvitation(db, { organizationId, email: email(), invitedByUserId: inviterId, expiresAt: inSevenDays() });
    const direct = await withAnonymousTransaction(db, (tx) => tx.client.query('SELECT * FROM organization_invitation'));
    expect(direct.rowCount).toBe(0);
  });
});
