import type { Response } from 'express';
import type { TenantContext } from '@planix/core/shared/tenant-context.ts';
import { openTransaction, tenantSettings, type Database, type OpenTransaction, type Tx } from './client.ts';

const REQUEST_TRANSACTION = Symbol('planix.requestTransaction');

interface TransactionCarrier {
  [REQUEST_TRANSACTION]?: OpenTransaction;
  tx?: Tx;
}

/**
 * One tenant transaction per organization request (code review finding 2): opened by SessionGuard, reused by
 * AuthorizationGuard, interceptors and the handler, committed by TenantTransactionInterceptor. If the request ends
 * any other way (guard denial, error, client disconnect) it is rolled back when the response closes.
 */
export async function openRequestTransaction(
  req: object,
  res: Response,
  db: Database,
  tenant: TenantContext,
): Promise<Tx> {
  const carrier = req as TransactionCarrier;
  const existing = carrier[REQUEST_TRANSACTION];
  if (existing !== undefined) return existing.tx;
  const transaction = await openTransaction(db.appPool, tenantSettings(tenant));
  carrier[REQUEST_TRANSACTION] = transaction;
  carrier.tx = transaction.tx;
  res.once('close', () => {
    void transaction.rollback().catch(() => undefined);
  });
  return transaction.tx;
}

export function requestTransaction(req: object): Tx | undefined {
  return (req as TransactionCarrier)[REQUEST_TRANSACTION]?.tx;
}

export async function commitRequestTransaction(req: object): Promise<void> {
  await (req as TransactionCarrier)[REQUEST_TRANSACTION]?.commit();
}

export async function rollbackRequestTransaction(req: object): Promise<void> {
  await (req as TransactionCarrier)[REQUEST_TRANSACTION]?.rollback();
}
