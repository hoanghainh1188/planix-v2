import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tenantFromVerifiedSession } from '@planix/core/shared/tenant-context.ts';
import { openTransaction, tenantSettings } from '../../../shared/db/client.ts';
import { DomainError } from '../../../shared/errors/domain-error.ts';
import { useTestDatabase } from '../../../test/postgres.ts';
import { RecordingMailSender } from '../../../test/recording-mail-sender.ts';
import { seedMembership, seedOrganization, seedProject, seedProjectMember, seedUser } from '../../../test/seed.ts';
import { createTestApp } from '../../../test/test-app.ts';
import { ACCOUNTABLE_QUERY, AccountableQuery } from './accountable.query.ts';

const db = useTestDatabase();
let app: INestApplication;
let acme: { organizationId: string; projectId: string; projectMemberId: string; userId: string; otherUserId: string };
let betaProjectId: string;

async function seedProjectWithAccountable(name: string) {
  const organizationId = await seedOrganization(db, name);
  const userId = await seedUser(db);
  const membershipId = await seedMembership(db, organizationId, userId, ['projectManager']);
  const projectId = await seedProject(db, organizationId, membershipId);
  const projectMemberId = await seedProjectMember(db, organizationId, projectId, membershipId, ['accountable']);
  const otherUserId = await seedUser(db);
  const otherMembershipId = await seedMembership(db, organizationId, otherUserId, ['member']);
  await seedProjectMember(db, organizationId, projectId, otherMembershipId, ['responsible']);
  return { organizationId, projectId, projectMemberId, userId, otherUserId };
}

beforeAll(async () => {
  app = await createTestApp({ database: db, mailSender: new RecordingMailSender() });
  acme = await seedProjectWithAccountable('Acme');
  betaProjectId = (await seedProjectWithAccountable('Beta')).projectId;
});

afterAll(() => app.close());

async function inAcme<T>(
  work: (query: AccountableQuery, tx: Parameters<AccountableQuery['getAccountable']>[0]) => Promise<T>,
) {
  const query = app.get<AccountableQuery>(ACCOUNTABLE_QUERY, { strict: false });
  const transaction = await openTransaction(db.appPool, tenantSettings(tenantFromVerifiedSession(acme.organizationId)));
  try {
    return await work(query, transaction.tx);
  } finally {
    await transaction.rollback();
  }
}

const tenant = () => tenantFromVerifiedSession(acme.organizationId);

describe('Accountable lookup for other features (FR-021, contracts/authorization.md §4)', () => {
  it('is exported by the application as a provider', () => {
    expect(app.get(ACCOUNTABLE_QUERY, { strict: false })).toBeInstanceOf(AccountableQuery);
  });

  it('returns exactly the one Accountable, using the caller transaction without opening a connection', async () => {
    const connect = db.appPool.connect.bind(db.appPool);
    await inAcme(async (query, tx) => {
      let checkouts = 0;
      db.appPool.connect = ((...args: unknown[]) => {
        checkouts++;
        return (connect as (...a: unknown[]) => unknown)(...args);
      }) as typeof db.appPool.connect;
      try {
        expect(await query.getAccountable(tx, tenant(), acme.projectId)).toEqual({
          projectMemberId: acme.projectMemberId,
          userId: acme.userId,
        });
        expect(await query.isAccountable(tx, tenant(), acme.projectId, acme.userId)).toBe(true);
        expect(await query.isAccountable(tx, tenant(), acme.projectId, acme.otherUserId)).toBe(false);
      } finally {
        db.appPool.connect = connect;
      }
      expect(checkouts).toBe(0);
    });
  });

  it('sees an Accountable change made earlier in the same transaction', async () => {
    await inAcme(async (query, tx) => {
      await tx.client.query("DELETE FROM raci_assignment WHERE project_id = $1 AND raci_role = 'accountable'", [
        acme.projectId,
      ]);
      const other = await tx.client.query<{ id: string }>(
        `SELECT pm.id FROM project_member pm JOIN organization_membership m ON m.id = pm.membership_id
          WHERE pm.project_id = $1 AND m.user_id = $2`,
        [acme.projectId, acme.otherUserId],
      );
      await tx.client.query(
        "INSERT INTO raci_assignment (organization_id, project_id, project_member_id, raci_role) VALUES ($1, $2, $3, 'accountable')",
        [acme.organizationId, acme.projectId, other.rows[0]!.id],
      );
      expect(await query.isAccountable(tx, tenant(), acme.projectId, acme.otherUserId)).toBe(true);
    });
  });

  it('refuses a project of another organization, an unknown or malformed id with RESOURCE_NOT_FOUND', async () => {
    await inAcme(async (query, tx) => {
      for (const projectId of [betaProjectId, randomUUID(), 'nope']) {
        const error: unknown = await query.getAccountable(tx, tenant(), projectId).catch((e: unknown) => e);
        expect(error, projectId).toBeInstanceOf(DomainError);
        expect((error as DomainError).code).toBe('RESOURCE_NOT_FOUND');
        const isError: unknown = await query
          .isAccountable(tx, tenant(), projectId, acme.userId)
          .catch((e: unknown) => e);
        expect((isError as DomainError).code).toBe('RESOURCE_NOT_FOUND');
      }
    });
  });

  it('refuses when the tenant argument names another organization than the project', async () => {
    await inAcme(async (query, tx) => {
      const error: unknown = await query
        .getAccountable(tx, tenantFromVerifiedSession(randomUUID()), acme.projectId)
        .catch((e: unknown) => e);
      expect((error as DomainError).code).toBe('RESOURCE_NOT_FOUND');
    });
  });
});
