import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './client.ts';

function fakeFetch(status: number, body: unknown) {
  return vi.fn(() =>
    Promise.resolve(
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
}

describe('api client', () => {
  it('sends credentials and the CSRF token from the cookie on state-changing requests', async () => {
    const fetchMock = fakeFetch(200, { ok: true });
    const client = createApiClient({
      fetch: fetchMock,
      readCookie: (name) => (name === 'planix_csrf' ? 'csrf-123' : undefined),
    });
    await client.post('/auth/login', { email: 'a@b.c', password: 'x' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/auth/login');
    expect(init.credentials).toBe('include');
    expect(new Headers(init.headers).get('X-CSRF-Token')).toBe('csrf-123');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ email: 'a@b.c', password: 'x' }));
  });

  it('does not send a CSRF header on GET', async () => {
    const fetchMock = fakeFetch(200, { ok: true });
    const client = createApiClient({ fetch: fetchMock, readCookie: () => 'csrf-123' });
    expect(await client.get('/projects')).toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.credentials).toBe('include');
    expect(new Headers(init.headers).has('X-CSRF-Token')).toBe(false);
  });

  it('turns error bodies into ApiError with code and params', async () => {
    const client = createApiClient({
      fetch: fakeFetch(409, { error: { code: 'ALREADY_MEMBER', params: { email: 'a@b.c' } } }),
      readCookie: () => undefined,
    });
    const error = await client.post('/org/invitations', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'ALREADY_MEMBER', params: { email: 'a@b.c' } });
  });

  it('maps unexpected failures to INTERNAL_ERROR', async () => {
    const client = createApiClient({
      fetch: vi.fn(() => Promise.resolve(new Response('oops', { status: 502 }))),
      readCookie: () => undefined,
    });
    await expect(client.get('/x')).rejects.toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
  });

  it('returns undefined for 204 responses', async () => {
    const client = createApiClient({ fetch: fakeFetch(204, undefined), readCookie: () => 'c' });
    expect(await client.del('/org/invitations/1')).toBeUndefined();
  });
});
