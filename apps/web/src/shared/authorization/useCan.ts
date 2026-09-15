import { decide } from '@planix/core/features/organization-access/decide.ts';
import { PERMISSION_MATRIX, type Action } from '@planix/core/features/organization-access/permission-matrix.ts';
import type { Target } from '@planix/core/features/organization-access/principal.ts';
import type { RaciRole, SystemRole } from '@planix/core/features/organization-access/roles.ts';
import { useSession } from '../../app/session-context.tsx';

export interface UiAuthorizationContext {
  readonly roles: ReadonlySet<SystemRole>;
  readonly membershipStatus: 'active' | 'deactivated';
  /** For project actions: whether the caller is an active member of the project shown. */
  readonly projectMembership?: 'active' | 'none';
  readonly raciRoles?: ReadonlySet<RaciRole>;
}

/**
 * Same decision as the server (core decide + matrix), used only to HIDE actions the caller cannot perform. The
 * server remains the authority: a hidden button changes nothing about what the API allows (FR-022).
 */
export function canInUi(action: Action, context: UiAuthorizationContext): boolean {
  const target: Target =
    PERMISSION_MATRIX[action].scope === 'project'
      ? {
          kind: 'project',
          projectId: '',
          projectMembership: context.projectMembership ?? 'none',
          raciRoles: context.raciRoles ?? new Set(),
        }
      : { kind: 'organization' };
  const principal = {
    userId: '',
    organizationId: '',
    membershipStatus: context.membershipStatus,
    roles: context.roles,
  };
  return decide(principal, action, target).allowed;
}

/** Whether the signed-in user may perform `action` in the active organization (and, for project actions, project). */
export function useCan(
  action: Action,
  project?: { readonly membership: 'active' | 'none'; readonly raciRoles?: ReadonlySet<RaciRole> },
): boolean {
  const { session } = useSession();
  const membership = session?.memberships.find((m) => m.organizationId === session.activeOrganizationId);
  if (membership === undefined) return false;
  return canInUi(action, {
    roles: new Set(membership.roles as SystemRole[]),
    membershipStatus: membership.status,
    ...(project === undefined
      ? {}
      : { projectMembership: project.membership, ...(project.raciRoles ? { raciRoles: project.raciRoles } : {}) }),
  });
}
