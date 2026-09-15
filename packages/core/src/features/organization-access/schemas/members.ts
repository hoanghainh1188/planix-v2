import { z } from 'zod';
import { SYSTEM_ROLES } from '../roles.ts';

/** Request contracts for organization members and invitations (contracts/api.md §Lời mời, §Thành viên tổ chức). */
export const SystemRoleSchema = z.enum(SYSTEM_ROLES);

const roles = z
  .array(SystemRoleSchema)
  .min(1)
  .max(SYSTEM_ROLES.length * 2);

export const CreateInvitationRequest = z.object({ email: z.email().max(254), roles: roles.optional() });
export type CreateInvitationRequest = z.infer<typeof CreateInvitationRequest>;

export const INVITATION_STATUSES = ['pending', 'accepted', 'revoked', 'expired'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];
export const InvitationStatusFilter = z.enum(INVITATION_STATUSES).optional();

export const AssignRolesRequest = z.object({ roles });
export type AssignRolesRequest = z.infer<typeof AssignRolesRequest>;

export const MEMBERSHIP_STATUSES = ['active', 'deactivated'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];
export const MembershipStatusFilter = z.enum(MEMBERSHIP_STATUSES).optional();

export interface InvitationView {
  readonly id: string;
  readonly email: string;
  readonly roles: readonly string[];
  readonly status: InvitationStatus;
  readonly expiresAt: string;
  readonly invitedBy: { readonly userId: string; readonly kind: 'organizationAdmin' | 'platformOperator' };
}

export interface MemberView {
  readonly membershipId: string;
  readonly userId: string;
  readonly email: string;
  readonly status: MembershipStatus;
  readonly roles: readonly string[];
}
