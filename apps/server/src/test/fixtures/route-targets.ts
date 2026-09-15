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

export const ROUTE_TARGETS: Readonly<Record<string, RouteTarget>> = {};
