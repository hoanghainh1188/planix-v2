import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Principal } from '@planix/core/features/organization-access/principal.ts';
import type { SystemRole } from '@planix/core/features/organization-access/roles.ts';
import { tenantFromVerifiedSession } from '@planix/core/shared/tenant-context.ts';
import { AuditWriter } from '../../../shared/audit/audit-writer.ts';
import { systemClock } from '../../../shared/clock/clock.ts';
import { openTransaction, tenantSettings, type OpenTransaction } from '../../../shared/db/client.ts';
import { DomainError } from '../../../shared/errors/domain-error.ts';
import { useTestDatabase } from '../../../test/postgres.ts';
import { RecordingMailSender } from '../../../test/recording-mail-sender.ts';
import { seedMembership, seedOrganization, seedProject, seedProjectMember, seedUser } from '../../../test/seed.ts';
import { createTestApp } from '../../../test/test-app.ts';
import { MembersRepository } from '../members/members.repository.ts';
import { MembersService } from '../members/members.service.ts';
import { ProjectMembersService } from './project-members.service.ts';
import { ProjectsRepository } from './projects.repository.ts';
import { RaciService } from './raci.service.ts';

const db = useTestDatabase();
let app: INestApplication;
let organizationId: string;
let adminUserId: string;
let pmUserId: string;
let projectId: string;
let candidateMembershipId: string;
let candidateProjectMemberId: string;

const raci = new RaciService(systemClock, new AuditWriter(), new ProjectsRepository());
const members = new MembersService(systemClock, new AuditWriter(), new MembersRepository());
const projectMembers = new ProjectMembersService(systemClock, new AuditWriter(), new ProjectsRepository());
const principal = (userId: string, role: SystemRole): Principal => ({
  userId,
  organizationId,
  membershipStatus: 'active',
  roles: new Set([role]),
});

/** Reads the backend pid up front (a later query on the same connection would queue behind the blocked one). */
async function lockProbe(transaction: OpenTransaction) {
  const { rows } = await transaction.tx.client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
  return (settled: () => boolean) => async () => {
    if (settled()) return 'finished without waiting';
    const activity = await db.ownerPool.query<{ wait_event_type: string | null }>(
      'SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1',
      [rows[0]!.pid],
    );
    return activity.rows[0]?.wait_event_type ?? null;
  };
}

beforeAll(async () => {
  app = await createTestApp({ database: db, mailSender: new RecordingMailSender() });
});

afterAll(() => app.close());

beforeEach(async () => {
  organizationId = await seedOrganization(db, 'Acme');
  adminUserId = await seedUser(db);
  await seedMembership(db, organizationId, adminUserId, ['admin']);
  pmUserId = await seedUser(db);
  const pmMembershipId = await seedMembership(db, organizationId, pmUserId, ['projectManager']);
  projectId = await seedProject(db, organizationId, pmMembershipId);
  await seedProjectMember(db, organizationId, projectId, pmMembershipId, ['accountable']);
  candidateMembershipId = await seedMembership(db, organizationId, await seedUser(db), ['member']);
  candidateProjectMemberId = await seedProjectMember(db, organizationId, projectId, candidateMembershipId);
});

const settings = () => tenantSettings(tenantFromVerifiedSession(organizationId));
const accountableRows = async () =>
  (
    await db.ownerPool.query<{ project_member_id: string }>(
      "SELECT project_member_id FROM raci_assignment WHERE project_id = $1 AND raci_role = 'accountable'",
      [projectId],
    )
  ).rows.map((r) => r.project_member_id);

describe('changing the Accountable while the candidate is being deactivated or removed (row locks)', () => {
  it('a change that starts during the deactivation of the candidate waits and then refuses NOT_PROJECT_MEMBER', async () => {
    const deactivation = await openTransaction(db.appPool, settings());
    const change = await openTransaction(db.appPool, settings());
    try {
      const probe = await lockProbe(change);
      await members.deactivate(deactivation.tx, principal(adminUserId, 'admin'), candidateMembershipId);
      let settled = false;
      const changing = raci
        .changeAccountable(change.tx, principal(pmUserId, 'projectManager'), projectId, candidateProjectMemberId)
        .finally(() => (settled = true));
      await expect
        .poll(
          probe(() => settled),
          { timeout: 10_000, interval: 50 },
        )
        .toBe('Lock');
      await deactivation.commit();
      const error: unknown = await changing.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('NOT_PROJECT_MEMBER');
    } finally {
      await change.rollback();
      await deactivation.rollback();
    }
    expect((await accountableRows()).length).toBe(1);
  });

  it('a deactivation of the candidate that starts during the change waits and then refuses ACCOUNTABLE_REQUIRED', async () => {
    const change = await openTransaction(db.appPool, settings());
    const deactivation = await openTransaction(db.appPool, settings());
    try {
      const probe = await lockProbe(deactivation);
      await raci.changeAccountable(
        change.tx,
        principal(pmUserId, 'projectManager'),
        projectId,
        candidateProjectMemberId,
      );
      let settled = false;
      const deactivating = members
        .deactivate(deactivation.tx, principal(adminUserId, 'admin'), candidateMembershipId)
        .finally(() => (settled = true));
      await expect
        .poll(
          probe(() => settled),
          { timeout: 10_000, interval: 50 },
        )
        .toBe('Lock');
      await change.commit();
      const error: unknown = await deactivating.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('ACCOUNTABLE_REQUIRED');
    } finally {
      await deactivation.rollback();
      await change.rollback();
    }
    expect(await accountableRows()).toEqual([candidateProjectMemberId]);
  });

  it('removing the candidate from the project during the change waits and then refuses ACCOUNTABLE_REQUIRED', async () => {
    const change = await openTransaction(db.appPool, settings());
    const removal = await openTransaction(db.appPool, settings());
    try {
      const probe = await lockProbe(removal);
      await raci.changeAccountable(
        change.tx,
        principal(pmUserId, 'projectManager'),
        projectId,
        candidateProjectMemberId,
      );
      let settled = false;
      const removing = projectMembers
        .remove(removal.tx, principal(pmUserId, 'projectManager'), projectId, candidateProjectMemberId)
        .finally(() => (settled = true));
      await expect
        .poll(
          probe(() => settled),
          { timeout: 10_000, interval: 50 },
        )
        .toBe('Lock');
      await change.commit();
      const error: unknown = await removing.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('ACCOUNTABLE_REQUIRED');
    } finally {
      await removal.rollback();
      await change.rollback();
    }
    expect(await accountableRows()).toEqual([candidateProjectMemberId]);
  });
});
