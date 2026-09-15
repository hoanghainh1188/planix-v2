export type MailLocale = 'vi' | 'en';

export type MailMessage =
  | {
      readonly kind: 'organizationInvitation';
      readonly locale: MailLocale;
      readonly organizationName: string;
      readonly acceptUrl: string;
    }
  | { readonly kind: 'passwordReset'; readonly locale: MailLocale; readonly resetUrl: string };

export const MAIL_SENDER = Symbol('MailSender');

/** Outbound email port (research R10). Production provider is chosen with the Deploy section of CLAUDE.md. */
export interface MailSender {
  send(to: string, message: MailMessage): Promise<void>;
}
