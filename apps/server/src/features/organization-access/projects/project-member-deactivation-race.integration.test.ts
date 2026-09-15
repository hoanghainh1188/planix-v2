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

const db = useTestDatabase();
let app: INestApplication;
let organizationId: string;
let adminUserId: string;
let pmUserId: string;
let projectId: string;
let targetMembershipId: string;

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
  targetMembershipId = await seedMembership(db, organizationId, await seedUser(db), ['member']);
});

const settings = () => tenantSettings(tenantFromVerifiedSession(organizationId));
const activeProjectMembers = async () =>
  (
    await db.ownerPool.query(
      "SELECT 1 FROM project_member WHERE project_id = $1 AND membership_id = $2 AND status = 'active'",
      [projectId, targetMembershipId],
    )
  ).rowCount;

describe('adding a project member while the membership is being deactivated (code review: TOCTOU)', () => {
  it('an add that starts during a deactivation waits for it and then refuses with 404', async () => {
    const deactivation = await openTransaction(db.appPool, settings());
    const addition = await openTransaction(db.appPool, settings());
    try {
      const probe = await lockProbe(addition);
      await members.deactivate(deactivation.tx, principal(adminUserId, 'admin'), targetMembershipId);
      let settled = false;
      const adding = projectMembers
        .add(addition.tx, principal(pmUserId, 'projectManager'), projectId, targetMembershipId)
        .then(
          () => undefined,
          (e: unknown) => e,
        )
        .finally(() => (settled = true));
      await expect
        .poll(
          probe(() => settled),
          { timeout: 10_000, interval: 50 },
        )
        .toBe('Lock');
      await deactivation.commit();
      const error: unknown = await adding;
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('RESOURCE_NOT_FOUND');
    } finally {
      await addition.rollback();
      await deactivation.rollback();
    }
    expect(await activeProjectMembers()).toBe(0);
  });

  it('a deactivation that starts during an add waits for it and then removes the new project member', async () => {
    const addition = await openTransaction(db.appPool, settings());
    const deactivation = await openTransaction(db.appPool, settings());
    try {
      const probe = await lockProbe(deactivation);
      await projectMembers.add(addition.tx, principal(pmUserId, 'projectManager'), projectId, targetMembershipId);
      let settled = false;
      const deactivating = members
        .deactivate(deactivation.tx, principal(adminUserId, 'admin'), targetMembershipId)
        .finally(() => (settled = true));
      await expect
        .poll(
          probe(() => settled),
          { timeout: 10_000, interval: 50 },
        )
        .toBe('Lock');
      await addition.commit();
      await deactivating;
      await deactivation.commit();
    } finally {
      await deactivation.rollback();
      await addition.rollback();
    }
    expect(await activeProjectMembers()).toBe(0);
  });
});
