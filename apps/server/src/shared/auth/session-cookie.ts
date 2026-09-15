import type { Request, Response } from 'express';
import { generateToken } from './secure-token.ts';

export const SESSION_COOKIE = 'planix_session';
export const CSRF_COOKIE = 'planix_csrf';

export function parseCookies(header: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of (header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0) cookies.set(part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim()));
  }
  return cookies;
}

/** Session cookie: HttpOnly, Secure, SameSite=Lax; no Max-Age (no "remember me" — FR-007). */
export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/** CSRF cookie is readable by the web app so it can echo it in X-CSRF-Token (double submit). */
export function csrfCookie(token: string): string {
  return `${CSRF_COOKIE}=${encodeURIComponent(token)}; Path=/; Secure; SameSite=Lax`;
}

function appendSetCookie(res: Response, cookie: string): void {
  const existing = res.getHeader('Set-Cookie');
  const list = existing === undefined ? [] : ([] as string[]).concat(existing as string | string[]);
  res.setHeader('Set-Cookie', [...list, cookie]);
}

export function setSessionCookies(res: Response, sessionToken: string, csrfToken: string): void {
  appendSetCookie(res, sessionCookie(sessionToken));
  appendSetCookie(res, csrfCookie(csrfToken));
}

export function clearSessionCookie(res: Response): void {
  appendSetCookie(res, clearedSessionCookie());
}

/** Issues an anonymous CSRF cookie when the browser has none (research R4). */
export function ensureCsrfCookie(req: Request, res: Response): void {
  if (!parseCookies(req.headers.cookie).has(CSRF_COOKIE)) appendSetCookie(res, csrfCookie(generateToken()));
}
