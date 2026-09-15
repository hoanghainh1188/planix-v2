import { describe, expect, it } from 'vitest';
import { ACTIONS, PERMISSION_MATRIX } from '@planix/core/features/organization-access/permission-matrix.ts';
import { SYSTEM_ROLES } from '@planix/core/features/organization-access/roles.ts';
import { canInUi } from './useCan.ts';

describe('useCan matches the core permission matrix (FR-022, T103)', () => {
  it('for every action, single role and project membership', () => {
    for (const action of ACTIONS) {
      const entry = PERMISSION_MATRIX[action];
      for (const role of SYSTEM_ROLES) {
        for (const projectMembership of ['active', 'none'] as const) {
          const roleAllowed = (entry.roles as readonly string[]).includes(role);
          const expected = roleAllowed && (entry.scope === 'org' || projectMembership === 'active');
          expect(
            canInUi(action, { roles: new Set([role]), membershipStatus: 'active', projectMembership }),
            `${action} ${role} ${projectMembership}`,
          ).toBe(expected);
        }
      }
    }
  });

  it('takes the union of several roles', () => {
    expect(
      canInUi('project.create', { roles: new Set(['member', 'projectManager']), membershipStatus: 'active' }),
    ).toBe(true);
  });

  it('allows nothing to a deactivated membership or without roles', () => {
    for (const action of ACTIONS) {
      expect(
        canInUi(action, { roles: new Set(SYSTEM_ROLES), membershipStatus: 'deactivated', projectMembership: 'active' }),
      ).toBe(false);
      expect(canInUi(action, { roles: new Set(), membershipStatus: 'active', projectMembership: 'active' })).toBe(
        false,
      );
    }
  });

  it('treats project actions without project context as not a member', () => {
    expect(canInUi('project.member.manage', { roles: new Set(['projectManager']), membershipStatus: 'active' })).toBe(
      false,
    );
  });
});
