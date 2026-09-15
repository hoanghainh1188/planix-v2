import type { INestApplication } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { REQUIRED_ACTION, type RequiredAction } from '../shared/authorization/require-action.decorator.ts';
import type { SignedInMember } from './signed-in-member.ts';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', 'OPTIONS', 'HEAD', 'SEARCH'];

export interface OrganizationRoute {
  readonly key: string;
  readonly method: string;
  readonly path: string;
  readonly action: RequiredAction['action'];
}

/** Every route declared with @RequireAction, discovered from the running application (not a hand-kept list). */
export function organizationRoutes(app: INestApplication): OrganizationRoute[] {
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

/** Sends a request to a discovered route with its `:params` filled in. */
export function sendToRoute(
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
      throw new Error(`${route.key}: unsupported method`);
  }
}
