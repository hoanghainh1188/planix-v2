import nodemailer, { type Transporter } from 'nodemailer';
import type { MailMessage, MailSender } from './mail-sender.ts';
import { renderMail } from './templates/render.ts';

export interface SmtpConfig {
  readonly smtpUrl: string;
  readonly from: string;
}

/** SMTP adapter (Mailpit in dev/test). Email bodies are never logged: they contain one-time links. */
export class SmtpMailSender implements MailSender {
  readonly #transport: Transporter;

  constructor(private readonly config: SmtpConfig) {
    this.#transport = nodemailer.createTransport(config.smtpUrl);
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
