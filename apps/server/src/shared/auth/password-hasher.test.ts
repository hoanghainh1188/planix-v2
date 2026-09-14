import { describe, expect, it } from 'vitest';
import { PasswordHasher, type Argon2Port } from './password-hasher.ts';

const hasher = new PasswordHasher();

describe('PasswordHasher (argon2id, FR-008)', () => {
  it('hashes with argon2id and verifies', async () => {
    const hash = await hasher.hash('CorrectHorseBattery9');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await hasher.verify(hash, 'CorrectHorseBattery9')).toBe(true);
    expect(await hasher.verify(hash, 'WrongHorseBattery99')).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hasher.hash('same-password-123')).not.toBe(await hasher.hash('same-password-123'));
  });

  it('still runs a full verification when the user does not exist', async () => {
    const calls: string[] = [];
    const real = new PasswordHasher();
    const counting: Argon2Port = {
      hash: (password) => real.hash(password),
      verify: async (hash, password) => {
        calls.push(hash);
        return real.verify(hash, password);
      },
    };
    const guarded = new PasswordHasher(counting);
    expect(await guarded.verifyOrDummy(undefined, 'whatever-password')).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.startsWith('$argon2id$')).toBe(true);
  });

  it('verifies a real hash through verifyOrDummy', async () => {
    const hash = await hasher.hash('CorrectHorseBattery9');
    expect(await hasher.verifyOrDummy(hash, 'CorrectHorseBattery9')).toBe(true);
  });

  it('returns false for malformed stored hashes instead of throwing', async () => {
    expect(await hasher.verify('not-a-hash', 'x')).toBe(false);
  });
});
