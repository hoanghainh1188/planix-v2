import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, httpStatusOf } from './error-codes.ts';

const CONTRACT = fileURLToPath(
  new URL('../../../../../specs/20260914-224646-organization-access/contracts/api.md', import.meta.url),
);

function contractErrorCodes(): string[] {
  const text = readFileSync(CONTRACT, 'utf8');
  const section = text.split('## Mã lỗi')[1] ?? '';
  return [...section.matchAll(/`([A-Z_]+)`/g)].map((m) => m[1] ?? '');
}

describe('error codes', () => {
  it('match the contract list exactly (contracts/api.md §Mã lỗi, including INTERNAL_ERROR)', () => {
    expect([...ERROR_CODES].sort()).toEqual([...new Set(contractErrorCodes())].sort());
    expect(ERROR_CODES).toContain('INTERNAL_ERROR');
  });

  it.each([
    ['AUTH_REQUIRED', 401],
    ['AUTH_INVALID_CREDENTIALS', 401],
    ['RATE_LIMITED', 429],
    ['CSRF_INVALID', 403],
    ['ACTIVE_ORGANIZATION_REQUIRED', 409],
    ['MEMBERSHIP_INACTIVE', 403],
    ['FORBIDDEN', 403],
    ['RESOURCE_NOT_FOUND', 404],
    ['VALIDATION_FAILED', 400],
    ['PASSWORD_POLICY_VIOLATION', 400],
    ['TOKEN_INVALID_OR_EXPIRED', 410],
    ['INVITATION_EMAIL_MISMATCH', 403],
    ['INVITATION_NOT_PENDING', 409],
    ['ALREADY_MEMBER', 409],
    ['MEMBER_DEACTIVATED_USE_REACTIVATE', 409],
    ['MEMBERSHIP_NOT_DEACTIVATED', 409],
    ['LAST_ADMIN_REQUIRED', 409],
    ['ACCOUNTABLE_REQUIRED', 409],
    ['ALREADY_PROJECT_MEMBER', 409],
    ['NOT_PROJECT_MEMBER', 409],
    ['PAYLOAD_TOO_LARGE', 413],
    ['INTERNAL_ERROR', 500],
  ] as const)('%s → HTTP %i', (code, status) => {
    expect(httpStatusOf(code)).toBe(status);
  });
});
