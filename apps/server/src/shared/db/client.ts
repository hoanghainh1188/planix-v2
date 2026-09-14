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

export function createDatabase(urls: DatabaseUrls): Database {
  const ownerPool = new pg.Pool({ connectionString: urls.owner, max: 2 });
  const appPool = new pg.Pool({ connectionString: urls.app });
  const platformPool = new pg.Pool({ connectionString: urls.platform, max: 5 });
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

async function inTransaction<T>(
  pool: pg.Pool,
  settings: Readonly<Record<string, string>>,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [name, value] of Object.entries(settings)) {
      // set_config(..., true) is the parameterizable equivalent of SET LOCAL.
      await client.query('SELECT set_config($1, $2, true)', [name, value]);
    }
    const tx = Object.assign(drizzle(client), { client }) as Tx;
    const result = await work(tx);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Runs `work` as `planix_app` scoped to the verified active organization. */
export function withTenantTransaction<T>(
  db: Database,
  tenant: TenantContext,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  return inTransaction(db.appPool, { 'app.organization_id': tenant.organizationId }, work);
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
