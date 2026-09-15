import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TestMailpit } from '../../test/mailpit.ts';
import { SmtpMailSender } from './smtp-mail-sender.ts';
import { renderMail } from './templates/render.ts';

let mailpit: TestMailpit;
let sender: SmtpMailSender;

beforeAll(async () => {
  mailpit = await TestMailpit.start();
  sender = new SmtpMailSender({ smtpUrl: mailpit.smtpUrl, from: 'Planix <no-reply@planix.test>' });
});

afterAll(async () => {
  await sender.close();
  await mailpit.stop();
});

describe('mail templates (R10, FR-029)', () => {
  it.each([
    ['vi', 'Lời mời tham gia Acme trên Planix'],
    ['en', "You're invited to join Acme on Planix"],
  ] as const)('renders the invitation in %s', (locale, subject) => {
    const mail = renderMail({
      kind: 'organizationInvitation',
      locale,
      organizationName: 'Acme',
      acceptUrl: 'https://app.planix.test/invitations/tok',
    });
    expect(mail.subject).toBe(subject);
    expect(mail.text).toContain('https://app.planix.test/invitations/tok');
  });

  it.each([
    ['vi', 'Đặt lại mật khẩu Planix'],
    ['en', 'Reset your Planix password'],
  ] as const)('renders the password reset in %s', (locale, subject) => {
    const mail = renderMail({ kind: 'passwordReset', locale, resetUrl: 'https://app.planix.test/reset/tok' });
    expect(mail.subject).toBe(subject);
    expect(mail.text).toContain('https://app.planix.test/reset/tok');
    expect(mail.text).toMatch(/1 (giờ|hour)/);
  });
});

describe('SmtpMailSender', () => {
  it('delivers a rendered email over SMTP', async () => {
    await sender.send('invitee@acme.test', {
      kind: 'organizationInvitation',
      locale: 'en',
      organizationName: 'Acme',
      acceptUrl: 'https://app.planix.test/invitations/abc',
    });
    const [message] = await mailpit.messagesTo('invitee@acme.test');
    expect(message?.Subject).toBe("You're invited to join Acme on Planix");
    expect(await mailpit.text(message!.ID)).toContain('https://app.planix.test/invitations/abc');
  });
});
