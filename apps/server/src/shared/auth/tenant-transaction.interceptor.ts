import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { from, lastValueFrom, type Observable } from 'rxjs';
import { commitRequestTransaction, requestTransaction, rollbackRequestTransaction } from '../db/request-transaction.ts';

/**
 * Completes the request's tenant transaction (opened by SessionGuard on organization routes): commit after the
 * handler succeeds, roll back when it throws. Routes without a request transaction pass through.
 */
@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<object>();
    if (requestTransaction(req) === undefined) return next.handle();
    return from(
      (async () => {
        try {
          const result: unknown = await lastValueFrom(next.handle(), { defaultValue: undefined });
          await commitRequestTransaction(req);
          return result;
        } catch (error) {
          await rollbackRequestTransaction(req);
          throw error;
        }
      })(),
    );
  }
}
