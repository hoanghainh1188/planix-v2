import { afterAll, describe, expect, inject, it } from 'vitest';
import { tenantFromVerifiedSession } from '@planix/core/shared/tenant-context.ts';
import { useTestDatabase } from '../../test/postgres.ts';
import { seedMembership, seedOrganization, seedUser } from '../../test/seed.ts';
import { createDatabase, openTransaction, tenantSettings, withAnonymousTransaction } from './client.ts';

const shared = useTestDatabase();
const short = createDatabase(inject('databaseUrls'), { statementTimeoutMs: 300, idleInTransactionTimeoutMs: 500 });
afterAll(() => short.close());

describe('database timeouts end stuck work instead of holding connections (security review)', () => {
  it('cancels a statement that runs too long', async () => {
    await expect(withAnonymousTransaction(short, (tx) => tx.client.query('SELECT pg_sleep(2)'))).rejects.toThrow(
      /statement timeout/,
    );
  });

  it('a request waiting on a row lock gets an error instead of waiting forever', async () => {
    const organizationId = await seedOrganization(shared);
    const membershipId = await seedMembership(shared, organizationId, await seedUser(shared));
    const settings = tenantSettings(tenantFromVerifiedSession(organizationId));
    const lockQuery = 'SELECT id FROM organization_membership WHERE id = $1 FOR UPDATE';
    const holder = await openTransaction(shared.appPool, settings);
    const waiter = await openTransaction(short.appPool, settings);
    try {
      await holder.tx.client.query(lockQuery, [membershipId]);
      await expect(waiter.tx.client.query(lockQuery, [membershipId])).rejects.toThrow(/statement timeout/);
    } finally {
      await waiter.rollback().catch(() => undefined);
      await holder.rollback();
    }
  });

  it('terminates a transaction left idle, and the process keeps running', async () => {
    const transaction = await openTransaction(short.appPool, {});
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    await expect(transaction.tx.client.query('SELECT 1')).rejects.toThrow();
    await transaction.rollback().catch(() => undefined);
    const { rows } = await withAnonymousTransaction(short, (tx) => tx.client.query<{ ok: number }>('SELECT 1 AS ok'));
    expect(rows).toEqual([{ ok: 1 }]);
  });
});
