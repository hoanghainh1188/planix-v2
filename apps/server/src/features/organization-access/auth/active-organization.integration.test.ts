import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Browser } from '../../../test/browser.ts';
import { useTestDatabase } from '../../../test/postgres.ts';
import { RecordingMailSender } from '../../../test/recording-mail-sender.ts';
import {
  seedMembership,
  seedOperator,
  seedOrganization,
  seedProject,
  seedUserWithPassword,
} from '../../../test/seed.ts';
import { CSRF_COOKIE, SESSION_COOKIE } from '../../../shared/auth/session-cookie.ts';
import { SessionStore } from '../../../shared/auth/session-store.ts';
import { systemClock } from '../../../shared/clock/clock.ts';
import { createTestApp } from '../../../test/test-app.ts';

const db = useTestDatabase();
const mail = new RecordingMailSender();
let app: INestApplication;
const PASSWORD = 'lantern-fjord-42';
const newEmail = () => `multi-${randomUUID().slice(0, 8)}@acme.test`;

beforeAll(async () => {
  app = await createTestApp({ database: db, mailSender: mail });
});

afterAll(() => app.close());

async function lastActiveOrganization(userId: string): Promise<string | null> {
  const { rows } = await db.ownerPool.query<{ id: string | null }>(
    'SELECT last_active_organization_id AS id FROM app_user WHERE id = $1',
    [userId],
  );
  return rows[0]?.id ?? null;
}

describe('multiple organizations and the active organization (FR-017, Q11)', () => {
  it('joins a second organization with an existing account and switches between them', async () => {
    const email = newEmail();
    const userId = await seedUserWithPassword(db, email, PASSWORD);
    const acme = await seedOrganization(db, 'Acme');
    const acmeMembership = await seedMembership(db, acme, userId, ['projectManager']);
    await seedProject(db, acme, acmeMembership);

    const operator = new Browser(app);
    const { sessionToken, csrfToken } = await new SessionStore(db, systemClock).create(await seedOperator(db), null);
    operator.cookies.set(SESSION_COOKIE, sessionToken);
    operator.cookies.set(CSRF_COOKIE, csrfToken);
    const beta = await operator.post('/platform/organizations', { name: 'Beta', firstAdminEmail: email });
    expect(beta.status).toBe(201);
    const betaId = beta.body.organization.id as string;
    const message = mail.lastTo(email);
    const token = message?.kind === 'organizationInvitation' ? message.acceptUrl.split('/').at(-1) : undefined;

    const user = new Browser(app);
    expect((await user.login(email, PASSWORD)).body.activeOrganizationId).toBe(acme);
    const accepted = await user.post(`/invitations/${token}/accept`, {});
    expect(accepted.status).toBe(200);
    expect(accepted.body.activeOrganizationId).toBe(betaId);
    expect(accepted.body.memberships).toHaveLength(2);
    expect(
      accepted.body.memberships.find((m: { organizationId: string }) => m.organizationId === betaId).roles,
    ).toEqual(['admin']);

    const toAcme = await user.put('/auth/session/active-organization', { organizationId: acme });
    expect(toAcme.status).toBe(200);
    expect(toAcme.body.activeOrganizationId).toBe(acme);
    expect(await lastActiveOrganization(userId)).toBe(acme);

    const { rows } = await db.ownerPool.query<{ organization_id: string }>(
      "SELECT organization_id FROM audit_entry WHERE action = 'auth.session.switch-organization' AND actor_user_id = $1",
      [userId],
    );
    expect(rows.map((r) => r.organization_id)).toContain(acme);
  });

  it('refuses to switch to an organization without an active membership', async () => {
    const email = newEmail();
    const userId = await seedUserWithPassword(db, email, PASSWORD);
    const mine = await seedOrganization(db);
    await seedMembership(db, mine, userId);
    const foreign = await seedOrganization(db);
    const user = new Browser(app);
    await user.login(email, PASSWORD);
    for (const organizationId of [foreign, randomUUID()]) {
      const response = await user.put('/auth/session/active-organization', { organizationId });
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
    }
  });

  it('auto-selects on login: single membership, last active, or none', async () => {
    const email = newEmail();
    const userId = await seedUserWithPassword(db, email, PASSWORD);
    const none = await new Browser(app).login(email, PASSWORD);
    expect(none.body).toMatchObject({ memberships: [], activeOrganizationId: null });

    const first = await seedOrganization(db);
    await seedMembership(db, first, userId);
    expect((await new Browser(app).login(email, PASSWORD)).body.activeOrganizationId).toBe(first);

    const second = await seedOrganization(db);
    await seedMembership(db, second, userId);
    expect((await new Browser(app).login(email, PASSWORD)).body.activeOrganizationId).toBeNull();

    const switcher = new Browser(app);
    await switcher.login(email, PASSWORD);
    await switcher.put('/auth/session/active-organization', { organizationId: second });
    expect((await new Browser(app).login(email, PASSWORD)).body.activeOrganizationId).toBe(second);

    await db.ownerPool.query(
      "UPDATE organization_membership SET status = 'deactivated', deactivated_at = now() WHERE organization_id = $1 AND user_id = $2",
      [second, userId],
    );
    expect((await new Browser(app).login(email, PASSWORD)).body.activeOrganizationId).toBe(first);
  });
});
