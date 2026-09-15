import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from './migrate.ts';

/**
 * Managed PostgreSQL (Neon) gives an owner that can create roles and bypass RLS but is not a superuser
 * (decision 2026-09-15-018-demo-deploy). A fresh container is used because roles are cluster-wide.
 */
let container: StartedPostgreSqlContainer;
const MIGRATIONS = readdirSync(fileURLToPath(new URL('../../../drizzle/', import.meta.url)))
  .filter((f) => /^\d{4}_.+\.sql$/.test(f))
  .sort();
const credentials = { appPassword: 'App-role-Passw0rd-for-test-1', platformPassword: 'Platform-role-Passw0rd-2' };

function urlFor(user: string, password: string, database: string): string {
  const url = new URL(container.getConnectionUri());
  url.username = user;
  url.password = password;
  url.pathname = `/${database}`;
  return url.toString();
}

async function asManagedOwner<T>(database: string, run: (pool: pg.Pool) => Promise<T>): Promise<T> {
  const pool = new pg.Pool({ connectionString: urlFor('managed_owner', 'Managed-owner-Passw0rd-3', database), max: 4 });
  try {
    return await run(pool);
  } finally {
    await pool.end();
  }
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:17').withUsername('postgres').withPassword('postgres').start();
  const superuser = new pg.Client({ connectionString: container.getConnectionUri() });
  await superuser.connect();
  try {
    await superuser.query(
      "CREATE ROLE managed_owner LOGIN PASSWORD 'Managed-owner-Passw0rd-3' CREATEROLE CREATEDB BYPASSRLS NOSUPERUSER",
    );
    await superuser.query('CREATE DATABASE planix_managed OWNER managed_owner');
    await superuser.query('CREATE DATABASE planix_concurrent OWNER managed_owner');
  } finally {
    await superuser.end();
  }
});

afterAll(async () => {
  await container?.stop();
});

describe('migrations on managed PostgreSQL (non-superuser owner, decision 2026-09-15-018-demo-deploy)', () => {
  it('apply every migration and leave application roles without superuser or BYPASSRLS', async () => {
    const applied = await asManagedOwner('planix_managed', (pool) => migrate(pool, credentials));
    expect(applied).toEqual(MIGRATIONS);

    const roles = await asManagedOwner('planix_managed', (pool) =>
      pool.query<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean; rolcanlogin: boolean }>(
        "SELECT rolname, rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname IN ('planix_app', 'planix_platform') ORDER BY rolname",
      ),
    );
    expect(roles.rows).toEqual([
      { rolname: 'planix_app', rolsuper: false, rolbypassrls: false, rolcanlogin: true },
      { rolname: 'planix_platform', rolsuper: false, rolbypassrls: false, rolcanlogin: true },
    ]);

    const app = new pg.Client({ connectionString: urlFor('planix_app', credentials.appPassword, 'planix_managed') });
    await app.connect();
    try {
      const forced = await app.query<{ relforcerowsecurity: boolean }>(
        "SELECT relforcerowsecurity FROM pg_class WHERE relname = 'project'",
      );
      expect(forced.rows).toEqual([{ relforcerowsecurity: true }]);
    } finally {
      await app.end();
    }
  });

  it('is safe when two instances migrate at the same time (deploy overlap): each file applies once', async () => {
    const [first, second] = await asManagedOwner('planix_concurrent', (pool) =>
      Promise.all([migrate(pool, credentials), migrate(pool, credentials)]),
    );
    expect([...first, ...second].sort()).toEqual(MIGRATIONS);
    const recorded = await asManagedOwner('planix_concurrent', (pool) =>
      pool.query<{ name: string }>('SELECT name FROM schema_migration ORDER BY name'),
    );
    expect(recorded.rows.map((r) => r.name)).toEqual(MIGRATIONS);
  });

  it('fails and returns its connection to the pool when taking the lock fails (code review: no hung migrate)', async () => {
    await asManagedOwner('planix_managed', async (pool) => {
      const connect = pool.connect.bind(pool);
      // The first query of the run is the advisory lock; make it fail as a dropped connection would.
      (pool as unknown as { connect: () => Promise<pg.PoolClient> }).connect = async () => {
        const client = await connect();
        const query = client.query.bind(client) as (...args: unknown[]) => Promise<unknown>;
        let first = true;
        (client as unknown as { query: (...args: unknown[]) => Promise<unknown> }).query = (...args: unknown[]) => {
          if (first) {
            first = false;
            return Promise.reject(new Error('Connection terminated unexpectedly'));
          }
          return query(...args);
        };
        return client;
      };

      await expect(migrate(pool, credentials)).rejects.toThrow('Connection terminated unexpectedly');
      // No client left checked out, so pool.end() (db.close()) can finish instead of waiting forever.
      expect(pool.totalCount - pool.idleCount).toBe(0);
    });
  });
});
