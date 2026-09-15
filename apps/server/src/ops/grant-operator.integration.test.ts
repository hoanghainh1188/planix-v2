import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { hashToken } from '../shared/auth/secure-token.ts';
import { Browser } from '../test/browser.ts';
import { useTestDatabase } from '../test/postgres.ts';
import { RecordingMailSender } from '../test/recording-mail-sender.ts';
import { seedUser } from '../test/seed.ts';
import { createTestApp, TEST_APP_BASE_URL } from '../test/test-app.ts';
import { grantOperator } from './grant-operator.ts';

const db = useTestDatabase();
const mail = new RecordingMailSender();
let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp({ database: db, mailSender: mail });
});

afterAll(() => app.close());

const email = () => `ops-${randomUUID().slice(0, 8)}@planix.test`;
const create = { mailSender: mail, appBaseUrl: TEST_APP_BASE_URL };

describe('ops:grant-operator (R11)', () => {
  it('grants the platform operator role to an existing account and audits it as system', async () => {
    const address = email();
    const userId = await seedUser(db, address);
    await expect(grantOperator(db, address.toUpperCase(), 'alice', { confirmExistingAccount: true })).resolves.toEqual({
      userId,
      alreadyGranted: false,
      accountCreated: false,
    });
    await expect(grantOperator(db, address, 'alice')).resolves.toEqual({
      userId,
      alreadyGranted: true,
      accountCreated: false,
    });

    const { rows } = await db.ownerPool.query<{ granted_by: string }>(
      'SELECT granted_by FROM platform_operator_grant WHERE user_id = $1',
      [userId],
    );
    expect(rows).toEqual([{ granted_by: 'alice' }]);
    const audit = await db.ownerPool.query<{ actor_kind: string }>(
      "SELECT actor_kind FROM audit_entry WHERE action = 'platform.operator.grant' AND target_id = $1",
      [userId],
    );
    expect(audit.rows).toEqual([{ actor_kind: 'system' }]);
  });

  it('does not grant an existing account without --confirm: shows which account matched and writes nothing (security review)', async () => {
    const address = email();
    const userId = await seedUser(db, address);
    const refusal = grantOperator(db, address, 'alice');
    await expect(refusal).rejects.toThrow(new RegExp(`${userId}.*created .*Z.*--confirm`));
    const { rowCount } = await db.ownerPool.query('SELECT 1 FROM platform_operator_grant WHERE user_id = $1', [userId]);
    expect(rowCount).toBe(0);
    const audit = await db.ownerPool.query(
      "SELECT 1 FROM audit_entry WHERE action = 'platform.operator.grant' AND target_id = $1",
      [userId],
    );
    expect(audit.rowCount).toBe(0);
  });

  it('refuses unknown accounts without --create, pointing to it, and writes nothing', async () => {
    const address = email();
    await expect(grantOperator(db, address, 'alice')).rejects.toThrow(/No account.*--create/);
    const { rowCount } = await db.ownerPool.query('SELECT 1 FROM app_user WHERE email = $1', [address]);
    expect(rowCount).toBe(0);
    expect(mail.lastTo(address)).toBeUndefined();
  });
});

describe('ops:grant-operator --create: the first Platform Operator (decision 2026-09-15-005-first-platform-operator)', () => {
  it('creates the account, grants Operator and emails a password reset link; nothing secret is stored or audited', async () => {
    const address = email();
    const result = await grantOperator(db, address, 'alice', { create: { ...create, locale: 'en' } });
    expect(result).toEqual({ userId: expect.any(String), alreadyGranted: false, accountCreated: true });

    const message = mail.lastTo(address);
    expect(message).toMatchObject({ kind: 'passwordReset', locale: 'en' });
    const link = message?.kind === 'passwordReset' ? message.resetUrl : '';
    expect(link).toMatch(new RegExp(`^${TEST_APP_BASE_URL}/password-reset/[A-Za-z0-9_-]{43}$`));
    const token = link.split('/').at(-1)!;

    const user = await db.ownerPool.query<{ locale: string; password_hash: string }>(
      'SELECT locale, password_hash FROM app_user WHERE id = $1',
      [result.userId],
    );
    expect(user.rows[0]?.locale).toBe('en');
    expect(user.rows[0]?.password_hash).toMatch(/^\$argon2id\$/);
    const grant = await db.ownerPool.query('SELECT 1 FROM platform_operator_grant WHERE user_id = $1', [result.userId]);
    expect(grant.rowCount).toBe(1);
    const stored = await db.ownerPool.query(
      'SELECT 1 FROM password_reset_token WHERE user_id = $1 AND token_hash = $2',
      [result.userId, hashToken(token)],
    );
    expect(stored.rowCount).toBe(1);

    const audit = await db.ownerPool.query<{ actor_kind: string; after: unknown; entry: string }>(
      "SELECT actor_kind, after, row_to_json(a)::text AS entry FROM audit_entry a WHERE action = 'platform.operator.grant' AND target_id = $1",
      [result.userId],
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({ actor_kind: 'system', after: { grantedBy: 'alice', accountCreated: true } });
    expect(audit.rows[0]!.entry).not.toContain(token);
    expect(audit.rows[0]!.entry).not.toContain(hashToken(token).toString('hex'));
  });

  it('lets the new Operator set a password from the link, sign in and create an organization', async () => {
    const address = email();
    await grantOperator(db, address, 'alice', { create });
    const message = mail.lastTo(address);
    const token = message?.kind === 'passwordReset' ? message.resetUrl.split('/').at(-1)! : '';

    const browser = await new Browser(app).open();
    expect((await browser.login(address, 'anything-at-all-123')).status).toBe(401);
    expect(
      (await browser.post('/auth/password-reset/confirm', { token, newPassword: 'operator-first-password' })).status,
    ).toBe(204);
    expect((await browser.login(address, 'operator-first-password')).status).toBe(200);
    const organization = await browser.post('/platform/organizations', {
      name: 'First Org',
      firstAdminEmail: email(),
    });
    expect(organization.status).toBe(201);
  });

  it('only grants an existing account with --confirm: no new account, no email', async () => {
    const address = email();
    const userId = await seedUser(db, address);
    await expect(grantOperator(db, address, 'alice', { create })).rejects.toThrow(/--confirm/);
    await expect(grantOperator(db, address, 'alice', { create, confirmExistingAccount: true })).resolves.toEqual({
      userId,
      alreadyGranted: false,
      accountCreated: false,
    });
    expect(mail.lastTo(address)).toBeUndefined();
    const tokens = await db.ownerPool.query('SELECT 1 FROM password_reset_token WHERE user_id = $1', [userId]);
    expect(tokens.rowCount).toBe(0);
  });

  it('sends no email when the grant fails and leaves no half-created account', async () => {
    const address = email();
    const failing = {
      mailSender: mail,
      appBaseUrl: TEST_APP_BASE_URL,
      locale: 'fr' as unknown as 'vi',
    };
    await expect(grantOperator(db, address, 'alice', { create: failing })).rejects.toThrow();
    const { rowCount } = await db.ownerPool.query('SELECT 1 FROM app_user WHERE email = $1', [address]);
    expect(rowCount).toBe(0);
    expect(mail.lastTo(address)).toBeUndefined();
  });

  it('when the email fails after commit: says how to recover, keeps the account, and "forgot password" gets a new link', async () => {
    const address = email();
    const failingMail = {
      send: () => Promise.reject(new Error('SMTP connection refused')),
    };
    await expect(
      grantOperator(db, address, 'alice', { create: { mailSender: failingMail, appBaseUrl: TEST_APP_BASE_URL } }),
    ).rejects.toThrow(/account was created and granted.*forgot password/i);

    const { rows } = await db.ownerPool.query<{ id: string }>('SELECT id FROM app_user WHERE email = $1', [address]);
    expect(rows).toHaveLength(1);
    await expect(grantOperator(db, address, 'alice', { create })).resolves.toEqual({
      userId: rows[0]!.id,
      alreadyGranted: true,
      accountCreated: false,
    });

    const browser = await new Browser(app).open();
    expect((await browser.post('/auth/password-reset/request', { email: address })).status).toBe(202);
    const token = await vi.waitFor(() => {
      const message = mail.lastTo(address);
      if (message?.kind !== 'passwordReset') throw new Error('no reset email yet');
      return message.resetUrl.split('/').at(-1)!;
    });
    expect(
      (await browser.post('/auth/password-reset/confirm', { token, newPassword: 'operator-recovered-1' })).status,
    ).toBe(204);
    expect((await browser.login(address, 'operator-recovered-1')).status).toBe(200);
  });
});
