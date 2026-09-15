import { describe, expect, it } from 'vitest';
import {
  checkDeactivation,
  checkRoleChange,
  planReactivation,
  type OrganizationAdmins,
} from './membership-invariants.ts';

const admins = (...membershipIds: string[]): OrganizationAdmins => ({
  activeAdminMembershipIds: new Set(membershipIds),
});

describe('role change invariants (FR-012, FR-014)', () => {
  it('allows replacing roles with a non-empty set', () => {
    expect(
      checkRoleChange(admins('a1'), { membershipId: 'm2', status: 'active' }, ['projectManager', 'finance']),
    ).toEqual({ ok: true, roles: ['projectManager', 'finance'] });
  });

  it('rejects an empty role set', () => {
    expect(checkRoleChange(admins('a1'), { membershipId: 'm2', status: 'active' }, [])).toEqual({
      ok: false,
      code: 'VALIDATION_FAILED',
    });
  });

  it('removes duplicate roles', () => {
    expect(checkRoleChange(admins('a1'), { membershipId: 'm2', status: 'active' }, ['member', 'member'])).toEqual({
      ok: true,
      roles: ['member'],
    });
  });

  it('rejects removing admin from the last active admin', () => {
    expect(checkRoleChange(admins('a1'), { membershipId: 'a1', status: 'active' }, ['member'])).toEqual({
      ok: false,
      code: 'LAST_ADMIN_REQUIRED',
    });
  });

  it('allows removing admin when another active admin remains', () => {
    expect(checkRoleChange(admins('a1', 'a2'), { membershipId: 'a1', status: 'active' }, ['member'])).toEqual({
      ok: true,
      roles: ['member'],
    });
  });

  it('keeps admin on the last admin when admin stays in the new set', () => {
    expect(checkRoleChange(admins('a1'), { membershipId: 'a1', status: 'active' }, ['admin', 'finance']).ok).toBe(true);
  });
});

describe('deactivation invariants (FR-014, FR-015, FR-020)', () => {
  it('allows deactivating a member who is neither the last admin nor Accountable', () => {
    expect(checkDeactivation(admins('a1'), { membershipId: 'm2', status: 'active' }, [])).toEqual({ ok: true });
  });

  it('rejects deactivating the last active admin', () => {
    expect(checkDeactivation(admins('a1'), { membershipId: 'a1', status: 'active' }, [])).toEqual({
      ok: false,
      code: 'LAST_ADMIN_REQUIRED',
    });
  });

  it('rejects deactivating an Accountable and names the projects', () => {
    expect(checkDeactivation(admins('a1'), { membershipId: 'm2', status: 'active' }, ['p2', 'p1'])).toEqual({
      ok: false,
      code: 'ACCOUNTABLE_REQUIRED',
      projectIds: ['p1', 'p2'],
    });
  });

  it('checks the last admin rule before the Accountable rule', () => {
    expect(checkDeactivation(admins('a1'), { membershipId: 'a1', status: 'active' }, ['p1'])).toMatchObject({
      code: 'LAST_ADMIN_REQUIRED',
    });
  });
});

describe('reactivation (decision member-reactivation)', () => {
  it('restores only the member role, with no project membership or RACI', () => {
    expect(planReactivation({ membershipId: 'm2', status: 'deactivated' })).toEqual({
      ok: true,
      roles: ['member'],
      projectMemberships: [],
      raciRoles: [],
    });
  });

  it('rejects reactivating an active membership', () => {
    expect(planReactivation({ membershipId: 'm2', status: 'active' })).toEqual({
      ok: false,
      code: 'MEMBERSHIP_NOT_DEACTIVATED',
    });
  });
});
