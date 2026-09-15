import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MailSender } from '../../../shared/mail/mail-sender.ts';
import { SmtpMailSender } from '../../../shared/mail/smtp-mail-sender.ts';
import { Browser } from '../../../test/browser.ts';
import { FakeClock, HOUR, MINUTE } from '../../../test/fake-clock.ts';
import { TestMailpit } from '../../../test/mailpit.ts';
import { useTestDatabase } from '../../../test/postgres.ts';
import { seedUserWithPassword } from '../../../test/seed.ts';
import { createTestApp, TEST_APP_BASE_URL } from '../../../test/test-app.ts';

const db = useTestDatabase();
const clock = new FakeClock(new Date().toISOString());
let mailpit: TestMailpit;
let mail: SmtpMailSender;
let app: INestApplication;
const OLD = 'lantern-fjord-42';
const NEW = 'granite-harbor-77';
const newEmail = () => `reset-${randomUUID().slice(0, 8)}@acme.test`;

beforeAll(async () => {
  mailpit = await TestMailpit.start();
  mail = new SmtpMailSender({ smtpUrl: mailpit.smtpUrl, from: 'Planix <no-reply@planix.test>' });
  app = await createTestApp({ database: db, mailSender: mail, clock });
});

afterAll(async () => {
  await app.close();
  await mail.close();
  await mailpit.stop();
});

async function resetTokens(email: string, count = 1): Promise<string[]> {
  const messages = [...(await mailpit.waitForMessagesTo(email, count))].sort((a, b) =>
    b.Created.localeCompare(a.Created),
  );
  const texts = await Promise.all(messages.map((m) => mailpit.text(m.ID)));
  // Newest first.
  return texts.map((t) => /\/password-reset\/([A-Za-z0-9_-]{43})/.exec(t)?.[1] ?? '');
}

describe('password reset (FR-031, FR-008, SC-009, Q14)', () => {
  it('answers 202 for existing and unknown emails alike, emailing only existing accounts', async () => {
    const email = newEmail();
    await seedUserWithPassword(db, email, OLD);
    const unknown = newEmail();
    const browser = await new Browser(app).open();
    const b = await browser.post('/auth/password-reset/request', { email: unknown });
    const a = await browser.post('/auth/password-reset/request', { email });
    expect(a.status).toBe(202);
    expect(b.status).toBe(202);
    expect(a.body).toEqual(b.body);
    expect(await mailpit.waitForMessagesTo(email, 1)).toHaveLength(1);
    expect(await mailpit.messagesTo(unknown)).toHaveLength(0);
  });

  it('answers before the reset email is sent, so response time does not reveal the account (FR-008)', async () => {
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    const sent: string[] = [];
    const gatedMail: MailSender = {
      send: async (to) => {
        await released;
        sent.push(to);
      },
    };
    const gatedApp = await createTestApp({ database: db, mailSender: gatedMail, clock });
    const email = newEmail();
    await seedUserWithPassword(db, email, OLD);
    try {
      const browser = await new Browser(gatedApp).open();
      const outcome = await Promise.race([
        browser.post('/auth/password-reset/request', { email }),
        new Promise<'still waiting'>((resolve) => setTimeout(() => resolve('still waiting'), 3000)),
      ]);
      expect(outcome === 'still waiting' ? outcome : outcome.status).toBe(202);
      expect(sent).toEqual([]);
    } finally {
      release();
      await gatedApp.close();
    }
    // Shutdown waits for background reset work, so the email still goes out.
    expect(sent).toEqual([email]);
  });

  it('logs a failed reset email without the link', async () => {
    const lines: string[] = [];
    const failingMail: MailSender = {
      send: (_to, message) =>
        Promise.reject(new Error(`SMTP rejected ${message.kind === 'passwordReset' ? message.resetUrl : ''}`)),
    };
    const failingApp = await createTestApp({
      database: db,
      mailSender: failingMail,
      clock,
      logSink: (line) => lines.push(line),
    });
    const email = newEmail();
    await seedUserWithPassword(db, email, OLD);
    try {
      const browser = await new Browser(failingApp).open();
      expect((await browser.post('/auth/password-reset/request', { email })).status).toBe(202);
    } finally {
      await failingApp.close();
    }
    expect(lines.some((l) => l.includes('password reset request failed'))).toBe(true);
    expect(lines.join('\n')).not.toContain(`${TEST_APP_BASE_URL}/password-reset/`);
    expect(lines.join('\n')).not.toContain('SMTP rejected');
  });

  it('resets the password once, revokes all sessions and enforces the password policy', async () => {
    const email = newEmail();
    await seedUserWithPassword(db, email, OLD);
    const signedIn = new Browser(app);
    await signedIn.login(email, OLD);

    const browser = await new Browser(app).open();
    await browser.post('/auth/password-reset/request', { email });
    const [token] = await resetTokens(email);

    const weak = await browser.post('/auth/password-reset/confirm', { token, newPassword: 'password1234' });
    expect(weak.status).toBe(400);
    expect(weak.body.error).toEqual({ code: 'PASSWORD_POLICY_VIOLATION', params: { rule: 'COMMON_PASSWORD' } });

    expect((await browser.post('/auth/password-reset/confirm', { token, newPassword: NEW })).status).toBe(204);
    expect((await signedIn.get('/auth/session')).status).toBe(401);
    expect((await new Browser(app).login(email, OLD)).status).toBe(401);
    expect((await new Browser(app).login(email, NEW)).status).toBe(200);

    const reused = await browser.post('/auth/password-reset/confirm', { token, newPassword: 'another-good-pass' });
    expect(reused.status).toBe(410);
    expect(reused.body.error.code).toBe('TOKEN_INVALID_OR_EXPIRED');
  });

  it('expires links after 1 hour', async () => {
    const email = newEmail();
    await seedUserWithPassword(db, email, OLD);
    const browser = await new Browser(app).open();
    await browser.post('/auth/password-reset/request', { email });
    const [token] = await resetTokens(email);
    clock.advance(HOUR + MINUTE);
    expect((await browser.post('/auth/password-reset/confirm', { token, newPassword: NEW })).status).toBe(410);
  });

  it('keeps only the newest link valid', async () => {
    const email = newEmail();
    await seedUserWithPassword(db, email, OLD);
    const browser = await new Browser(app).open();
    await browser.post('/auth/password-reset/request', { email });
    await resetTokens(email, 1);
    await browser.post('/auth/password-reset/request', { email });
    const [newest, older] = await resetTokens(email, 2);
    expect((await browser.post('/auth/password-reset/confirm', { token: older, newPassword: NEW })).status).toBe(410);
    expect((await browser.post('/auth/password-reset/confirm', { token: newest, newPassword: NEW })).status).toBe(204);
  });

  it('never writes the token to logs or audit entries', async () => {
    const lines: string[] = [];
    const logged = await createTestApp({ database: db, mailSender: mail, clock, logSink: (line) => lines.push(line) });
    const email = newEmail();
    await seedUserWithPassword(db, email, OLD);
    try {
      const browser = await new Browser(logged).open();
      await browser.post('/auth/password-reset/request', { email });
      const [token] = await resetTokens(email);
      await browser.post('/auth/password-reset/confirm', { token, newPassword: NEW });
      const { rows } = await db.ownerPool.query('SELECT before, after FROM audit_entry WHERE action LIKE $1', [
        'auth.password-reset%',
      ]);
      expect(JSON.stringify(rows)).not.toContain(token!);
      expect(lines.some((l) => l.includes('/password-reset/confirm'))).toBe(true);
      expect(lines.join('\n')).not.toContain(token!);
    } finally {
      await logged.close();
    }
  });
});
