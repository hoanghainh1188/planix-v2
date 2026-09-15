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

export async function seedMembership(
  db: Database,
  organizationId: string,
  userId: string,
  roles: readonly string[] = ['member'],
): Promise<string> {
  const { rows } = await db.ownerPool.query<{ id: string }>(
    'INSERT INTO organization_membership (organization_id, user_id) VALUES ($1, $2) RETURNING id',
    [organizationId, userId],
  );
  const membershipId = rows[0]!.id;
  for (const role of roles) {
    await db.ownerPool.query('INSERT INTO membership_role (organization_id, membership_id, role) VALUES ($1, $2, $3)', [
      organizationId,
      membershipId,
      role,
    ]);
  }
  return membershipId;
}

export async function seedProject(db: Database, organizationId: string, creatorMembershipId: string): Promise<string> {
  const { rows } = await db.ownerPool.query<{ id: string }>(
    "INSERT INTO project (organization_id, name, created_by_membership_id) VALUES ($1, 'Seed project', $2) RETURNING id",
    [organizationId, creatorMembershipId],
  );
  return rows[0]!.id;
}

export async function seedProjectMember(
  db: Database,
  organizationId: string,
  projectId: string,
  membershipId: string,
  raciRoles: readonly string[] = [],
): Promise<string> {
  const { rows } = await db.ownerPool.query<{ id: string }>(
    'INSERT INTO project_member (organization_id, project_id, membership_id) VALUES ($1, $2, $3) RETURNING id',
    [organizationId, projectId, membershipId],
  );
  const projectMemberId = rows[0]!.id;
  for (const role of raciRoles) {
    await db.ownerPool.query(
      'INSERT INTO raci_assignment (organization_id, project_id, project_member_id, raci_role) VALUES ($1, $2, $3, $4)',
      [organizationId, projectId, projectMemberId, role],
    );
  }
  return projectMemberId;
}

export async function seedOperator(db: Database): Promise<string> {
  const userId = await seedUser(db);
  await db.ownerPool.query("INSERT INTO platform_operator_grant (user_id, granted_by) VALUES ($1, 'test')", [userId]);
  return userId;
}

export async function seedUserWithPassword(
  db: Database,
  email: string,
  password: string,
  options: { locale?: 'vi' | 'en' } = {},
): Promise<string> {
  const { PasswordHasher } = await import('../shared/auth/password-hasher.ts');
  const hash = await new PasswordHasher().hash(password);
  const { rows } = await db.ownerPool.query<{ id: string }>(
    'INSERT INTO app_user (email, password_hash, locale) VALUES ($1, $2, $3) RETURNING id',
    [email, hash, options.locale ?? 'vi'],
  );
  return rows[0]!.id;
}

export async function seedInvitation(
  db: Database,
  input: {
    organizationId: string;
    email: string;
    roles?: readonly string[];
    invitedByUserId: string;
    expiresAt: Date;
    status?: 'pending' | 'revoked' | 'accepted';
  },
): Promise<string> {
  const { generateToken, hashToken } = await import('../shared/auth/secure-token.ts');
  const token = generateToken();
  await db.ownerPool.query(
    `INSERT INTO organization_invitation
       (organization_id, email, roles, token_hash, status, expires_at, invited_by_user_id, invited_by_kind, accepted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'organizationAdmin', CASE WHEN $5 = 'accepted' THEN now() END)`,
    [
      input.organizationId,
      input.email,
      input.roles ?? ['member'],
      hashToken(token),
      input.status ?? 'pending',
      input.expiresAt,
      input.invitedByUserId,
    ],
  );
  return token;
}
