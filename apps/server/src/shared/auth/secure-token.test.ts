import { describe, expect, it } from 'vitest';
import { generateToken, hashToken, tokenMatches } from './secure-token.ts';

describe('secure tokens (R4)', () => {
  it('generates 256-bit url-safe random tokens', () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });

  it('never repeats', () => {
    const tokens = new Set(Array.from({ length: 1000 }, generateToken));
    expect(tokens.size).toBe(1000);
  });

  it('stores only a SHA-256 hash', () => {
    const token = generateToken();
    const hash = hashToken(token);
    expect(hash).toHaveLength(32);
    expect(hash.toString('base64url')).not.toBe(token);
    expect(hashToken(token).equals(hash)).toBe(true);
  });

  it('compares a presented token to a stored hash', () => {
    const token = generateToken();
    const hash = hashToken(token);
    expect(tokenMatches(token, hash)).toBe(true);
    expect(tokenMatches(generateToken(), hash)).toBe(false);
    expect(tokenMatches('', hash)).toBe(false);
    expect(tokenMatches(token, Buffer.alloc(16))).toBe(false);
  });
});
