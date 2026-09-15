import { PERMISSION_MATRIX, type Action, type PermissionEntry, type PermissionMatrix } from './permission-matrix.ts';
import type { Decision, Principal, Target } from './principal.ts';

const deny = (reason: Extract<Decision, { allowed: false }>['reason']): Decision => ({ allowed: false, reason });

/**
 * Pure two-layer authorization decision (FR-022, FR-023): system role AND project membership / RACI.
 * Default deny; no special case for any role (FR-016).
 */
export function decide(
  principal: Principal,
  action: Action,
  target: Target,
  matrix: PermissionMatrix = PERMISSION_MATRIX,
): Decision {
  if (principal.membershipStatus !== 'active') return deny('MEMBERSHIP_INACTIVE');

  const entry = (matrix as Readonly<Record<string, PermissionEntry | undefined>>)[action];
  if (entry === undefined) return deny('ACTION_NOT_DECLARED');

  if (!entry.roles.some((role) => principal.roles.has(role))) return deny('ROLE_NOT_PERMITTED');

  if (entry.scope === 'project') {
    if (target.kind !== 'project' || target.projectMembership !== 'active') return deny('NOT_PROJECT_MEMBER');
    const required = entry.requiresRaci ?? [];
    if (required.length > 0 && !required.some((role) => target.raciRoles.has(role))) {
      return deny('RACI_ROLE_REQUIRED');
    }
  }

  return { allowed: true };
}
