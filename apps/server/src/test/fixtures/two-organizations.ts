import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Database } from '../../shared/db/client.ts';
import { DAY } from '../fake-clock.ts';
import { seedInvitation, seedMembership, seedOrganization, seedProject, seedProjectMember, seedUser } from '../seed.ts';
import { signedInMember, type SignedInMember } from '../signed-in-member.ts';

/** Everything one organization owns, for cross-organization isolation tests (FR-001–003, SC-001, Q3). */
export interface OrganizationFixture {
  readonly organizationId: string;
  readonly name: string;
  readonly admin: SignedInMember;
  readonly projectManager: SignedInMember;
  readonly memberMembershipId: string;
  readonly memberEmail: string;
  readonly invitationId: string;
  readonly invitationEmail: string;
  readonly projectId: string;
  readonly projectMemberId: string;
  readonly auditEntryId: string;
}

export interface TwoOrganizations {
  readonly acme: OrganizationFixture;
  readonly beta: OrganizationFixture;
}

async function seedOrganizationFixture(
  app: INestApplication,
  db: Database,
  label: string,
): Promise<OrganizationFixture> {
  const suffix = randomUUID().slice(0, 8);
  const name = `${label} ${suffix}`;
  const organizationId = await seedOrganization(db, name);
  const domain = `${label.toLowerCase()}-${suffix}.test`;
  const admin = await signedInMember(app, db, organizationId, ['admin'], { email: `admin@${domain}` });
  const projectManager = await signedInMember(app, db, organizationId, ['projectManager'], { email: `pm@${domain}` });

  const memberEmail = `member@${domain}`;
  const memberMembershipId = await seedMembership(db, organizationId, await seedUser(db, memberEmail), ['member']);

  const invitationEmail = `invitee@${domain}`;
  await seedInvitation(db, {
    organizationId,
    email: invitationEmail,
    invitedByUserId: admin.userId,
    expiresAt: new Date(Date.now() + 7 * DAY),
  });
  const invitation = await db.ownerPool.query<{ id: string }>(
    'SELECT id FROM organization_invitation WHERE organization_id = $1 AND email = $2',
    [organizationId, invitationEmail],
  );

  const projectId = await seedProject(db, organizationId, projectManager.membershipId);
  const projectMemberId = await seedProjectMember(db, organizationId, projectId, projectManager.membershipId, [
    'accountable',
  ]);
  await seedProjectMember(db, organizationId, projectId, memberMembershipId, ['responsible']);

  const audit = await db.ownerPool.query<{ id: string }>(
    `INSERT INTO audit_entry (organization_id, actor_user_id, actor_kind, action, target_type, target_id, outcome)
     VALUES ($1, $2, 'user', 'fixture.seed', 'organization', $1, 'succeeded') RETURNING id`,
    [organizationId, admin.userId],
  );

  return {
    organizationId,
    name,
    admin,
    projectManager,
    memberMembershipId,
    memberEmail,
    invitationId: invitation.rows[0]!.id,
    invitationEmail,
    projectId,
    projectMemberId,
    auditEntryId: audit.rows[0]!.id,
  };
}

/** Acme and Beta, each with admin, project manager, member, pending invitation, project, members and Accountable. */
export async function seedTwoOrganizations(app: INestApplication, db: Database): Promise<TwoOrganizations> {
  const acme = await seedOrganizationFixture(app, db, 'Acme');
  const beta = await seedOrganizationFixture(app, db, 'Beta');
  return { acme, beta };
}

/** Rows per tenant table belonging to one organization — must not change when another organization acts. */
export async function tenantRowCounts(db: Database, organizationId: string): Promise<Record<string, number>> {
  const { rows: tables } = await db.ownerPool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'organization_id' ORDER BY table_name`,
  );
  const counts: Record<string, number> = {};
  for (const { table_name } of tables) {
    const { rows } = await db.ownerPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM ${JSON.stringify(table_name)} WHERE organization_id = $1`,
      [organizationId],
    );
    counts[table_name] = rows[0]!.count;
  }
  return counts;
}
