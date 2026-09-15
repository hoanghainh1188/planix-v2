import type { InvariantViolation } from './membership-invariants.ts';
import type { RaciRole } from './roles.ts';

export interface ProjectMemberState {
  readonly projectId: string;
  readonly raciRoles: ReadonlySet<RaciRole>;
}

/**
 * Removing a project member (FR-019, FR-020): the project always keeps exactly one Accountable, so the Accountable
 * must be replaced first (decision single-accountable-per-project).
 */
export function checkProjectMemberRemoval(member: ProjectMemberState): { readonly ok: true } | InvariantViolation {
  if (member.raciRoles.has('accountable')) {
    return { ok: false, code: 'ACCOUNTABLE_REQUIRED', projectIds: [member.projectId] };
  }
  return { ok: true };
}
