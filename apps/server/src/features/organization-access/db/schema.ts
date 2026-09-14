import { sql } from 'drizzle-orm';
import { customType, integer, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Drizzle mirror of drizzle/0003_identity_projects.sql (data-model.md). DDL, RLS and grants live in SQL. */
const citext = customType<{ data: string }>({ dataType: () => 'citext' });
const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });
const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const appUser = pgTable('app_user', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: citext('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  locale: text('locale', { enum: ['vi', 'en'] })
    .notNull()
    .default('vi'),
  timeZone: text('time_zone').notNull().default('Asia/Ho_Chi_Minh'),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  lockedUntil: timestamptz('locked_until'),
  lastActiveOrganizationId: uuid('last_active_organization_id'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

export const platformOperatorGrant = pgTable('platform_operator_grant', {
  userId: uuid('user_id').primaryKey(),
  grantedAt: timestamptz('granted_at').notNull().defaultNow(),
  grantedBy: text('granted_by').notNull(),
});

export const organization = pgTable('organization', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  status: text('status', { enum: ['active', 'suspended'] })
    .notNull()
    .default('active'),
  createdByOperatorId: uuid('created_by_operator_id').notNull(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

export const organizationMembership = pgTable('organization_membership', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull(),
  userId: uuid('user_id').notNull(),
  status: text('status', { enum: ['active', 'deactivated'] })
    .notNull()
    .default('active'),
  deactivatedAt: timestamptz('deactivated_at'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

export const membershipRole = pgTable(
  'membership_role',
  {
    organizationId: uuid('organization_id').notNull(),
    membershipId: uuid('membership_id').notNull(),
    role: text('role', {
      enum: ['admin', 'portfolioLead', 'projectManager', 'functionalManager', 'member', 'finance'],
    }).notNull(),
    grantedAt: timestamptz('granted_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.membershipId, t.role] })],
);

export const project = pgTable('project', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', { enum: ['active', 'archived'] })
    .notNull()
    .default('active'),
  createdByMembershipId: uuid('created_by_membership_id').notNull(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

export const projectMember = pgTable('project_member', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull(),
  projectId: uuid('project_id').notNull(),
  membershipId: uuid('membership_id').notNull(),
  status: text('status', { enum: ['active', 'removed'] })
    .notNull()
    .default('active'),
  addedAt: timestamptz('added_at').notNull().defaultNow(),
  removedAt: timestamptz('removed_at'),
});

export const raciAssignment = pgTable(
  'raci_assignment',
  {
    organizationId: uuid('organization_id').notNull(),
    projectId: uuid('project_id').notNull(),
    projectMemberId: uuid('project_member_id').notNull(),
    raciRole: text('raci_role', { enum: ['responsible', 'accountable', 'consulted', 'informed'] }).notNull(),
    assignedAt: timestamptz('assigned_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectMemberId, t.raciRole] })],
);

export const authSession = pgTable('auth_session', {
  idHash: bytea('id_hash').primaryKey(),
  userId: uuid('user_id').notNull(),
  activeOrganizationId: uuid('active_organization_id'),
  csrfTokenHash: bytea('csrf_token_hash').notNull(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  lastSeenAt: timestamptz('last_seen_at').notNull().defaultNow(),
});
