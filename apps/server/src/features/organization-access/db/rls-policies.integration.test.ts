import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tenantFromVerifiedSession } from '@planix/core/shared/tenant-context.ts';
import { openTransaction, tenantSettings } from '../../../shared/db/client.ts';
import { seedTwoOrganizations, type TwoOrganizations } from '../../../test/fixtures/two-organizations.ts';
import { useTestDatabase } from '../../../test/postgres.ts';
import { RecordingMailSender } from '../../../test/recording-mail-sender.ts';
import { createTestApp } from '../../../test/test-app.ts';

/**
 * planix_app policies allowed besides the standard `tenant_isolation` template (research R3), each named with the
 * reason it cannot leak another organization's rows inside a tenant transaction.
 */
const ALLOWED_EXTRA_POLICIES: Readonly<Record<string, string>> = {
  // R3 path 1: own memberships only, and only when app.user_id is set (never inside a tenant transaction).
  'organization_membership.own_memberships_read': 'SELECT user_id = app_current_user_id()',
  'membership_role.own_membership_roles_read': 'SELECT roles of own memberships (app.user_id)',
  // R3 path 4: account/platform audit events carry no organization.
  'audit_entry.audit_insert': 'INSERT organization_id IS NULL OR the active organization',
  'audit_entry.audit_select': 'SELECT the active organization only',
};

const db = useTestDatabase();
let app: INestApplication;
let orgs: TwoOrganizations;
let tenantTables: string[];

const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;

beforeAll(async () => {
  app = await createTestApp({ database: db, mailSender: new RecordingMailSender() });
  orgs = await seedTwoOrganizations(app, db);
  const { rows } = await db.ownerPool.query<{ table_name: string }>(
    `SELECT c.table_name FROM information_schema.columns c
       JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema = 'public' AND c.column_name = 'organization_id' AND t.table_type = 'BASE TABLE'
      ORDER BY c.table_name`,
  );
  tenantTables = rows.map((r) => r.table_name);
});

afterAll(() => app.close());

/** Runs `work` as planix_app in Acme's tenant context and always rolls back. */
async function asAcme<T>(
  work: (query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number | null }>) => Promise<T>,
) {
  const transaction = await openTransaction(
    db.appPool,
    tenantSettings(tenantFromVerifiedSession(orgs.acme.organizationId)),
  );
  try {
    return await work(async (sql, params) => {
      await transaction.tx.client.query('SAVEPOINT attempt');
      try {
        const result = await transaction.tx.client.query(sql, params);
        await transaction.tx.client.query('RELEASE SAVEPOINT attempt');
        return result;
      } catch (error) {
        await transaction.tx.client.query('ROLLBACK TO SAVEPOINT attempt');
        throw error;
      }
    });
  } finally {
    await transaction.rollback();
  }
}

const REFUSED = /row-level security|permission denied/;

describe('row-level security on every organization table (FR-002, R3)', () => {
  it('covers the known organization tables', () => {
    expect(tenantTables).toEqual(
      expect.arrayContaining([
        'audit_entry',
        'membership_role',
        'organization_invitation',
        'organization_membership',
        'project',
        'project_member',
        'raci_assignment',
      ]),
    );
  });

  it('enables and forces RLS on every table with organization_id', async () => {
    const { rows } = await db.ownerPool.query<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
        WHERE relnamespace = 'public'::regnamespace AND relname = ANY($1)`,
      [tenantTables],
    );
    const unprotected = rows.filter((r) => !r.relrowsecurity || !r.relforcerowsecurity).map((r) => r.relname);
    expect(unprotected, 'tables with organization_id but without enabled + forced RLS').toEqual([]);
  });

  it('gives planix_app only the tenant template or an explicitly allowed policy', async () => {
    const { rows } = await db.ownerPool.query<{
      tablename: string;
      policyname: string;
      qual: string | null;
      with_check: string | null;
    }>(
      `SELECT tablename, policyname, qual, with_check FROM pg_policies
        WHERE schemaname = 'public' AND 'planix_app' = ANY(roles) AND tablename = ANY($1)`,
      [tenantTables],
    );
    const standard = '(organization_id = app_current_organization_id())';
    const unexpected = rows
      .filter((r) => !(r.policyname === 'tenant_isolation' && r.qual === standard && r.with_check === standard))
      .map((r) => `${r.tablename}.${r.policyname}`)
      .filter((name) => ALLOWED_EXTRA_POLICIES[name] === undefined);
    expect(unexpected).toEqual([]);
    const withoutPolicy = tenantTables.filter((table) => !rows.some((r) => r.tablename === table));
    expect(withoutPolicy, 'RLS without any planix_app policy hides the table entirely — intended?').toEqual([]);
  });

  it('planix_app in Acme cannot SELECT, INSERT, UPDATE or DELETE any Beta row', async () => {
    for (const table of tenantTables) {
      const { rows: betaRows } = await db.ownerPool.query<{ row: Record<string, unknown> }>(
        `SELECT row_to_json(t) AS row FROM ${quote(table)} t WHERE organization_id = $1 LIMIT 1`,
        [orgs.beta.organizationId],
      );
      const betaRow = betaRows[0]?.row;
      expect(betaRow, `fixture has no Beta row in ${table}`).toBeDefined();

      await asAcme(async (query) => {
        const selected = await query(`SELECT 1 FROM ${quote(table)} WHERE organization_id = $1`, [
          orgs.beta.organizationId,
        ]).catch((error: Error) => error);
        if (!(selected instanceof Error)) expect(selected.rowCount, `${table} SELECT`).toBe(0);
        else expect(selected.message, `${table} SELECT`).toMatch(REFUSED);

        const inserted = await query(
          `INSERT INTO ${quote(table)} SELECT * FROM json_populate_record(NULL::${quote(table)}, $1)`,
          [JSON.stringify(betaRow)],
        ).catch((error: Error) => error);
        expect(inserted instanceof Error ? inserted.message : 'inserted', `${table} INSERT`).toMatch(REFUSED);

        const updated = await query(
          `UPDATE ${quote(table)} SET organization_id = organization_id WHERE organization_id = $1`,
          [orgs.beta.organizationId],
        ).catch((error: Error) => error);
        if (!(updated instanceof Error)) expect(updated.rowCount, `${table} UPDATE`).toBe(0);
        else expect(updated.message, `${table} UPDATE`).toMatch(REFUSED);

        const deleted = await query(`DELETE FROM ${quote(table)} WHERE organization_id = $1`, [
          orgs.beta.organizationId,
        ]).catch((error: Error) => error);
        if (!(deleted instanceof Error)) expect(deleted.rowCount, `${table} DELETE`).toBe(0);
        else expect(deleted.message, `${table} DELETE`).toMatch(REFUSED);

        const moved = await query(`UPDATE ${quote(table)} SET organization_id = $1 WHERE organization_id = $2`, [
          orgs.beta.organizationId,
          orgs.acme.organizationId,
        ]).catch((error: Error) => error);
        if (!(moved instanceof Error)) expect(moved.rowCount, `${table} move Acme row to Beta`).toBe(0);
        else expect(moved.message, `${table} move Acme row to Beta`).toMatch(REFUSED);
      });
    }
  });

  it('planix_app in Acme cannot read the Beta organization row', async () => {
    const result = await asAcme((query) =>
      query('SELECT 1 FROM organization WHERE id = $1', [orgs.beta.organizationId]),
    );
    expect(result.rowCount).toBe(0);
  });
});
