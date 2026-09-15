import { describe, expect, it } from 'vitest';
import { checkProjectMemberRemoval } from './project-member-invariants.ts';

describe('project member removal (FR-020, decision single-accountable-per-project)', () => {
  it('allows removing a member who is not the Accountable', () => {
    expect(checkProjectMemberRemoval({ projectId: 'p1', raciRoles: new Set(['responsible', 'informed']) })).toEqual({
      ok: true,
    });
  });

  it('refuses removing the Accountable and names the project', () => {
    expect(checkProjectMemberRemoval({ projectId: 'p1', raciRoles: new Set(['accountable', 'consulted']) })).toEqual({
      ok: false,
      code: 'ACCOUNTABLE_REQUIRED',
      projectIds: ['p1'],
    });
  });
});
