import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import type { TenantContext } from '@planix/core/shared/tenant-context.ts';

/**
 * Database access (research R3). Three pools, one per role:
 * - owner: migrations only
 * - app: `planix_app`, all tenant requests (RLS enforced)
 * - platform: `planix_platform`, `/platform/*` only (RLS enforced by its own policies)
 * NUMERIC values stay strings: the default pg type parser is never overridden (constitution Principle I).
 */
export interface DatabaseUrls {
  readonly owner: string;
  readonly app: string;
  readonly platform: string;
}

export interface Database {
  readonly ownerPool: pg.Pool;
  readonly appPool: pg.Pool;
  readonly platformPool: pg.Pool;
  close(): Promise<void>;
}

/** Application pool size per server instance; each organization request holds at most one connection (SC-006). */
export const DEFAULT_APP_POOL_MAX = 20;

/** A single statement (including waiting for a row lock) longer than this is cancelled by PostgreSQL. */
export const DEFAULT_STATEMENT_TIMEOUT_MS = 15_000;
/** A transaction left open without running a statement longer than this is terminated by PostgreSQL. */
export const DEFAULT_IDLE_IN_TRANSACTION_TIMEOUT_MS = 30_000;

/** Waiting longer than this for a free pooled connection fails the request instead of hanging (security review). */
export const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;

export interface DatabaseOptions {
  readonly appPoolMax?: number;
  readonly connectionTimeoutMs?: number;
  readonly statementTimeoutMs?: number;
  readonly idleInTransactionTimeoutMs?: number;
}

/**
 * A pooled connection can fail while idle (e.g. terminated by the server); pg then emits `error` on the pool, and an
 * unhandled `error` event would crash the process. The pool already discards the broken connection.
 */
function ignoreIdleConnectionErrors(pool: pg.Pool): pg.Pool {
  pool.on('error', () => undefined);
  return pool;
}

export function createDatabase(urls: DatabaseUrls, options: DatabaseOptions = {}): Database {
  // Application roles only; migrations (owner) may legitimately run long (security review: stuck transactions).
  const timeouts = {
    statement_timeout: options.statementTimeoutMs ?? DEFAULT_STATEMENT_TIMEOUT_MS,
    idle_in_transaction_session_timeout: options.idleInTransactionTimeoutMs ?? DEFAULT_IDLE_IN_TRANSACTION_TIMEOUT_MS,
  };
  const connectionTimeoutMillis = options.connectionTimeoutMs ?? DEFAULT_CONNECTION_TIMEOUT_MS;
  const ownerPool = ignoreIdleConnectionErrors(
    new pg.Pool({ connectionString: urls.owner, max: 2, connectionTimeoutMillis }),
  );
  const appPool = ignoreIdleConnectionErrors(
    new pg.Pool({
      connectionString: urls.app,
      max: options.appPoolMax ?? DEFAULT_APP_POOL_MAX,
      connectionTimeoutMillis,
      ...timeouts,
    }),
  );
  const platformPool = ignoreIdleConnectionErrors(
    new pg.Pool({ connectionString: urls.platform, max: 5, connectionTimeoutMillis, ...timeouts }),
  );
  return {
    ownerPool,
    appPool,
    platformPool,
    async close() {
      await Promise.all([ownerPool.end(), appPool.end(), platformPool.end()]);
    },
  };
}

export type Tx = NodePgDatabase & { readonly client: pg.PoolClient };

export interface OpenTransaction {
  readonly tx: Tx;
  /** `committed` only after a successful COMMIT; a rollback (or failed commit) ends as `rolledBack`. */
  readonly state: 'open' | 'committed' | 'rolledBack';
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

/** Begins a transaction with the given SET LOCAL settings; the caller must commit or roll back exactly once. */
export async function openTransaction(
  pool: pg.Pool,
  settings: Readonly<Record<string, string>>,
): Promise<OpenTransaction> {
  const client = await pool.connect();
  // While checked out, a server-side termination (idle-in-transaction timeout) is emitted on the client; the next
  // query rejects instead, so the event itself only needs a listener to avoid crashing the process.
  const onClientError = () => undefined;
  client.on('error', onClientError);
  try {
    await client.query('BEGIN');
    for (const [name, value] of Object.entries(settings)) {
      // set_config(..., true) is the parameterizable equivalent of SET LOCAL.
      await client.query('SELECT set_config($1, $2, true)', [name, value]);
    }
  } catch (error) {
    client.off('error', onClientError);
    client.release(error as Error);
    throw error;
  }
  let state: OpenTransaction['state'] = 'open';
  const finish = async (statement: 'COMMIT' | 'ROLLBACK') => {
    if (state !== 'open') return;
    state = 'rolledBack';
    try {
      await client.query(statement);
      if (statement === 'COMMIT') state = 'committed';
      client.off('error', onClientError);
      client.release();
    } catch (error) {
      client.off('error', onClientError);
      // A connection that failed mid-transaction must not go back to the pool.
      client.release(error as Error);
      throw error;
    }
  };
  return {
    tx: Object.assign(drizzle(client), { client }),
    get state() {
      return state;
    },
    commit: () => finish('COMMIT'),
    rollback: () => finish('ROLLBACK'),
  };
}

async function inTransaction<T>(
  pool: pg.Pool,
  settings: Readonly<Record<string, string>>,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  const transaction = await openTransaction(pool, settings);
  try {
    const result = await work(transaction.tx);
    await transaction.commit();
    return result;
  } catch (error) {
    // Keep the original error even when the connection is already gone (e.g. terminated by a timeout).
    await transaction.rollback().catch(() => undefined);
    throw error;
  }
}

/** Settings for a tenant-scoped transaction (research R3). */
export const tenantSettings = (tenant: TenantContext) => ({ 'app.organization_id': tenant.organizationId });

/** Runs `work` as `planix_app` scoped to the verified active organization. */
export function withTenantTransaction<T>(
  db: Database,
  tenant: TenantContext,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  return inTransaction(db.appPool, tenantSettings(tenant), work);
}

/** Runs `work` as `planix_app` with read access to the given user's own memberships only (R3 path 1). */
export function withUserTransaction<T>(db: Database, userId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
  return inTransaction(db.appPool, { 'app.user_id': userId }, work);
}

/** Runs `work` as `planix_app` without tenant or user scope (e.g. invitation token lookup, R3 path 2). */
export function withAnonymousTransaction<T>(db: Database, work: (tx: Tx) => Promise<T>): Promise<T> {
  return inTransaction(db.appPool, {}, work);
}

/** Runs `work` as `planix_platform` (R3 path 3). */
export function withPlatformTransaction<T>(db: Database, work: (tx: Tx) => Promise<T>): Promise<T> {
  return inTransaction(db.platformPool, {}, work);
}
