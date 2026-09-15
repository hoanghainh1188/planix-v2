import { Inject, Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, lastValueFrom, type Observable } from 'rxjs';
import { tenantFromVerifiedSession } from '@planix/core/shared/tenant-context.ts';
import { DATABASE } from '../app-tokens.ts';
import { withTenantTransaction, type Database } from '../db/client.ts';
import { ORGANIZATION_SCOPED } from './route-scope.decorators.ts';
import type { AuthenticatedRequest } from './session.guard.ts';

/** Wraps organization routes in one tenant transaction exposed as `req.tx` (RLS context + audit atomicity). */
@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const scoped = this.reflector.getAllAndOverride<boolean | undefined>(ORGANIZATION_SCOPED, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (scoped !== true || req.principal === undefined) return next.handle();
    const tenant = tenantFromVerifiedSession(req.principal.organizationId);
    return from(
      withTenantTransaction(this.db, tenant, (tx) => {
        req.tx = tx;
        return lastValueFrom(next.handle(), { defaultValue: undefined });
      }),
    );
  }
}
