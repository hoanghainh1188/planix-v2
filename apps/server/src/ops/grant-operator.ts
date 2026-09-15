import { userInfo } from 'node:os';
import { parseArgs } from 'node:util';
import type { Database } from '../shared/db/client.ts';

/**
 * Operations CLI: grant the Platform Operator role (research R11). No UI exists for this on purpose.
 * Usage: npm run ops:grant-operator -- --email operator@example.com
 * Runs with the owner role because platform_operator_grant is not writable by application roles.
 */
export async function grantOperator(
  db: Database,
  email: string,
  grantedBy: string,
): Promise<{ userId: string; alreadyGranted: boolean }> {
  const client = await db.ownerPool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query<{ id: string }>('SELECT id FROM app_user WHERE email = $1', [email]);
    const userId = user.rows[0]?.id;
    if (userId === undefined)
      throw new Error(`No account with email ${email}; the operator must accept an invitation first`);
    const inserted = await client.query(
      'INSERT INTO platform_operator_grant (user_id, granted_by) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING',
      [userId, grantedBy],
    );
    const alreadyGranted = inserted.rowCount === 0;
    if (!alreadyGranted) {
      await client.query(
        `INSERT INTO audit_entry (organization_id, actor_user_id, actor_kind, action, target_type, target_id, outcome, after)
         VALUES (NULL, NULL, 'system', 'platform.operator.grant', 'appUser', $1, 'succeeded', $2::jsonb)`,
        [userId, JSON.stringify({ grantedBy })],
      );
    }
    await client.query('COMMIT');
    return { userId, alreadyGranted };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { email: { type: 'string' } } });
  if (values.email === undefined) throw new Error('Usage: npm run ops:grant-operator -- --email <email>');
  const { loadServerConfig } = await import('../config.ts');
  const { createDatabase } = await import('../shared/db/client.ts');
  const db = createDatabase(loadServerConfig().databaseUrls);
  try {
    const result = await grantOperator(db, values.email, userInfo().username);
    process.stdout.write(
      `${result.alreadyGranted ? 'Already an operator' : 'Granted platform operator'}: ${values.email}\n`,
    );
  } finally {
    await db.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
