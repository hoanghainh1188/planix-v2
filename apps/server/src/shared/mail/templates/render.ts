import type { MailMessage } from '../mail-sender.ts';
import { en } from './en.ts';
import { vi } from './vi.ts';

export interface RenderedMail {
  readonly subject: string;
  readonly text: string;
}

type PayloadOf<K extends MailMessage['kind']> = Omit<Extract<MailMessage, { kind: K }>, 'kind' | 'locale'>;

export type MailTemplates = {
  readonly [K in MailMessage['kind']]: (payload: PayloadOf<K>) => RenderedMail;
};

const TEMPLATES = { vi, en } as const;

export function renderMail(message: MailMessage): RenderedMail {
  const templates = TEMPLATES[message.locale];
  switch (message.kind) {
    case 'organizationInvitation':
      return templates.organizationInvitation(message);
    case 'passwordReset':
      return templates.passwordReset(message);
  }
}
