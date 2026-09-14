import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { tenantFromVerifiedSession } from '@planix/core/shared/tenant-context.ts';
import { useTestDatabase } from '../../test/postgres.ts';
import { withAnonymousTransaction, withTenantTransaction } from './client.ts';

const db = useTestDatabase();
const orgA = randomUUID();
const orgB = randomUUID();

describe('row-level security template (research R3)', () => {
  beforeAll(async () => {
    await db.ownerPool.query(`
      DROP TABLE IF EXISTS rls_probe;
      CREATE TABLE rls_probe (id serial PRIMARY KEY, organization_id uuid NOT NULL, label text NOT NULL, amount numeric NOT NULL);
      GRANT SELECT, INSERT ON rls_probe TO planix_app;
      GRANT USAGE ON SEQUENCE rls_probe_id_seq TO planix_app;
      SELECT app_enable_tenant_rls('rls_probe');
    `);
    await db.ownerPool.query(
      "INSERT INTO rls_probe (organization_id, label, amount) VALUES ($1, 'a', '10.1234'), ($2, 'b', '20.0000')",
      [orgA, orgB],
    );
  });

  it('application roles are neither superuser nor BYPASSRLS', async () => {
    const { rows } = await db.ownerPool.query<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>(
      "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN ('planix_app', 'planix_platform') ORDER BY rolname",
    );
    expect(rows).toEqual([
      { rolname: 'planix_app', rolsuper: false, rolbypassrls: false },
      { rolname: 'planix_platform', rolsuper: false, rolbypassrls: false },
    ]);
  });

  it('shows no rows without an organization context', async () => {
    const rows = await withAnonymousTransaction(db, (tx) => tx.client.query('SELECT * FROM rls_probe'));
    expect(rows.rowCount).toBe(0);
  });

  it('shows only the active organization rows', async () => {
    const { rows } = await withTenantTransaction(db, tenantFromVerifiedSession(orgA), (tx) =>
      tx.client.query<{ label: string }>('SELECT label FROM rls_probe'),
    );
    expect(rows.map((r) => r.label)).toEqual(['a']);
  });

  it('rejects inserting a row for another organization (WITH CHECK)', async () => {
    await expect(
      withTenantTransaction(db, tenantFromVerifiedSession(orgA), (tx) =>
        tx.client.query("INSERT INTO rls_probe (organization_id, label, amount) VALUES ($1, 'x', '1')", [orgB]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('reads NUMERIC as a string (constitution Principle I)', async () => {
    const { rows } = await withTenantTransaction(db, tenantFromVerifiedSession(orgA), (tx) =>
      tx.client.query<{ amount: unknown }>('SELECT amount FROM rls_probe'),
    );
    expect(rows[0]?.amount).toBe('10.1234');
  });
});
