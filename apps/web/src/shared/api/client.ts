export const CSRF_COOKIE = 'planix_csrf';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly params: Readonly<Record<string, unknown>> = {},
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

export interface ApiClientOptions {
  readonly fetch?: typeof fetch;
  readonly readCookie?: (name: string) => string | undefined;
  readonly baseUrl?: string;
}

function readBrowserCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const entry = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return entry === undefined ? undefined : decodeURIComponent(entry.slice(name.length + 1));
}

/** Thin fetch wrapper: cookies included, CSRF double submit on state-changing calls, errors as ApiError(code). */
export function createApiClient(options: ApiClientOptions = {}) {
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init));
  const readCookie = options.readCookie ?? readBrowserCookie;
  const baseUrl = options.baseUrl ?? '/api/v1';

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers = new Headers({ Accept: 'application/json' });
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    if (method !== 'GET') {
      const csrf = readCookie(CSRF_COOKIE);
      if (csrf !== undefined) headers.set('X-CSRF-Token', csrf);
    }
    const response = await doFetch(`${baseUrl}${path}`, {
      method,
      headers,
      credentials: 'include',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.status === 204) return undefined as T;
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const error = (payload as { error?: { code?: unknown; params?: unknown } } | undefined)?.error;
      const code = typeof error?.code === 'string' ? error.code : 'INTERNAL_ERROR';
      const params =
        typeof error?.params === 'object' && error.params !== null ? (error.params as Record<string, unknown>) : {};
      throw new ApiError(response.status, code, params);
    }
    return payload as T;
  }

  return {
    get: <T>(path: string) => call<T>('GET', path),
    post: <T>(path: string, body?: unknown) => call<T>('POST', path, body),
    put: <T>(path: string, body?: unknown) => call<T>('PUT', path, body),
    patch: <T>(path: string, body?: unknown) => call<T>('PATCH', path, body),
    del: <T>(path: string) => call<T>('DELETE', path),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
