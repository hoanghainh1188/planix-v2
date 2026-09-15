import type { z } from 'zod';
import { DomainError } from '../errors/domain-error.ts';

/** Validates an untrusted request body at the boundary; any schema failure is VALIDATION_FAILED. */
export function parseBody<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body);
  if (!result.success) throw new DomainError('VALIDATION_FAILED');
  return result.data;
}
