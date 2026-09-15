import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../test/postgres.ts';
import { seedMembership, seedOrganization, seedUser } from '../../test/seed.ts';
import { withPlatformTransaction, withUserTransaction } from './client.ts';

const db = useTestDatabase();

let org1: string;
let org2: string;
let org3: string;
let userA: string;
let userB: string;
let operatorId: string;

beforeAll(async () => {
  [org1, org2, org3] = await Promise.all([
    seedOrganization(db, 'Acme'),
    seedOrganization(db, 'Beta'),
    seedOrganization(db, 'Gamma'),
  ]);
  [userA, userB, operatorId] = await Promise.all([seedUser(db), seedUser(db), seedUser(db)]);
  await seedMembership(db, org1, userA, ['admin', 'finance']);
  await seedMembership(db, org2, userA, ['member']);
  await seedMembership(db, org1, userB, ['projectManager']);
});

describe('path 1 — a user reads only their own memberships (R3)', () => {
  it('sees own memberships across organizations but not other users in the same organization', async () => {
    const { rows } = await withUserTransaction(db, userA, (tx) =>
      tx.client.query<{ user_id: string; organization_id: string }>(
        'SELECT user_id, organization_id FROM organization_membership',
      ),
    );
    expect(rows.map((r) => r.user_id)).toEqual([userA, userA]);
    expect(rows.map((r) => r.organization_id).sort()).toEqual([org1, org2].sort());
  });

  it('sees roles and organization names only for own memberships', async () => {
    const roles = await withUserTransaction(db, userA, (tx) =>
      tx.client.query<{ role: string }>('SELECT role FROM membership_role'),
    );
    expect(roles.rows.map((r) => r.role).sort()).toEqual(['admin', 'finance', 'member']);
    const organizations = await withUserTransaction(db, userA, (tx) =>
      tx.client.query<{ id: string }>('SELECT id FROM organization'),
    );
    expect(organizations.rows.map((r) => r.id).sort()).toEqual([org1, org2].sort());
    expect(organizations.rows.map((r) => r.id)).not.toContain(org3);
  });

  it('cannot insert or update through the user context', async () => {
    await expect(
      withUserTransaction(db, userA, (tx) =>
        tx.client.query('INSERT INTO organization_membership (organization_id, user_id) VALUES ($1, $2)', [
          org3,
          userA,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
    const updated = await withUserTransaction(db, userA, (tx) =>
      tx.client.query(
        "UPDATE organization_membership SET status = 'deactivated', deactivated_at = now() WHERE user_id = $1",
        [userA],
      ),
    );
    expect(updated.rowCount).toBe(0);
  });
});

describe('path 3 — planix_platform (R3, M1)', () => {
  it('creates, lists and updates the status of organizations', async () => {
    const created = await withPlatformTransaction(db, (tx) =>
      tx.client.query<{ id: string }>(
        "INSERT INTO organization (name, created_by_operator_id) VALUES ('Delta', $1) RETURNING id",
        [operatorId],
      ),
    );
    const id = created.rows[0]!.id;
    const listed = await withPlatformTransaction(db, (tx) =>
      tx.client.query('SELECT id FROM organization WHERE id = $1', [id]),
    );
    expect(listed.rowCount).toBe(1);
    const updated = await withPlatformTransaction(db, (tx) =>
      tx.client.query("UPDATE organization SET status = 'suspended' WHERE id = $1", [id]),
    );
    expect(updated.rowCount).toBe(1);
  });

  it('cannot change organization columns other than status', async () => {
    await expect(
      withPlatformTransaction(db, (tx) =>
        tx.client.query("UPDATE organization SET name = 'Hijack' WHERE id = $1", [org1]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('counts active admins through a function without reading memberships', async () => {
    const { rows } = await withPlatformTransaction(db, (tx) =>
      tx.client.query<{ count: number }>('SELECT app_count_active_admins($1) AS count', [org1]),
    );
    expect(rows[0]?.count).toBe(1);
    await expect(
      withPlatformTransaction(db, (tx) => tx.client.query('SELECT * FROM organization_membership')),
    ).rejects.toThrow(/permission denied/);
  });

  it('may insert audit entries only as platformOperator', async () => {
    await withPlatformTransaction(db, (tx) =>
      tx.client.query(
        "INSERT INTO audit_entry (organization_id, actor_user_id, actor_kind, action, target_type, outcome) VALUES ($1, $2, 'platformOperator', 'platform.organization.create', 'organization', 'succeeded')",
        [org1, operatorId],
      ),
    );
    await expect(
      withPlatformTransaction(db, (tx) =>
        tx.client.query(
          "INSERT INTO audit_entry (organization_id, actor_kind, action, target_type, outcome) VALUES ($1, 'user', 'x', 'x', 'succeeded')",
          [org1],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it.each(['project', 'project_member', 'raci_assignment', 'audit_entry'])('cannot read %s', async (table) => {
    await expect(withPlatformTransaction(db, (tx) => tx.client.query(`SELECT * FROM ${table}`))).rejects.toThrow(
      /permission denied/,
    );
  });
});
