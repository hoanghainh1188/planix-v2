import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import type { z } from 'zod';
import { unsupportedSchemaPaths } from '@planix/core/shared/sensitive-field/sensitive-field.ts';
import { REQUEST_SCHEMA, RESPONSE_SCHEMA } from './sensitive-field.decorators.ts';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', 'OPTIONS', 'HEAD', 'SEARCH'];

/**
 * Fails application start-up when a @RequestSchema/@ResponseSchema contains a node the sensitive-field mechanism
 * cannot inspect (lazy, intersection, tuple, map…): a sensitive field inside it would escape stripping and write
 * checks silently (security review, Phase 9).
 */
@Injectable()
export class SensitiveSchemaCoverage implements OnApplicationBootstrap {
  constructor(
    @Inject(DiscoveryService) private readonly discovery: DiscoveryService,
    @Inject(MetadataScanner) private readonly scanner: MetadataScanner,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  onApplicationBootstrap(): void {
    const problems: string[] = [];
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
        const method = HTTP_METHODS[this.reflector.get<number>(METHOD_METADATA, handler)] ?? '?';
        const route = `${method} /${[base, path].filter((p) => p && p !== '/').join('/')}`.replace(/\/+/g, '/');
        for (const key of [RESPONSE_SCHEMA, REQUEST_SCHEMA]) {
          const schema = this.reflector.get<z.ZodType | undefined>(key, handler);
          if (schema === undefined) continue;
          for (const node of unsupportedSchemaPaths(schema)) problems.push(`${route}: ${node}`);
        }
      }
    }
    if (problems.length > 0) {
      throw new Error(`Sensitive-field schemas contain nodes that cannot be inspected: ${problems.join('; ')}`);
    }
  }
}
