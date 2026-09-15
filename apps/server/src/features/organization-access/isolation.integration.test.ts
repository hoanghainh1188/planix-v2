import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PERMISSION_MATRIX } from '@planix/core/features/organization-access/permission-matrix.ts';
import { useTestDatabase } from '../../test/postgres.ts';
import { RecordingMailSender } from '../../test/recording-mail-sender.ts';
import { ROUTE_TARGETS } from '../../test/fixtures/route-targets.ts';
import {
  seedTwoOrganizations,
  tenantRowCounts,
  type OrganizationFixture,
  type TwoOrganizations,
} from '../../test/fixtures/two-organizations.ts';
import type { SignedInMember } from '../../test/signed-in-member.ts';
import { organizationRoutes, sendToRoute, type OrganizationRoute } from '../../test/organization-routes.ts';
import { createTestApp } from '../../test/test-app.ts';

const db = useTestDatabase();
let app: INestApplication;
let orgs: TwoOrganizations;
let routes: OrganizationRoute[];

beforeAll(async () => {
  app = await createTestApp({ database: db, mailSender: new RecordingMailSender() });
  orgs = await seedTwoOrganizations(app, db);
  routes = organizationRoutes(app);
});

afterAll(() => app.close());

/** A caller of the attacking organization who holds a role allowed to perform the route's action. */
function attackerFor(route: OrganizationRoute, attacker: OrganizationFixture): SignedInMember {
  const roles: readonly string[] = PERMISSION_MATRIX[route.action].roles;
  return roles.includes('admin') ? attacker.admin : attacker.projectManager;
}

const send = sendToRoute;

const randomParams = (route: OrganizationRoute) =>
  Object.fromEntries([...route.path.matchAll(/:(\w+)/g)].map(([, name]) => [name!, randomUUID()]));

const bodyOf = (response: Response) => ({ status: response.status, body: response.body as unknown });

describe('organization isolation on every organization route (FR-001–003, SC-001, Q3)', () => {
  it('finds the organization routes', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it('has an isolation target for every organization route', () => {
    const unmapped = routes.filter((route) => ROUTE_TARGETS[route.key] === undefined).map((route) => route.key);
    expect(unmapped, 'add these routes to src/test/fixtures/route-targets.ts').toEqual([]);
  });

  it('never reads or writes another organization through any organization route', async () => {
    const betaBefore = await tenantRowCounts(db, orgs.beta.organizationId);
    for (const [attackerOrg, victim] of [
      [orgs.acme, orgs.beta],
      [orgs.beta, orgs.acme],
    ] as const) {
      for (const route of routes) {
        const target = ROUTE_TARGETS[route.key];
        if (target === undefined) continue;
        const caller = attackerFor(route, attackerOrg);
        const victimIds = [victim.organizationId, victim.invitationId, victim.memberMembershipId, victim.projectId];

        if (target.kind === 'item') {
          const aimed = await send(caller, route, target.params(victim), target.body);
          const random = await send(caller, route, randomParams(route), target.body);
          expect(bodyOf(aimed), `${route.key} aimed at ${victim.name}`).toEqual({
            status: 404,
            body: { error: { code: 'RESOURCE_NOT_FOUND', params: {} } },
          });
          expect(bodyOf(aimed), `${route.key}: same answer as a random id`).toEqual(bodyOf(random));
        } else if (target.kind === 'list') {
          const response = await send(caller, route, {});
          expect(response.status, route.key).toBe(200);
          const text = JSON.stringify(response.body);
          for (const leak of [...victimIds, ...target.leaks(victim)]) {
            expect(text, `${route.key} leaks ${leak}`).not.toContain(leak);
          }
        } else {
          const response = await send(caller, route, {}, target.body(victim));
          expect(response.status, route.key).toBe(target.expectedStatus);
          const text = JSON.stringify(response.body);
          for (const leak of victimIds) expect(text, `${route.key} leaks ${leak}`).not.toContain(leak);
        }
      }
      if (victim === orgs.beta) {
        expect(await tenantRowCounts(db, orgs.beta.organizationId), 'Beta rows changed').toEqual(betaBefore);
      }
    }
  });
});
