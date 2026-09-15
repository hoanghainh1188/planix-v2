import type { ErrorCode } from '@planix/core/shared/errors/error-codes.ts';

export type ErrorParams = Readonly<Record<string, string | number | boolean | readonly string[]>>;

/** Expected business failure; rendered as `{ error: { code, params } }` — never with a display message. */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly params: ErrorParams = {},
  ) {
    super(code);
    this.name = 'DomainError';
  }
}
