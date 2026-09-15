import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SmtpMailSender } from '../../../shared/mail/smtp-mail-sender.ts';
import { Browser } from '../../../test/browser.ts';
import { FakeClock, HOUR, MINUTE } from '../../../test/fake-clock.ts';
import { TestMailpit } from '../../../test/mailpit.ts';
import { useTestDatabase } from '../../../test/postgres.ts';
import { seedUserWithPassword } from '../../../test/seed.ts';
import { createTestApp } from '../../../test/test-app.ts';

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

async function resetTokens(email: string): Promise<string[]> {
  const messages = [...(await mailpit.messagesTo(email))].sort((a, b) => b.Created.localeCompare(a.Created));
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
    const a = await browser.post('/auth/password-reset/request', { email });
    const b = await browser.post('/auth/password-reset/request', { email: unknown });
    expect(a.status).toBe(202);
    expect(b.status).toBe(202);
    expect(a.body).toEqual(b.body);
    expect(await mailpit.messagesTo(email)).toHaveLength(1);
    expect(await mailpit.messagesTo(unknown)).toHaveLength(0);
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
    await browser.post('/auth/password-reset/request', { email });
    const [newest, older] = await resetTokens(email);
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
