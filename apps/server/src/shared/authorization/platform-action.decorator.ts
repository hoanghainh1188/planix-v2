import { SetMetadata } from '@nestjs/common';

export const PLATFORM_ACTIONS = [
  'platform.organization.create',
  'platform.organization.list',
  'platform.organization.update-status',
  'platform.invitation.admin.create',
  'platform.invitation.admin.resend',
  'platform.invitation.admin.revoke',
] as const;
export type PlatformActionName = (typeof PLATFORM_ACTIONS)[number];

export const PLATFORM_ACTION = 'planix:platform-action';

/** Declares a /platform/* route; allowed only for platform operators, never with a tenant context (R11). */
export const PlatformAction = (action: PlatformActionName) => SetMetadata(PLATFORM_ACTION, action);
