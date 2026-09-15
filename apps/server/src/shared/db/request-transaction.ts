import type { Response } from 'express';
import type { TenantContext } from '@planix/core/shared/tenant-context.ts';
import { openTransaction, tenantSettings, type ApplicationDatabase, type OpenTransaction, type Tx } from './client.ts';

const REQUEST_TRANSACTION = Symbol('planix.requestTransaction');
const AFTER_COMMIT = Symbol('planix.afterCommit');

interface TransactionCarrier {
  [REQUEST_TRANSACTION]?: OpenTransaction;
  [AFTER_COMMIT]?: Array<() => void>;
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
  db: ApplicationDatabase,
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

/**
 * Schedules side effects that must only happen once the request's data is committed (e.g. sending an email about
 * it). Callbacks run right after COMMIT, never after a rollback; they must not throw and should start background
 * work rather than wait for it.
 */
export function onRequestCommit(req: object, callback: () => void): void {
  const carrier = req as TransactionCarrier;
  (carrier[AFTER_COMMIT] ??= []).push(callback);
}

export async function commitRequestTransaction(req: object): Promise<void> {
  const carrier = req as TransactionCarrier;
  const transaction = carrier[REQUEST_TRANSACTION];
  if (transaction === undefined) return;
  await transaction.commit();
  const callbacks = carrier[AFTER_COMMIT] ?? [];
  carrier[AFTER_COMMIT] = [];
  // Already rolled back (e.g. the client disconnected mid-request): the data does not exist, so no side effects.
  if (transaction.state !== 'committed') return;
  for (const callback of callbacks) {
    try {
      callback();
    } catch {
      // A failing side effect must not turn a committed request into an error; callers log their own failures.
    }
  }
}

export async function rollbackRequestTransaction(req: object): Promise<void> {
  const carrier = req as TransactionCarrier;
  carrier[AFTER_COMMIT] = [];
  await carrier[REQUEST_TRANSACTION]?.rollback();
}

/** The request's tenant transaction inside an organization-scoped handler; its absence is a wiring bug. */
export function requireRequestTransaction(req: object): Tx {
  const tx = requestTransaction(req);
  if (tx === undefined) throw new Error('Organization route handler called without a request transaction');
  return tx;
}
