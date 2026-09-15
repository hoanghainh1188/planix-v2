import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createDatabase } from '../db/client.ts';
import { RecordingMailSender } from '../../test/recording-mail-sender.ts';
import { seedOrganization, seedProject } from '../../test/seed.ts';
import { signedInMember } from '../../test/signed-in-member.ts';
import { createTestApp } from '../../test/test-app.ts';

/** A tiny application pool makes a request that needs two connections at once deadlock immediately. */
const db = createDatabase(inject('databaseUrls'), { appPoolMax: 2 });
let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp({ database: db, mailSender: new RecordingMailSender() });
});

afterAll(async () => {
  await app.close();
  await db.close();
});

const withinSeconds = <T>(work: Promise<T>, seconds: number) =>
  Promise.race([work, new Promise<'hung'>((resolve) => setTimeout(() => resolve('hung'), seconds * 1000))]);

describe('a denied request never needs a second database connection (security review: pool deadlock)', () => {
  it('answers concurrent denials with 403 and still audits them, even when they fill the pool', async () => {
    const organizationId = await seedOrganization(db, 'Acme');
    const owner = await signedInMember(app, db, organizationId, ['projectManager']);
    const projectId = await seedProject(db, organizationId, owner.membershipId);
    const outsiders = await Promise.all([1, 2, 3].map(() => signedInMember(app, db, organizationId, ['member'])));

    const answers = await withinSeconds(
      Promise.all(outsiders.map((outsider) => outsider.browser.get(`/projects/${projectId}`))),
      5,
    );
    expect(answers === 'hung' ? answers : answers.map((r) => r.status)).toEqual([403, 403, 403]);

    const { rows } = await db.ownerPool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM audit_entry WHERE outcome = 'denied' AND target_id = $1",
      [projectId],
    );
    expect(rows[0]!.count).toBe(3);

    // The pool is healthy afterwards.
    const after = await withinSeconds(owner.browser.get(`/projects/${randomUUID()}`), 5);
    expect(after === 'hung' ? after : after.status).toBe(404);
  });

  it('answers concurrent requests from deactivated members with 403 without exhausting the pool', async () => {
    const organizationId = await seedOrganization(db, 'Beta');
    const deactivated = await Promise.all([1, 2, 3].map(() => signedInMember(app, db, organizationId, ['member'])));
    await db.ownerPool.query(
      "UPDATE organization_membership SET status = 'deactivated', deactivated_at = now() WHERE id = ANY($1)",
      [deactivated.map((m) => m.membershipId)],
    );
    const answers = await withinSeconds(Promise.all(deactivated.map((m) => m.browser.get('/org/members'))), 5);
    expect(answers === 'hung' ? answers : answers.map((r) => [r.status, r.body.error.code])).toEqual([
      [403, 'MEMBERSHIP_INACTIVE'],
      [403, 'MEMBERSHIP_INACTIVE'],
      [403, 'MEMBERSHIP_INACTIVE'],
    ]);
  });
});
