import type { INestApplication } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import type { Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PERMISSION_MATRIX } from '@planix/core/features/organization-access/permission-matrix.ts';
import { REQUIRED_ACTION, type RequiredAction } from '../../shared/authorization/require-action.decorator.ts';
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
import { createTestApp } from '../../test/test-app.ts';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', 'OPTIONS', 'HEAD', 'SEARCH'];

interface OrganizationRoute {
  readonly key: string;
  readonly method: string;
  readonly path: string;
  readonly action: RequiredAction['action'];
}

/** Every route declared with @RequireAction, discovered from the running application (not a hand-kept list). */
function organizationRoutes(app: INestApplication): OrganizationRoute[] {
  const discovery = app.get(DiscoveryService);
  const scanner = app.get(MetadataScanner);
  const reflector = app.get(Reflector);
  const routes: OrganizationRoute[] = [];
  for (const wrapper of discovery.getControllers()) {
    const controller = wrapper.metatype as (abstract new (...args: never[]) => unknown) | null;
    const instance = wrapper.instance as object | undefined;
    if (!controller || !instance) continue;
    const prototype = Object.getPrototypeOf(instance) as Record<string, unknown>;
    const base = String(reflector.get<string | undefined>(PATH_METADATA, controller) ?? '');
    for (const name of scanner.getAllMethodNames(prototype)) {
      const handler = prototype[name] as (...args: unknown[]) => unknown;
      const path = reflector.get<string | undefined>(PATH_METADATA, handler);
      const required = reflector.get<RequiredAction | undefined>(REQUIRED_ACTION, handler);
      if (path === undefined || required === undefined) continue;
      const method = HTTP_METHODS[reflector.get<number>(METHOD_METADATA, handler)] ?? '?';
      const fullPath = `/${[base, path].filter((p) => p && p !== '/').join('/')}`.replace(/\/+/g, '/');
      routes.push({ key: `${method} ${fullPath}`, method, path: fullPath, action: required.action });
    }
  }
  return routes.sort((a, b) => a.key.localeCompare(b.key));
}

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

function send(
  member: SignedInMember,
  route: OrganizationRoute,
  params: Readonly<Record<string, string>>,
  body?: object,
) {
  const path = route.path.replace(/:(\w+)/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`${route.key}: no value for :${name}`);
    return encodeURIComponent(value);
  });
  switch (route.method) {
    case 'GET':
      return member.browser.get(path);
    case 'POST':
      return member.browser.post(path, body);
    case 'PUT':
      return member.browser.put(path, body);
    case 'DELETE':
      return member.browser.delete(path);
    default:
      throw new Error(`${route.key}: unsupported method in isolation test`);
  }
}

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
