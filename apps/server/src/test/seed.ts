import { randomUUID } from 'node:crypto';
import type { Database } from '../shared/db/client.ts';

/** Owner-role seeding for integration tests only; bypasses the application to set up fixtures quickly. */
export async function seedUser(db: Database, email = `user-${randomUUID()}@test.local`): Promise<string> {
  const { rows } = await db.ownerPool.query<{ id: string }>(
    "INSERT INTO app_user (email, password_hash) VALUES ($1, 'not-a-real-hash') RETURNING id",
    [email],
  );
  return rows[0]!.id;
}

export async function seedOrganization(db: Database, name = `Org ${randomUUID().slice(0, 8)}`): Promise<string> {
  const operatorId = await seedUser(db);
  const { rows } = await db.ownerPool.query<{ id: string }>(
    'INSERT INTO organization (name, created_by_operator_id) VALUES ($1, $2) RETURNING id',
    [name, operatorId],
  );
  return rows[0]!.id;
}
