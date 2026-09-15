import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../test/postgres.ts';
import { RecordingMailSender } from '../../test/recording-mail-sender.ts';
import { SampleFinancialModule } from '../../test/sample-financial.module.ts';
import { seedOrganization } from '../../test/seed.ts';
import { signedInMember, type SignedInMember } from '../../test/signed-in-member.ts';
import { createTestApp } from '../../test/test-app.ts';

const db = useTestDatabase();
let app: INestApplication;
let projectId: string;
let finance: SignedInMember;
let member: SignedInMember;

const samplePath = () => `/projects/${projectId}/sample-financials`;

beforeAll(async () => {
  // The sample module exists only in this test application; production AppModule never imports it.
  app = await createTestApp({
    database: db,
    mailSender: new RecordingMailSender(),
    extraModules: [SampleFinancialModule],
  });
  const organizationId = await seedOrganization(db, 'Acme');
  const pm = await signedInMember(app, db, organizationId, ['projectManager']);
  projectId = (await pm.browser.post('/projects', { name: 'Website' })).body.project.id;
  finance = await signedInMember(app, db, organizationId, ['finance']);
  member = await signedInMember(app, db, organizationId, ['member']);
  for (const person of [finance, member]) {
    await pm.browser.post(`/projects/${projectId}/members`, { membershipId: person.membershipId });
  }
});

afterAll(() => app.close());

describe('sensitive fields end to end over HTTP (FR-025, FR-026, FR-028, SC-005, Q15)', () => {
  it('shows budgetAtCompletion as a decimal string to a finance project member', async () => {
    const detail = await finance.browser.get(samplePath());
    expect(detail.status).toBe(200);
    expect(detail.body).toEqual({ name: 'Sample', budgetAtCompletion: '1000.0000' });
    expect(typeof detail.body.budgetAtCompletion).toBe('string');

    const list = await finance.browser.get(`${samplePath()}/list`);
    expect(list.body.items.every((item: object) => 'budgetAtCompletion' in item)).toBe(true);

    const error = await finance.browser.get(`${samplePath()}/error`);
    expect(error.body.error).toEqual({
      code: 'VALIDATION_FAILED',
      params: { name: 'Sample', budgetAtCompletion: '1000.0000' },
    });
  });

  it('removes the key — not just the value — from detail, list and error bodies for a plain member', async () => {
    const detail = await member.browser.get(samplePath());
    expect(detail.status).toBe(200);
    expect(detail.body).toEqual({ name: 'Sample' });
    expect(detail.text).not.toContain('budgetAtCompletion');
    expect(detail.text).not.toContain('1000.0000');

    const list = await member.browser.get(`${samplePath()}/list`);
    expect(list.body.items).toEqual([{ name: 'Sample' }, { name: 'Sample (copy)' }]);
    expect(list.text).not.toContain('budgetAtCompletion');

    const error = await member.browser.get(`${samplePath()}/error`);
    expect(error.status).toBe(400);
    expect(error.body.error).toEqual({ code: 'VALIDATION_FAILED', params: { name: 'Sample' } });
    expect(error.text).not.toContain('1000.0000');
  });

  it('refuses a member writing the field with 403 and leaves the data unchanged', async () => {
    const refused = await member.browser.put(samplePath(), { budgetAtCompletion: '9999.0000' });
    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe('FORBIDDEN');
    expect((await finance.browser.get(samplePath())).body.budgetAtCompletion).toBe('1000.0000');

    const allowed = await member.browser.put(samplePath(), { name: 'Renamed by member' });
    expect(allowed.status).toBe(200);
    expect(allowed.body).toEqual({ name: 'Renamed by member' });
  });

  it('lets finance write a decimal string; the audit trail never contains the sensitive field or its values', async () => {
    expect((await finance.browser.put(samplePath(), { budgetAtCompletion: 2500 })).status).toBe(400);
    expect((await finance.browser.put(samplePath(), { budgetAtCompletion: '2,500' })).status).toBe(400);

    const updated = await finance.browser.put(samplePath(), { budgetAtCompletion: '2500.5000' });
    expect(updated.status).toBe(200);
    // Stored and returned in Decimal's canonical full-precision form.
    expect(updated.body.budgetAtCompletion).toBe('2500.5');

    const { rows } = await db.ownerPool.query<{ before: unknown; after: unknown }>(
      "SELECT before, after FROM audit_entry WHERE action = 'sample.financial.update' AND target_id = $1 ORDER BY occurred_at",
      [projectId],
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      expect(row.before).not.toHaveProperty('budgetAtCompletion');
      expect(row.after).not.toHaveProperty('budgetAtCompletion');
    }
    const raw = JSON.stringify(rows);
    for (const value of ['1000.0000', '2500.5', '9999.0000']) expect(raw).not.toContain(value);
  });

  it('never returns keys the response schema does not declare, whoever asks (security review)', async () => {
    for (const caller of [finance, member]) {
      const raw = await caller.browser.get(`${samplePath()}/raw`);
      expect(raw.status).toBe(200);
      expect(raw.text).not.toContain('internalCostBasis');
      expect(raw.text).not.toContain('750.0000');
    }
  });

  it('keeps primitive error params but drops nested rows from error bodies, whoever asks (option A)', async () => {
    for (const caller of [finance, member]) {
      const error = await caller.browser.get(`${samplePath()}/error-with-row`);
      expect(error.status).toBe(409);
      expect(error.body.error).toEqual({ code: 'ACCOUNTABLE_REQUIRED', params: { projectIds: [projectId] } });
    }
  });
});
