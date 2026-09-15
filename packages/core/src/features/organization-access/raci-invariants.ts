import { RACI_ROLES, type RaciRole } from './roles.ts';

/** RACI roles that PUT …/raci may set; Accountable changes only through the one-step transfer (contracts/api.md). */
export const ASSIGNABLE_RACI_ROLES = ['responsible', 'consulted', 'informed'] as const;
export type AssignableRaciRole = (typeof ASSIGNABLE_RACI_ROLES)[number];

/**
 * Replaces a project member's responsible/consulted/informed roles (FR-020). A member may hold several RACI roles;
 * the Accountable role is kept as it is and can never be granted or removed here.
 */
export function replaceRaciRoles(
  current: ReadonlySet<RaciRole>,
  requested: readonly RaciRole[],
):
  | { readonly ok: true; readonly raciRoles: readonly RaciRole[] }
  | { readonly ok: false; readonly code: 'VALIDATION_FAILED' } {
  if (requested.includes('accountable')) return { ok: false, code: 'VALIDATION_FAILED' };
  const wanted = new Set<RaciRole>(requested);
  if (current.has('accountable')) wanted.add('accountable');
  return { ok: true, raciRoles: RACI_ROLES.filter((role) => wanted.has(role)) };
}

/** One-step replacement of the Accountable by an active project member (decision single-accountable-per-project). */
export function planAccountableTransfer(
  project: { readonly accountableProjectMemberId: string },
  candidate: { readonly projectMemberId: string; readonly status: 'active' | 'removed' | 'none' },
):
  | {
      readonly ok: true;
      readonly previousProjectMemberId: string;
      readonly currentProjectMemberId: string;
      readonly changed: boolean;
    }
  | { readonly ok: false; readonly code: 'NOT_PROJECT_MEMBER' } {
  if (candidate.status !== 'active') return { ok: false, code: 'NOT_PROJECT_MEMBER' };
  return {
    ok: true,
    previousProjectMemberId: project.accountableProjectMemberId,
    currentProjectMemberId: candidate.projectMemberId,
    changed: project.accountableProjectMemberId !== candidate.projectMemberId,
  };
}

/** A project is valid only with exactly one accountable assignment. */
export function hasExactlyOneAccountable(assignments: ReadonlyArray<{ readonly raciRole: RaciRole }>): boolean {
  return assignments.filter((assignment) => assignment.raciRole === 'accountable').length === 1;
}
