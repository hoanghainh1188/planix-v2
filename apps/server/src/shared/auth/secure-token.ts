import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 256-bit random token, base64url (session ids, invitation and password reset tokens). */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Only this SHA-256 digest is stored; the raw token lives in the cookie or email link. */
export function hashToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

/** Constant-time comparison of a presented token against a stored digest. */
export function tokenMatches(token: string, storedHash: Buffer): boolean {
  const presented = hashToken(token);
  return presented.length === storedHash.length && timingSafeEqual(presented, storedHash);
}
