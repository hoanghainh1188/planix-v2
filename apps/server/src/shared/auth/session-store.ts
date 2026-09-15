import type { ClockPort } from '../clock/clock.ts';
import { withAnonymousTransaction, type ApplicationDatabase } from '../db/client.ts';
import { generateToken, hashToken } from './secure-token.ts';

export const SESSION_IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000;
export const SESSION_STORE = Symbol('SessionStore');

export interface StoredSession {
  readonly idHash: Buffer;
  readonly userId: string;
  readonly activeOrganizationId: string | null;
  readonly csrfTokenHash: Buffer;
  readonly lastSeenAt: Date;
}

/** Server-side sessions (research R4): only SHA-256 digests of the session id and CSRF token are stored. */
export class SessionStore {
  constructor(
    private readonly db: ApplicationDatabase,
    private readonly clock: ClockPort,
  ) {}

  async create(
    userId: string,
    activeOrganizationId: string | null,
  ): Promise<{ sessionToken: string; csrfToken: string }> {
    const sessionToken = generateToken();
    const csrfToken = generateToken();
    const now = this.clock.now();
    await withAnonymousTransaction(this.db, (tx) =>
      tx.client.query(
        `INSERT INTO auth_session (id_hash, user_id, active_organization_id, csrf_token_hash, created_at, last_seen_at)
         VALUES ($1, $2, $3, $4, $5, $5)`,
        [hashToken(sessionToken), userId, activeOrganizationId, hashToken(csrfToken), now],
      ),
    );
    return { sessionToken, csrfToken };
  }

  /** Returns the live session and slides its idle window, or deletes it when expired. */
  async resolve(sessionToken: string): Promise<StoredSession | undefined> {
    const idHash = hashToken(sessionToken);
    const now = this.clock.now();
    return withAnonymousTransaction(this.db, async (tx) => {
      const { rows } = await tx.client.query<{
        user_id: string;
        active_organization_id: string | null;
        csrf_token_hash: Buffer;
        last_seen_at: Date;
      }>('SELECT user_id, active_organization_id, csrf_token_hash, last_seen_at FROM auth_session WHERE id_hash = $1', [
        idHash,
      ]);
      const row = rows[0];
      if (row === undefined) return undefined;
      if (now.getTime() - row.last_seen_at.getTime() > SESSION_IDLE_TIMEOUT_MS) {
        await tx.client.query('DELETE FROM auth_session WHERE id_hash = $1', [idHash]);
        return undefined;
      }
      await tx.client.query('UPDATE auth_session SET last_seen_at = $2 WHERE id_hash = $1', [idHash, now]);
      return {
        idHash,
        userId: row.user_id,
        activeOrganizationId: row.active_organization_id,
        csrfTokenHash: row.csrf_token_hash,
        lastSeenAt: now,
      };
    });
  }

  async setActiveOrganization(idHash: Buffer, organizationId: string | null): Promise<void> {
    await withAnonymousTransaction(this.db, (tx) =>
      tx.client.query('UPDATE auth_session SET active_organization_id = $2 WHERE id_hash = $1', [
        idHash,
        organizationId,
      ]),
    );
  }

  async delete(idHash: Buffer): Promise<void> {
    await withAnonymousTransaction(this.db, (tx) =>
      tx.client.query('DELETE FROM auth_session WHERE id_hash = $1', [idHash]),
    );
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await withAnonymousTransaction(this.db, (tx) =>
      tx.client.query('DELETE FROM auth_session WHERE user_id = $1', [userId]),
    );
  }
}
