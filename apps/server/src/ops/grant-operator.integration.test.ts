import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../test/postgres.ts';
import { seedUser } from '../test/seed.ts';
import { grantOperator } from './grant-operator.ts';

const db = useTestDatabase();

describe('ops:grant-operator (R11)', () => {
  it('grants the platform operator role to an existing account and audits it as system', async () => {
    const email = `ops-${randomUUID().slice(0, 8)}@planix.test`;
    const userId = await seedUser(db, email);
    await expect(grantOperator(db, email.toUpperCase(), 'alice')).resolves.toEqual({ userId, alreadyGranted: false });
    await expect(grantOperator(db, email, 'alice')).resolves.toEqual({ userId, alreadyGranted: true });

    const { rows } = await db.ownerPool.query<{ granted_by: string }>(
      'SELECT granted_by FROM platform_operator_grant WHERE user_id = $1',
      [userId],
    );
    expect(rows).toEqual([{ granted_by: 'alice' }]);
    const audit = await db.ownerPool.query<{ actor_kind: string }>(
      "SELECT actor_kind FROM audit_entry WHERE action = 'platform.operator.grant' AND target_id = $1",
      [userId],
    );
    expect(audit.rows).toEqual([{ actor_kind: 'system' }]);
  });

  it('refuses unknown accounts', async () => {
    await expect(grantOperator(db, `nobody-${randomUUID()}@planix.test`, 'alice')).rejects.toThrow(/No account/);
  });
});
