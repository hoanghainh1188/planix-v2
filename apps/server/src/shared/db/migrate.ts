import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';

const MIGRATIONS_DIR = fileURLToPath(new URL('../../../drizzle/', import.meta.url));

export interface RoleCredentials {
  readonly appPassword: string;
  readonly platformPassword: string;
}

/** Session advisory lock key shared by every migrator of this database ("planix migrate"). */
const MIGRATION_LOCK_KEY = 7_420_311_118_018;

/**
 * Applies hand-written SQL migrations in filename order as the owner role, once each. Holds a session advisory lock
 * for the whole run: during a deploy the old and new container may both start and migrate (decision
 * 2026-09-15-018-demo-deploy); the second waits, then finds nothing left to apply.
 */
export async function migrate(ownerPool: pg.Pool, credentials: RoleCredentials): Promise<string[]> {
  const client = await ownerPool.connect();
  let locked = false;
  // A connection that failed to lock or unlock is not reused: release(error) removes it from the pool.
  let broken: Error | undefined;
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    locked = true;
    return await applyMigrations(client, credentials);
  } catch (error) {
    if (!locked) broken = asError(error);
    throw error;
  } finally {
    if (locked) {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch((error: unknown) => {
        broken = asError(error);
      });
    }
    // Always released, so db.close() (pool.end()) can finish and a failed migrate exits instead of hanging.
    client.release(broken);
  }
}

const asError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

async function applyMigrations(client: pg.PoolClient, credentials: RoleCredentials): Promise<string[]> {
  const applied: string[] = [];
  await client.query(
    'CREATE TABLE IF NOT EXISTS schema_migration (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
  for (const file of files) {
    const done = await client.query('SELECT 1 FROM schema_migration WHERE name = $1', [file]);
    if (done.rowCount) continue;
    const sql = await readFile(new URL(file, `file://${MIGRATIONS_DIR}`), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migration (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`, { cause: error });
    }
    applied.push(file);
    if (file.startsWith('0001_')) await grantLogin(client, credentials);
  }
  await grantLogin(client, credentials);
  return applied;
}

async function grantLogin(client: pg.PoolClient, credentials: RoleCredentials): Promise<void> {
  const exists = await client.query("SELECT 1 FROM pg_roles WHERE rolname = 'planix_app'");
  if (!exists.rowCount) return;
  // Passwords come from the environment; pg does not parameterize DDL, so quote via format().
  await client
    .query("SELECT format('ALTER ROLE planix_app LOGIN PASSWORD %L', $1::text) AS sql", [credentials.appPassword])
    .then((r) => client.query((r.rows[0] as { sql: string }).sql));
  await client
    .query("SELECT format('ALTER ROLE planix_platform LOGIN PASSWORD %L', $1::text) AS sql", [
      credentials.platformPassword,
    ])
    .then((r) => client.query((r.rows[0] as { sql: string }).sql));
}
