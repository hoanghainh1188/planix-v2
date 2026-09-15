import { Inject, Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { catchError, map, mergeMap, from, throwError, type Observable } from 'rxjs';
import type { z } from 'zod';
import { decide } from '@planix/core/features/organization-access/decide.ts';
import { PERMISSION_MATRIX } from '@planix/core/features/organization-access/permission-matrix.ts';
import type { Target } from '@planix/core/features/organization-access/principal.ts';
import {
  stripSensitive,
  type PermissionCheck,
  type SensitivePermission,
} from '@planix/core/shared/sensitive-field/sensitive-field.ts';
import type { AuthenticatedRequest } from '../auth/session.guard.ts';
import { PROJECT_TARGET_RESOLVER, type ProjectTargetResolver } from '../authorization/project-target.resolver.ts';
import { REQUIRED_ACTION, type RequiredAction } from '../authorization/require-action.decorator.ts';
import { DomainError } from '../errors/domain-error.ts';
import { REQUEST_SCHEMA, RESPONSE_SCHEMA } from './sensitive-field.decorators.ts';
import { assertNoSensitiveWrites } from './sensitive-write.check.ts';

/**
 * Single enforcement point for sensitive fields (research R6): rejects unauthorized writes before the handler
 * and removes unreadable keys from success and error bodies. Runs inside the tenant transaction.
 */
@Injectable()
export class SensitiveFieldInterceptor implements NestInterceptor {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PROJECT_TARGET_RESOLVER) private readonly projects: ProjectTargetResolver,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const targets = [context.getHandler(), context.getClass()];
    const responseSchema = this.reflector.getAllAndOverride<z.ZodType | undefined>(RESPONSE_SCHEMA, targets);
    const requestSchema = this.reflector.getAllAndOverride<z.ZodType | undefined>(REQUEST_SCHEMA, targets);
    if (responseSchema === undefined && requestSchema === undefined) return next.handle();

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const required = this.reflector.getAllAndOverride<RequiredAction | undefined>(REQUIRED_ACTION, targets);

    return from(this.#permissionCheck(req, required)).pipe(
      mergeMap((can) => {
        if (requestSchema !== undefined) assertNoSensitiveWrites(requestSchema, req.body, can);
        return next.handle().pipe(
          map((body) => (responseSchema === undefined ? body : stripSensitive(responseSchema, body, can))),
          catchError((error: unknown) =>
            throwError(() =>
              error instanceof DomainError && responseSchema !== undefined
                ? new DomainError(error.code, stripSensitive(responseSchema, error.params, can))
                : error,
            ),
          ),
        );
      }),
    );
  }

  async #permissionCheck(req: AuthenticatedRequest, required: RequiredAction | undefined): Promise<PermissionCheck> {
    const principal = req.principal;
    if (principal === undefined || required === undefined || req.tx === undefined) return () => false;

    let target: Target = { kind: 'organization' };
    const param: unknown = req.params[required.projectParam];
    if (typeof param === 'string') {
      target = (await this.projects.resolve(req.tx, principal, param)) ?? target;
    }
    const decisions = new Map<SensitivePermission, boolean>();
    return (permission) => {
      let allowed = decisions.get(permission);
      if (allowed === undefined) {
        allowed = permission in PERMISSION_MATRIX && decide(principal, permission, target).allowed;
        decisions.set(permission, allowed);
      }
      return allowed;
    };
  }
}
