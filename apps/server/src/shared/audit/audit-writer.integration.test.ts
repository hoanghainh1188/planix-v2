import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { sensitive } from '@planix/core/shared/sensitive-field/sensitive-field.ts';
import { tenantFromVerifiedSession } from '@planix/core/shared/tenant-context.ts';
import { useTestDatabase } from '../../test/postgres.ts';
import { seedOrganization } from '../../test/seed.ts';
import { withAnonymousTransaction, withTenantTransaction } from '../db/client.ts';
import { AuditWriter } from './audit-writer.ts';

const db = useTestDatabase();
const writer = new AuditWriter();

const ProjectSnapshot = z.object({
  name: z.string(),
  budgetAtCompletion: sensitive('sensitive.financial.read', 'sensitive.financial.write')(z.string()),
});

async function entriesFor(targetId: string) {
  const { rows } = await db.ownerPool.query<{
    outcome: string;
    before: unknown;
    after: unknown;
    organization_id: string | null;
  }>('SELECT outcome, before, after, organization_id FROM audit_entry WHERE target_id = $1', [targetId]);
  return rows;
}

describe('AuditWriter (FR-027, FR-028, SC-008, R8)', () => {
  it('writes in the caller transaction so a rollback removes the entry', async () => {
    const targetId = randomUUID();
    const tenant = tenantFromVerifiedSession(await seedOrganization(db));
    await expect(
      withTenantTransaction(db, tenant, async (tx) => {
        await writer.record(tx, {
          organizationId: tenant.organizationId,
          actorUserId: null,
          actorKind: 'system',
          action: 'org.member.invite',
          targetType: 'organizationInvitation',
          targetId,
          outcome: 'succeeded',
        });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await entriesFor(targetId)).toEqual([]);
  });

  it('commits the entry with the transaction', async () => {
    const targetId = randomUUID();
    const tenant = tenantFromVerifiedSession(await seedOrganization(db));
    await withTenantTransaction(db, tenant, (tx) =>
      writer.record(tx, {
        organizationId: tenant.organizationId,
        actorUserId: null,
        actorKind: 'system',
        action: 'project.read',
        targetType: 'project',
        targetId,
        outcome: 'denied',
      }),
    );
    expect(await entriesFor(targetId)).toMatchObject([{ outcome: 'denied', organization_id: tenant.organizationId }]);
  });

  it('removes forbidden keys and sensitive field values from before/after', async () => {
    const targetId = randomUUID();
    const tenant = tenantFromVerifiedSession(await seedOrganization(db));
    await withTenantTransaction(db, tenant, (tx) =>
      writer.record(tx, {
        organizationId: tenant.organizationId,
        actorUserId: null,
        actorKind: 'user',
        action: 'project.update',
        targetType: 'project',
        targetId,
        outcome: 'succeeded',
        before: { name: 'Old', budgetAtCompletion: '10.0000', nested: { password: 'p', passwordHash: 'h' } },
        after: { name: 'New', budgetAtCompletion: '20.0000', token: 't', tokens: [{ tokenHash: 'x', keep: 1 }] },
        snapshotSchema: ProjectSnapshot,
      }),
    );
    const [entry] = await entriesFor(targetId);
    expect(entry?.before).toEqual({ name: 'Old', nested: {} });
    expect(entry?.after).toEqual({ name: 'New', tokens: [{ keep: 1 }] });
  });

  it('forbids UPDATE and DELETE for planix_app (append-only)', async () => {
    const tenant = tenantFromVerifiedSession(await seedOrganization(db));
    await expect(
      withTenantTransaction(db, tenant, (tx) => tx.client.query("UPDATE audit_entry SET outcome = 'denied'")),
    ).rejects.toThrow(/permission denied/);
    await expect(withTenantTransaction(db, tenant, (tx) => tx.client.query('DELETE FROM audit_entry'))).rejects.toThrow(
      /permission denied/,
    );
  });

  it('rejects unknown outcomes', async () => {
    const tenant = tenantFromVerifiedSession(await seedOrganization(db));
    await expect(
      withTenantTransaction(db, tenant, (tx) =>
        writer.record(tx, {
          organizationId: tenant.organizationId,
          actorUserId: null,
          actorKind: 'system',
          action: 'x',
          targetType: 'x',
          targetId: randomUUID(),
          outcome: 'maybe' as 'denied',
        }),
      ),
    ).rejects.toThrow();
  });

  it('accepts account events without organization but hides them from planix_app', async () => {
    const targetId = randomUUID();
    await withAnonymousTransaction(db, (tx) =>
      writer.record(tx, {
        organizationId: null,
        actorUserId: null,
        actorKind: 'user',
        action: 'auth.login',
        targetType: 'appUser',
        targetId,
        outcome: 'succeeded',
      }),
    );
    expect(await entriesFor(targetId)).toHaveLength(1);
    const visible = await withTenantTransaction(db, tenantFromVerifiedSession(await seedOrganization(db)), (tx) =>
      tx.client.query('SELECT 1 FROM audit_entry WHERE target_id = $1', [targetId]),
    );
    expect(visible.rowCount).toBe(0);
  });

  it('rejects entries for another organization than the active one', async () => {
    const tenant = tenantFromVerifiedSession(await seedOrganization(db));
    const otherOrganizationId = await seedOrganization(db);
    await expect(
      withTenantTransaction(db, tenant, (tx) =>
        writer.record(tx, {
          organizationId: otherOrganizationId,
          actorUserId: null,
          actorKind: 'system',
          action: 'x',
          targetType: 'x',
          targetId: randomUUID(),
          outcome: 'succeeded',
        }),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});
