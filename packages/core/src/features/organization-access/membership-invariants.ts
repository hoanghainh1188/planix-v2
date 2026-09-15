import type { RaciRole, SystemRole } from './roles.ts';
import { SYSTEM_ROLES } from './roles.ts';

/** Active admins of the organization, read under lock by the caller (data-model §membership_role). */
export interface OrganizationAdmins {
  readonly activeAdminMembershipIds: ReadonlySet<string>;
}

export interface MembershipState {
  readonly membershipId: string;
  readonly status: 'active' | 'deactivated';
}

export type InvariantViolation =
  | { readonly ok: false; readonly code: 'VALIDATION_FAILED' | 'LAST_ADMIN_REQUIRED' | 'MEMBERSHIP_NOT_DEACTIVATED' }
  | { readonly ok: false; readonly code: 'ACCOUNTABLE_REQUIRED'; readonly projectIds: readonly string[] };

/** Roles in the canonical SYSTEM_ROLES order, without duplicates. */
export function normalizeRoles(roles: readonly SystemRole[]): SystemRole[] {
  const wanted = new Set(roles);
  return SYSTEM_ROLES.filter((role) => wanted.has(role));
}

/** Would removing admin from (or deactivating) this membership leave the organization without an active admin? */
function isLastAdmin(admins: OrganizationAdmins, membershipId: string): boolean {
  return admins.activeAdminMembershipIds.has(membershipId) && admins.activeAdminMembershipIds.size === 1;
}

/** Replacing a membership's system roles (FR-012, FR-014): at least one role, never removing the last admin. */
export function checkRoleChange(
  admins: OrganizationAdmins,
  membership: MembershipState,
  roles: readonly SystemRole[],
): { readonly ok: true; readonly roles: readonly SystemRole[] } | InvariantViolation {
  const normalized = normalizeRoles(roles);
  if (normalized.length === 0) return { ok: false, code: 'VALIDATION_FAILED' };
  if (!normalized.includes('admin') && isLastAdmin(admins, membership.membershipId)) {
    return { ok: false, code: 'LAST_ADMIN_REQUIRED' };
  }
  return { ok: true, roles: normalized };
}

/** Membership deactivation (FR-014, FR-015, FR-020): not the last admin, not Accountable of any project. */
export function checkDeactivation(
  admins: OrganizationAdmins,
  membership: MembershipState,
  accountableProjectIds: readonly string[],
): { readonly ok: true } | InvariantViolation {
  if (isLastAdmin(admins, membership.membershipId)) return { ok: false, code: 'LAST_ADMIN_REQUIRED' };
  if (accountableProjectIds.length > 0) {
    return { ok: false, code: 'ACCOUNTABLE_REQUIRED', projectIds: [...new Set(accountableProjectIds)].sort() };
  }
  return { ok: true };
}

/** Membership reactivation (decision member-reactivation): back to `member` only, no projects or RACI. */
export function planReactivation(membership: MembershipState):
  | {
      readonly ok: true;
      readonly roles: readonly SystemRole[];
      readonly projectMemberships: readonly string[];
      readonly raciRoles: readonly RaciRole[];
    }
  | InvariantViolation {
  if (membership.status !== 'deactivated') return { ok: false, code: 'MEMBERSHIP_NOT_DEACTIVATED' };
  return { ok: true, roles: ['member'], projectMemberships: [], raciRoles: [] };
}
