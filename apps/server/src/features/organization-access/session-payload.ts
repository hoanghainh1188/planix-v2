import type { SessionMembership, SessionPayload } from '@planix/core/features/organization-access/schemas/auth.ts';
import { withAnonymousTransaction, withUserTransaction, type Database } from '../../shared/db/client.ts';

export interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly locale: 'vi' | 'en';
  readonly timeZone: string;
  readonly lastActiveOrganizationId: string | null;
}

export async function loadUser(db: Database, userId: string): Promise<UserRecord | undefined> {
  const { rows } = await withAnonymousTransaction(db, (tx) =>
    tx.client.query<{
      id: string;
      email: string;
      locale: 'vi' | 'en';
      time_zone: string;
      last_active_organization_id: string | null;
    }>('SELECT id, email, locale, time_zone, last_active_organization_id FROM app_user WHERE id = $1', [userId]),
  );
  const row = rows[0];
  return row === undefined
    ? undefined
    : {
        id: row.id,
        email: row.email,
        locale: row.locale,
        timeZone: row.time_zone,
        lastActiveOrganizationId: row.last_active_organization_id,
      };
}

/** The caller's own memberships in every organization, read through the user-scoped path (R3 path 1). */
export async function loadMemberships(db: Database, userId: string): Promise<SessionMembership[]> {
  const { rows } = await withUserTransaction(db, userId, (tx) =>
    tx.client.query<{ organization_id: string; name: string; status: 'active' | 'deactivated'; roles: string[] }>(
      `SELECT m.organization_id, o.name, m.status,
              coalesce(array_agg(r.role ORDER BY r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles
         FROM organization_membership m
         JOIN organization o ON o.id = m.organization_id
         LEFT JOIN membership_role r ON r.membership_id = m.id
        WHERE m.user_id = $1
        GROUP BY m.id, m.organization_id, o.name, m.status, m.created_at
        ORDER BY m.created_at`,
      [userId],
    ),
  );
  return rows.map((r) => ({
    organizationId: r.organization_id,
    organizationName: r.name,
    status: r.status,
    roles: r.roles,
  }));
}

export async function buildSessionPayload(
  db: Database,
  user: UserRecord,
  activeOrganizationId: string | null,
): Promise<SessionPayload> {
  const memberships = await loadMemberships(db, user.id);
  const stillActive = memberships.some((m) => m.organizationId === activeOrganizationId && m.status === 'active');
  return {
    user: { id: user.id, email: user.email, locale: user.locale, timeZone: user.timeZone },
    memberships,
    activeOrganizationId: stillActive ? activeOrganizationId : null,
  };
}
