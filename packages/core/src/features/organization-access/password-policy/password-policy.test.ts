import { describe, expect, it } from 'vitest';
import { checkPasswordPolicy, MIN_PASSWORD_LENGTH } from './password-policy.ts';

describe('password policy (FR-006, decision password-and-session-policy)', () => {
  it('requires at least 12 characters', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(12);
    expect(checkPasswordPolicy('Abcdefgh123')).toEqual({ ok: false, rule: 'MIN_LENGTH_12' });
    expect(checkPasswordPolicy('')).toEqual({ ok: false, rule: 'MIN_LENGTH_12' });
  });

  it('counts characters, not bytes', () => {
    expect(checkPasswordPolicy('mậtkhẩuđủdài').ok).toBe(true);
  });

  it.each(['password1234', 'Password1234', '123456789012', 'qwertyuiopas', 'iloveyou1234'])(
    'rejects the common password %s regardless of case',
    (password) => {
      expect(checkPasswordPolicy(password)).toEqual({ ok: false, rule: 'COMMON_PASSWORD' });
    },
  );

  it('accepts a 12-character uncommon password without requiring special characters', () => {
    expect(checkPasswordPolicy('lanternfjord')).toEqual({ ok: true });
    expect(checkPasswordPolicy('correct horse battery')).toEqual({ ok: true });
  });
});
