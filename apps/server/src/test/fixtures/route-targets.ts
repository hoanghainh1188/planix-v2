import type { OrganizationFixture } from './two-organizations.ts';

/**
 * How the isolation test attacks each organization route (T089). Every route declared with @RequireAction MUST
 * have an entry here — a new route without one makes the isolation test fail.
 * - `item`: route params point at the victim organization's object → expect 404 identical to a random id
 * - `list`: response must not contain any of the victim's ids or emails
 * - `create`: request built from the victim's data must not reveal or touch the victim (expected status given)
 */
export type RouteTarget =
  | {
      readonly kind: 'item';
      readonly params: (victim: OrganizationFixture) => Readonly<Record<string, string>>;
      readonly body?: object;
    }
  | { readonly kind: 'list'; readonly leaks: (victim: OrganizationFixture) => readonly string[] }
  | {
      readonly kind: 'create';
      readonly body: (victim: OrganizationFixture) => object;
      readonly expectedStatus: number;
    };

export const ROUTE_TARGETS: Readonly<Record<string, RouteTarget>> = {
  'GET /org/invitations': { kind: 'list', leaks: (victim) => [victim.invitationEmail] },
  'POST /org/invitations': {
    kind: 'create',
    // The victim's member is not a member here: the invitation is created, revealing nothing about the victim.
    body: (victim) => ({ email: victim.memberEmail }),
    expectedStatus: 201,
  },
  'DELETE /org/invitations/:invitationId': {
    kind: 'item',
    params: (victim) => ({ invitationId: victim.invitationId }),
  },
  'GET /org/members': { kind: 'list', leaks: (victim) => [victim.memberEmail, victim.admin.email] },
  'PUT /org/members/:membershipId/roles': {
    kind: 'item',
    params: (victim) => ({ membershipId: victim.memberMembershipId }),
    body: { roles: ['admin'] },
  },
  'POST /org/members/:membershipId/deactivate': {
    kind: 'item',
    params: (victim) => ({ membershipId: victim.memberMembershipId }),
  },
  'POST /org/members/:membershipId/reactivate': {
    kind: 'item',
    params: (victim) => ({ membershipId: victim.memberMembershipId }),
  },
  'GET /projects': { kind: 'list', leaks: (victim) => [victim.projectMemberId, victim.projectManager.email] },
  'POST /projects': {
    kind: 'create',
    // A project created by the attacker must not reference the victim in any way.
    body: () => ({ name: 'Isolation probe' }),
    expectedStatus: 201,
  },
  'GET /projects/:projectId': { kind: 'item', params: (victim) => ({ projectId: victim.projectId }) },
  'GET /projects/:projectId/members': { kind: 'item', params: (victim) => ({ projectId: victim.projectId }) },
  'POST /projects/:projectId/members': {
    kind: 'item',
    params: (victim) => ({ projectId: victim.projectId }),
    body: { membershipId: '00000000-0000-4000-8000-000000000000' },
  },
  'DELETE /projects/:projectId/members/:projectMemberId': {
    kind: 'item',
    params: (victim) => ({ projectId: victim.projectId, projectMemberId: victim.projectMemberId }),
  },
};
