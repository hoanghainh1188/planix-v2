import type { RaciRole, SystemRole } from './roles.ts';

/** Caller identity inside the active organization (contracts/authorization.md §2). */
export interface Principal {
  readonly userId: string;
  readonly organizationId: string;
  readonly membershipStatus: 'active' | 'deactivated';
  readonly roles: ReadonlySet<SystemRole>;
}

export type Target =
  | { readonly kind: 'organization' }
  | {
      readonly kind: 'project';
      readonly projectId: string;
      readonly projectMembership: 'active' | 'none';
      readonly raciRoles: ReadonlySet<RaciRole>;
    };

export type DenyReason =
  'MEMBERSHIP_INACTIVE' | 'ACTION_NOT_DECLARED' | 'ROLE_NOT_PERMITTED' | 'NOT_PROJECT_MEMBER' | 'RACI_ROLE_REQUIRED';

export type Decision = { readonly allowed: true } | { readonly allowed: false; readonly reason: DenyReason };
