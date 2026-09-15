import type { z } from 'zod';
import { stripSensitive } from '@planix/core/shared/sensitive-field/sensitive-field.ts';
import type { Tx } from '../db/client.ts';

/** Keys that must never reach the audit trail, at any depth (FR-028). */
const FORBIDDEN_KEYS = new Set([
  'password',
  'passwordHash',
  'newPassword',
  'token',
  'tokenHash',
  'idHash',
  'csrfTokenHash',
]);

export interface AuditRecord {
  readonly organizationId: string | null;
  readonly actorUserId: string | null;
  readonly actorKind: 'user' | 'platformOperator' | 'system';
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string | null;
  readonly outcome: 'succeeded' | 'denied';
  readonly before?: unknown;
  readonly after?: unknown;
  /** Schema of before/after; its sensitive fields are always removed from the audit copy. */
  readonly snapshotSchema?: z.ZodType;
}

function withoutForbiddenKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutForbiddenKeys);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !FORBIDDEN_KEYS.has(key))
        .map(([key, nested]) => [key, withoutForbiddenKeys(nested)]),
    );
  }
  return value;
}

function sanitize(value: unknown, schema: z.ZodType | undefined): string | null {
  if (value === undefined) return null;
  const withoutSensitive =
    schema === undefined ? value : stripSensitive(schema, value, () => false, { undeclaredKeys: 'keep' });
  return JSON.stringify(withoutForbiddenKeys(withoutSensitive));
}

export const AUDIT_WRITER = Symbol('AuditWriter');

/** Append-only audit writer; always writes inside the caller's transaction (research R8). */
export class AuditWriter {
  async record(tx: Tx, entry: AuditRecord): Promise<void> {
    await tx.client.query(
      `INSERT INTO audit_entry
         (organization_id, actor_user_id, actor_kind, action, target_type, target_id, outcome, before, after)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)`,
      [
        entry.organizationId,
        entry.actorUserId,
        entry.actorKind,
        entry.action,
        entry.targetType,
        entry.targetId,
        entry.outcome,
        sanitize(entry.before, entry.snapshotSchema),
        sanitize(entry.after, entry.snapshotSchema),
      ],
    );
  }
}
