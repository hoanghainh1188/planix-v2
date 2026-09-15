import nodemailer, { type Transporter } from 'nodemailer';
import type { MailMessage, MailSender } from './mail-sender.ts';
import { renderMail } from './templates/render.ts';

export interface SmtpTimeouts {
  readonly connectionMs: number;
  readonly greetingMs: number;
  readonly socketMs: number;
}

/** Bounded so a hung mail server fails a send in seconds, not minutes (nodemailer defaults: 2 min / 30 s / 10 min). */
export const DEFAULT_SMTP_TIMEOUTS: SmtpTimeouts = { connectionMs: 10_000, greetingMs: 10_000, socketMs: 20_000 };

export interface SmtpConfig {
  readonly smtpUrl: string;
  readonly from: string;
  readonly timeouts?: SmtpTimeouts;
}

/** SMTP adapter (Mailpit in dev/test). Email bodies are never logged: they contain one-time links. */
export class SmtpMailSender implements MailSender {
  readonly #transport: Transporter;

  constructor(private readonly config: SmtpConfig) {
    const timeouts = config.timeouts ?? DEFAULT_SMTP_TIMEOUTS;
    this.#transport = nodemailer.createTransport({
      url: config.smtpUrl,
      connectionTimeout: timeouts.connectionMs,
      greetingTimeout: timeouts.greetingMs,
      socketTimeout: timeouts.socketMs,
    });
  }

  async send(to: string, message: MailMessage): Promise<void> {
    const { subject, text } = renderMail(message);
    await this.#transport.sendMail({ from: this.config.from, to, subject, text });
  }

  close(): Promise<void> {
    this.#transport.close();
    return Promise.resolve();
  }
}
