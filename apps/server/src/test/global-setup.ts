import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import type { TestProject } from 'vitest/node';
import { migrate } from '../shared/db/migrate.ts';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrls: { owner: string; app: string; platform: string };
  }
}

let container: StartedPostgreSqlContainer | undefined;

/** One PostgreSQL 17 container per test run; migrations applied once as owner. */
export async function setup(project: TestProject): Promise<void> {
  container = await new PostgreSqlContainer('postgres:17')
    .withDatabase('planix')
    .withUsername('planix_owner')
    .withPassword('planix_owner_test')
    .start();

  const credentials = { appPassword: 'planix_app_test', platformPassword: 'planix_platform_test' };
  const owner = container.getConnectionUri();
  const ownerPool = new pg.Pool({ connectionString: owner, max: 1 });
  try {
    await migrate(ownerPool, credentials);
  } finally {
    await ownerPool.end();
  }

  const base = new URL(owner);
  const withUser = (user: string, password: string) => {
    const url = new URL(base);
    url.username = user;
    url.password = password;
    return url.toString();
  };
  project.provide('databaseUrls', {
    owner,
    app: withUser('planix_app', credentials.appPassword),
    platform: withUser('planix_platform', credentials.platformPassword),
  });
}

export async function teardown(): Promise<void> {
  await container?.stop();
}
