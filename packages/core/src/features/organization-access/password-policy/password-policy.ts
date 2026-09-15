import { COMMON_PASSWORDS } from './common-passwords.ts';

export const MIN_PASSWORD_LENGTH = 12;

export type PasswordPolicyRule = 'MIN_LENGTH_12' | 'COMMON_PASSWORD';

export type PasswordPolicyResult = { readonly ok: true } | { readonly ok: false; readonly rule: PasswordPolicyRule };

/** Length + common-password check (NIST 800-63B style; no composition rules) — FR-006. */
export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  if ([...password].length < MIN_PASSWORD_LENGTH) return { ok: false, rule: 'MIN_LENGTH_12' };
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return { ok: false, rule: 'COMMON_PASSWORD' };
  return { ok: true };
}
