import { afterAll, inject } from 'vitest';
import { createDatabase, type Database } from '../shared/db/client.ts';

/** Database handle for integration tests: owner, planix_app and planix_platform pools on the shared container. */
export function useTestDatabase(): Database {
  const db = createDatabase(inject('databaseUrls'));
  afterAll(() => db.close());
  return db;
}
