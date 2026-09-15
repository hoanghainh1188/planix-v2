import { describe, expect, it } from 'vitest';
import { decide } from './decide.ts';
import { ACTIONS, PERMISSION_MATRIX, type Action, type PermissionMatrix } from './permission-matrix.ts';
import type { Principal, Target } from './principal.ts';
import { RACI_ROLES, SYSTEM_ROLES, type RaciRole, type SystemRole } from './roles.ts';

function subsets<T>(items: readonly T[]): T[][] {
  return Array.from({ length: 2 ** items.length }, (_, mask) => items.filter((_, i) => (mask >> i) & 1));
}

const principal = (roles: SystemRole[], membershipStatus: Principal['membershipStatus'] = 'active'): Principal => ({
  userId: 'user-1',
  organizationId: 'org-1',
  membershipStatus,
  roles: new Set(roles),
});

const projectTarget = (projectMembership: 'active' | 'none', raciRoles: RaciRole[] = []): Target => ({
  kind: 'project',
  projectId: 'project-1',
  projectMembership,
  raciRoles: new Set(raciRoles),
});

const ORG_TARGET: Target = { kind: 'organization' };

/** Independent oracle of contracts/authorization.md §2 evaluation order. */
function expected(p: Principal, action: string, target: Target, matrix: PermissionMatrix): ReturnType<typeof decide> {
  if (p.membershipStatus !== 'active') return { allowed: false, reason: 'MEMBERSHIP_INACTIVE' };
  const entry = (matrix as Record<string, PermissionMatrix[Action] | undefined>)[action];
  if (entry === undefined) return { allowed: false, reason: 'ACTION_NOT_DECLARED' };
  if (![...p.roles].some((r) => entry.roles.includes(r))) return { allowed: false, reason: 'ROLE_NOT_PERMITTED' };
  if (entry.scope === 'project') {
    if (target.kind !== 'project' || target.projectMembership !== 'active') {
      return { allowed: false, reason: 'NOT_PROJECT_MEMBER' };
    }
    const required = entry.requiresRaci ?? [];
    if (required.length > 0 && !required.some((r) => target.raciRoles.has(r))) {
      return { allowed: false, reason: 'RACI_ROLE_REQUIRED' };
    }
  }
  return { allowed: true };
}

describe('decide() full decision table (FR-012, FR-016, FR-022, FR-023, SC-002)', () => {
  const targets: Target[] = [
    ORG_TARGET,
    ...(['active', 'none'] as const).flatMap((m) => subsets(RACI_ROLES).map((raci) => projectTarget(m, raci))),
  ];

  it('matches the oracle for every action × role subset × membership status × target', () => {
    let cases = 0;
    for (const action of ACTIONS) {
      for (const roles of subsets(SYSTEM_ROLES)) {
        for (const status of ['active', 'deactivated'] as const) {
          for (const target of targets) {
            const p = principal(roles, status);
            expect(
              decide(p, action, target),
              `${action} ${roles.join('+')} ${status} ${JSON.stringify(target)}`,
            ).toEqual(expected(p, action, target, PERMISSION_MATRIX));
            cases++;
          }
        }
      }
    }
    expect(cases).toBe(16 * 64 * 2 * 33);
  });

  it('evaluates MEMBERSHIP_INACTIVE before anything else', () => {
    expect(decide(principal(['admin'], 'deactivated'), 'not.declared' as Action, ORG_TARGET)).toEqual({
      allowed: false,
      reason: 'MEMBERSHIP_INACTIVE',
    });
  });

  it('denies undeclared actions', () => {
    expect(decide(principal([...SYSTEM_ROLES]), 'project.delete' as Action, projectTarget('active'))).toEqual({
      allowed: false,
      reason: 'ACTION_NOT_DECLARED',
    });
  });

  it('uses the union of roles', () => {
    expect(decide(principal(['member']), 'project.create', ORG_TARGET).allowed).toBe(false);
    expect(decide(principal(['member', 'projectManager']), 'project.create', ORG_TARGET).allowed).toBe(true);
  });

  it('gives admin no exception on project data without project membership (FR-016)', () => {
    expect(decide(principal(['admin']), 'project.read', projectTarget('none'))).toEqual({
      allowed: false,
      reason: 'NOT_PROJECT_MEMBER',
    });
  });

  it('requires project membership for project-scope actions even with an organization target', () => {
    expect(decide(principal(['projectManager']), 'project.member.manage', ORG_TARGET)).toEqual({
      allowed: false,
      reason: 'NOT_PROJECT_MEMBER',
    });
  });

  it('enforces requiresRaci when an action declares it', () => {
    const matrix = {
      ...PERMISSION_MATRIX,
      'project.raci.manage': { scope: 'project', roles: ['projectManager'], requiresRaci: ['accountable'] },
    } satisfies PermissionMatrix;
    const pm = principal(['projectManager']);
    expect(decide(pm, 'project.raci.manage', projectTarget('active', ['responsible']), matrix)).toEqual({
      allowed: false,
      reason: 'RACI_ROLE_REQUIRED',
    });
    expect(decide(pm, 'project.raci.manage', projectTarget('active', ['accountable']), matrix)).toEqual({
      allowed: true,
    });
  });
});
