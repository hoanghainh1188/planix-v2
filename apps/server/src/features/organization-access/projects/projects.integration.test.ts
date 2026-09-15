import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { tenantFromVerifiedSession } from '@planix/core/shared/tenant-context.ts';
import { AuditWriter, type AuditRecord } from '../../../shared/audit/audit-writer.ts';
import { systemClock } from '../../../shared/clock/clock.ts';
import { openTransaction, tenantSettings, type Tx } from '../../../shared/db/client.ts';
import { useTestDatabase } from '../../../test/postgres.ts';
import { RecordingMailSender } from '../../../test/recording-mail-sender.ts';
import { seedOrganization } from '../../../test/seed.ts';
import { signedInMember, type SignedInMember } from '../../../test/signed-in-member.ts';
import { createTestApp } from '../../../test/test-app.ts';
import { ProjectsRepository } from './projects.repository.ts';
import { ProjectsService } from './projects.service.ts';

const db = useTestDatabase();
let app: INestApplication;
let organizationId: string;
let pm: SignedInMember;

beforeAll(async () => {
  app = await createTestApp({ database: db, mailSender: new RecordingMailSender() });
});

afterAll(() => app.close());

beforeEach(async () => {
  organizationId = await seedOrganization(db, 'Acme');
  pm = await signedInMember(app, db, organizationId, ['projectManager']);
});

describe('projects (FR-016, FR-018, Q6, Q8)', () => {
  it('creates a project whose creator is a project member and the Accountable (Q6)', async () => {
    const response = await pm.browser.post('/projects', { name: 'Website' });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      project: {
        id: expect.any(String),
        name: 'Website',
        description: null,
        status: 'active',
        createdAt: expect.any(String),
      },
      accountable: {
        projectMemberId: expect.any(String),
        membershipId: pm.membershipId,
        userId: pm.userId,
        email: pm.email,
      },
    });
    const projectId: string = response.body.project.id;

    const detail = await pm.browser.get(`/projects/${projectId}`);
    expect(detail.status).toBe(200);
    expect(detail.body).toEqual(response.body);

    const audit = await db.ownerPool.query<{ actor_user_id: string; after: unknown }>(
      "SELECT actor_user_id, after FROM audit_entry WHERE action = 'project.create' AND target_id = $1",
      [projectId],
    );
    expect(audit.rows).toEqual([
      {
        actor_user_id: pm.userId,
        after: { name: 'Website', description: null, accountableMembershipId: pm.membershipId },
      },
    ]);
  });

  it('validates name "NOT NULL, 1–200 ký tự" and description "NULL, ≤ 5.000 ký tự"', async () => {
    expect((await pm.browser.post('/projects', { name: '' })).status).toBe(400);
    expect((await pm.browser.post('/projects', { name: '   ' })).status).toBe(400);
    expect((await pm.browser.post('/projects', { name: 'x'.repeat(201) })).status).toBe(400);
    expect((await pm.browser.post('/projects', {})).status).toBe(400);
    expect((await pm.browser.post('/projects', { name: 'x'.repeat(200) })).status).toBe(201);
    expect((await pm.browser.post('/projects', { name: 'Docs', description: 'd'.repeat(5001) })).status).toBe(400);
    const withDescription = await pm.browser.post('/projects', { name: 'Docs', description: 'd'.repeat(5000) });
    expect(withDescription.status).toBe(201);
    expect(withDescription.body.project.description).toHaveLength(5000);
  });

  it('lets only portfolio leads and project managers create projects', async () => {
    for (const roles of [['admin'], ['functionalManager'], ['member'], ['finance']]) {
      const caller = await signedInMember(app, db, organizationId, roles);
      const response = await caller.browser.post('/projects', { name: 'Nope' });
      expect(response.status, roles.join()).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    }
    const lead = await signedInMember(app, db, organizationId, ['portfolioLead']);
    expect((await lead.browser.post('/projects', { name: 'Portfolio pilot' })).status).toBe(201);
  });

  it('lists only projects the caller is an active member of — admins get no exception (FR-016, Q8)', async () => {
    const mine = (await pm.browser.post('/projects', { name: 'Mine' })).body.project.id as string;
    const otherPm = await signedInMember(app, db, organizationId, ['projectManager']);
    await otherPm.browser.post('/projects', { name: 'Theirs' });
    const admin = await signedInMember(app, db, organizationId, ['admin']);

    const list = await pm.browser.get('/projects');
    expect(list.status).toBe(200);
    expect(list.body.items.map((p: { id: string }) => p.id)).toEqual([mine]);
    expect((await admin.browser.get('/projects')).body.items).toEqual([]);

    const adminDetail = await admin.browser.get(`/projects/${mine}`);
    expect(adminDetail.status).toBe(403);
    expect(adminDetail.body.error.code).toBe('FORBIDDEN');
    expect((await pm.browser.get(`/projects/${randomUUID()}`)).status).toBe(404);
    expect((await pm.browser.get('/projects/not-a-uuid')).status).toBe(404);
  });

  it('a portfolio lead who creates a project can add a project manager (decision portfolio-lead-manages-project-members)', async () => {
    const lead = await signedInMember(app, db, organizationId, ['portfolioLead']);
    const projectId = (await lead.browser.post('/projects', { name: 'Lead project' })).body.project.id as string;
    const added = await lead.browser.post(`/projects/${projectId}/members`, { membershipId: pm.membershipId });
    expect(added.status).toBe(201);
    expect((await pm.browser.get(`/projects/${projectId}`)).status).toBe(200);
  });

  it('creates project, project member and Accountable in one transaction — a failure leaves nothing', async () => {
    const failingAudit = new (class extends AuditWriter {
      override record(_tx: Tx, _entry: AuditRecord): Promise<void> {
        return Promise.reject(new Error('audit unavailable'));
      }
    })();
    const service = new ProjectsService(systemClock, failingAudit, new ProjectsRepository());
    const principal = {
      userId: pm.userId,
      organizationId,
      membershipStatus: 'active' as const,
      roles: new Set(['projectManager' as const]),
    };
    const name = `Atomic ${randomUUID().slice(0, 8)}`;
    const transaction = await openTransaction(db.appPool, tenantSettings(tenantFromVerifiedSession(organizationId)));
    try {
      await expect(service.create(transaction.tx, principal, { name })).rejects.toThrow('audit unavailable');
    } finally {
      await transaction.rollback();
    }
    const { rows } = await db.ownerPool.query('SELECT id FROM project WHERE name = $1', [name]);
    expect(rows).toEqual([]);
    const orphans = await db.ownerPool.query(
      'SELECT 1 FROM project_member pm LEFT JOIN project p ON p.id = pm.project_id WHERE p.id IS NULL',
    );
    expect(orphans.rowCount).toBe(0);
  });
});
