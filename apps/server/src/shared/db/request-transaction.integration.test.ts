import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tenantFromVerifiedSession } from '@planix/core/shared/tenant-context.ts';
import { useTestDatabase } from '../../test/postgres.ts';
import { seedOrganization } from '../../test/seed.ts';
import {
  commitRequestTransaction,
  onRequestCommit,
  openRequestTransaction,
  rollbackRequestTransaction,
} from './request-transaction.ts';

const db = useTestDatabase();
let organizationId: string;

beforeAll(async () => {
  organizationId = await seedOrganization(db);
  await db.ownerPool.query(`
    CREATE TABLE IF NOT EXISTS after_commit_probe (organization_id uuid NOT NULL, label text NOT NULL);
    GRANT SELECT, INSERT ON after_commit_probe TO planix_app;
  `);
});

afterAll(() => db.ownerPool.query('DROP TABLE IF EXISTS after_commit_probe'));

async function openFor(label: string) {
  const req = {};
  const tx = await openRequestTransaction(
    req,
    new EventEmitter() as unknown as Response,
    db,
    tenantFromVerifiedSession(organizationId),
  );
  await tx.client.query('INSERT INTO after_commit_probe (organization_id, label) VALUES ($1, $2)', [
    organizationId,
    label,
  ]);
  return req;
}

const committedLabels = async () =>
  (await db.ownerPool.query<{ label: string }>('SELECT label FROM after_commit_probe')).rows.map((r) => r.label);

describe('work scheduled after the request transaction commits (code review: invitation email)', () => {
  it('runs callbacks only after COMMIT, when the data is visible to other connections', async () => {
    const req = await openFor('committed');
    const seenAtCallback: string[][] = [];
    onRequestCommit(req, () => {
      void committedLabels().then((labels) => seenAtCallback.push(labels));
    });
    expect(seenAtCallback).toEqual([]);
    await commitRequestTransaction(req);
    await expect.poll(() => seenAtCallback.length).toBe(1);
    expect(seenAtCallback[0]).toContain('committed');
  });

  it('never runs callbacks when the transaction rolls back', async () => {
    const req = await openFor('rolled-back');
    let called = false;
    onRequestCommit(req, () => (called = true));
    await rollbackRequestTransaction(req);
    await commitRequestTransaction(req);
    expect(called).toBe(false);
    expect(await committedLabels()).not.toContain('rolled-back');
  });

  it('never runs callbacks when the response closed and rolled back before the handler committed', async () => {
    const req = {};
    const res = new EventEmitter();
    const tx = await openRequestTransaction(
      req,
      res as unknown as Response,
      db,
      tenantFromVerifiedSession(organizationId),
    );
    await tx.client.query('INSERT INTO after_commit_probe (organization_id, label) VALUES ($1, $2)', [
      organizationId,
      'client-disconnected',
    ]);
    let called = false;
    onRequestCommit(req, () => (called = true));
    res.emit('close');
    await expect.poll(async () => (await committedLabels()).includes('client-disconnected')).toBe(false);
    await commitRequestTransaction(req);
    expect(called).toBe(false);
    expect(await committedLabels()).not.toContain('client-disconnected');
  });

  it('a failing callback does not break the commit or other callbacks', async () => {
    const req = await openFor('failing-callback');
    let secondCalled = false;
    onRequestCommit(req, () => {
      throw new Error('boom');
    });
    onRequestCommit(req, () => (secondCalled = true));
    await expect(commitRequestTransaction(req)).resolves.toBeUndefined();
    expect(secondCalled).toBe(true);
  });
});
