import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { PUBLIC_ROUTE, SESSION_ONLY } from '../auth/route-scope.decorators.ts';
import { PLATFORM_ACTION } from './platform-action.decorator.ts';
import { REQUIRED_ACTION } from './require-action.decorator.ts';

const DECLARATIONS = [REQUIRED_ACTION, PLATFORM_ACTION, PUBLIC_ROUTE, SESSION_ONLY];
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', 'OPTIONS', 'HEAD', 'SEARCH'];

/** Fails application start-up when any route lacks an access declaration (FR-024, research R5). */
@Injectable()
export class RouteActionCoverage implements OnApplicationBootstrap {
  constructor(
    @Inject(DiscoveryService) private readonly discovery: DiscoveryService,
    @Inject(MetadataScanner) private readonly scanner: MetadataScanner,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  onApplicationBootstrap(): void {
    const undeclared: string[] = [];
    for (const wrapper of this.discovery.getControllers()) {
      const controller = wrapper.metatype as (abstract new (...args: never[]) => unknown) | null;
      const instance = wrapper.instance as object | undefined;
      if (!controller || !instance) continue;
      const prototype = Object.getPrototypeOf(instance) as Record<string, unknown>;
      const base = String(this.reflector.get<string | undefined>(PATH_METADATA, controller) ?? '');
      for (const name of this.scanner.getAllMethodNames(prototype)) {
        const handler = prototype[name] as (...args: unknown[]) => unknown;
        const path = this.reflector.get<string | undefined>(PATH_METADATA, handler);
        if (path === undefined) continue;
        const declared = DECLARATIONS.some(
          (key) => this.reflector.get(key, handler) !== undefined || this.reflector.get(key, controller) !== undefined,
        );
        if (!declared) {
          const method = HTTP_METHODS[this.reflector.get<number>(METHOD_METADATA, handler)] ?? '?';
          undeclared.push(`${method} /${[base, path].filter((p) => p && p !== '/').join('/')}`.replace(/\/+/g, '/'));
        }
      }
    }
    if (undeclared.length > 0) {
      throw new Error(
        `Routes without an access declaration (RequireAction/PlatformAction/Public/SessionOnly): ${undeclared.join(', ')}`,
      );
    }
  }
}
