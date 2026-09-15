import type { MailMessage, MailSender } from '../shared/mail/mail-sender.ts';

/** In-memory MailSender for integration tests that only need the sent links. */
export class RecordingMailSender implements MailSender {
  readonly sent: Array<{ to: string; message: MailMessage }> = [];

  send(to: string, message: MailMessage): Promise<void> {
    this.sent.push({ to, message });
    return Promise.resolve();
  }

  lastTo(to: string): MailMessage | undefined {
    return this.sent.filter((m) => m.to.toLowerCase() === to.toLowerCase()).at(-1)?.message;
  }
}
