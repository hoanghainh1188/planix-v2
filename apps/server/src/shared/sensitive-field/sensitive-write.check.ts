import type { z } from 'zod';
import { findSensitiveWrites, type PermissionCheck } from '@planix/core/shared/sensitive-field/sensitive-field.ts';
import { DomainError } from '../errors/domain-error.ts';

/** Rejects a request body that writes a sensitive field the caller may not write (FR-025). */
export function assertNoSensitiveWrites(schema: z.ZodType, body: unknown, can: PermissionCheck): void {
  if (findSensitiveWrites(schema, body, can).length > 0) throw new DomainError('FORBIDDEN');
}
