import { describe, expect, it } from 'vitest';
import {
  createDatabase,
  DEFAULT_APP_POOL_MAX,
  DEFAULT_CONNECTION_TIMEOUT_MS,
  DEFAULT_IDLE_IN_TRANSACTION_TIMEOUT_MS,
  DEFAULT_STATEMENT_TIMEOUT_MS,
} from './client.ts';

const urls = {
  owner: 'postgres://o@localhost/x',
  app: 'postgres://a@localhost/x',
  platform: 'postgres://p@localhost/x',
};

describe('createDatabase pool sizing (SC-006)', () => {
  it('sizes the application pool explicitly', async () => {
    const db = createDatabase(urls);
    expect(DEFAULT_APP_POOL_MAX).toBe(20);
    expect((db.appPool as unknown as { options: { max: number } }).options.max).toBe(20);
    await db.close();
  });

  it('accepts a configured application pool size', async () => {
    const db = createDatabase(urls, { appPoolMax: 40 });
    expect((db.appPool as unknown as { options: { max: number } }).options.max).toBe(40);
    await db.close();
  });
});

type PoolOptions = { options: { statement_timeout?: number; idle_in_transaction_session_timeout?: number } };

describe('createDatabase timeouts (security review: stuck transactions)', () => {
  it('sets statement and idle-in-transaction timeouts on the application and platform pools', async () => {
    const db = createDatabase(urls);
    expect(DEFAULT_STATEMENT_TIMEOUT_MS).toBe(15_000);
    expect(DEFAULT_IDLE_IN_TRANSACTION_TIMEOUT_MS).toBe(30_000);
    for (const pool of [db.appPool, db.platformPool]) {
      expect((pool as unknown as PoolOptions).options).toMatchObject({
        statement_timeout: 15_000,
        idle_in_transaction_session_timeout: 30_000,
      });
    }
    // Migrations may legitimately run long.
    expect((db.ownerPool as unknown as PoolOptions).options.statement_timeout).toBeUndefined();
    await db.close();
  });

  it('accepts configured timeouts', async () => {
    const db = createDatabase(urls, { statementTimeoutMs: 2_000, idleInTransactionTimeoutMs: 5_000 });
    expect((db.appPool as unknown as PoolOptions).options).toMatchObject({
      statement_timeout: 2_000,
      idle_in_transaction_session_timeout: 5_000,
    });
    await db.close();
  });
});

describe('createDatabase connection wait (security review: pool deadlock)', () => {
  it('bounds how long a request waits for a free connection on every pool', async () => {
    const db = createDatabase(urls);
    expect(DEFAULT_CONNECTION_TIMEOUT_MS).toBe(10_000);
    for (const pool of [db.ownerPool, db.appPool, db.platformPool]) {
      expect(
        (pool as unknown as { options: { connectionTimeoutMillis?: number } }).options.connectionTimeoutMillis,
      ).toBe(10_000);
    }
    await db.close();
  });
});
