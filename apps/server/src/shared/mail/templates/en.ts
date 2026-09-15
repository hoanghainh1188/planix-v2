import type { MailTemplates } from './render.ts';

export const en: MailTemplates = {
  organizationInvitation: ({ organizationName, acceptUrl }) => ({
    subject: `You're invited to join ${organizationName} on Planix`,
    text: [
      `You have been invited to join ${organizationName} on Planix.`,
      '',
      `Accept the invitation: ${acceptUrl}`,
      '',
      'The link is valid for 7 days and can be used once.',
    ].join('\n'),
  }),
  passwordReset: ({ resetUrl }) => ({
    subject: 'Reset your Planix password',
    text: [
      'A password reset was requested for your Planix account.',
      '',
      `Choose a new password: ${resetUrl}`,
      '',
      'The link expires in 1 hour and can be used once. If you did not request it, ignore this email.',
    ].join('\n'),
  }),
};
