import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';
import { api } from './http.ts';
import { TEST_APP_BASE_URL } from './test-app.ts';

/**
 * Minimal browser: keeps cookies across requests (including Secure ones, which supertest's agent drops over
 * plain HTTP), echoes the CSRF cookie and sends the app Origin — like the real web client.
 */
export class Browser {
  readonly cookies = new Map<string, string>();

  constructor(private readonly app: INestApplication) {}

  async get(path: string): Promise<Response> {
    return this.#absorb(await api(this.app).get(`/api/v1${path}`).set(this.#headers()));
  }

  async post(path: string, body?: object): Promise<Response> {
    return this.#absorb(
      await api(this.app)
        .post(`/api/v1${path}`)
        .set(this.#headers())
        .send(body ?? {}),
    );
  }

  async put(path: string, body?: object): Promise<Response> {
    return this.#absorb(
      await api(this.app)
        .put(`/api/v1${path}`)
        .set(this.#headers())
        .send(body ?? {}),
    );
  }

  /** Obtains the anonymous CSRF cookie, as the web app does on load. */
  async open(): Promise<this> {
    await this.get('/auth/session');
    return this;
  }

  async login(email: string, password: string): Promise<Response> {
    if (!this.cookies.has('planix_csrf')) await this.open();
    return this.post('/auth/login', { email, password });
  }

  #headers(): Record<string, string> {
    const headers: Record<string, string> = { Origin: TEST_APP_BASE_URL };
    if (this.cookies.size > 0) headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const csrf = this.cookies.get('planix_csrf');
    if (csrf !== undefined) headers['X-CSRF-Token'] = csrf;
    return headers;
  }

  #absorb(response: Response): Response {
    for (const header of ([] as string[]).concat(response.headers['set-cookie'] ?? [])) {
      const [pair = '', ...attributes] = header.split(';');
      const index = pair.indexOf('=');
      const name = pair.slice(0, index).trim();
      const value = decodeURIComponent(pair.slice(index + 1).trim());
      if (attributes.some((a) => a.trim().toLowerCase() === 'max-age=0') || value === '') this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return response;
  }
}
