import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api } from './test/http.ts';
import { useTestDatabase } from './test/postgres.ts';
import { RecordingMailSender } from './test/recording-mail-sender.ts';
import { seedOrganization } from './test/seed.ts';
import { signedInMember } from './test/signed-in-member.ts';
import { createTestApp, TEST_APP_BASE_URL } from './test/test-app.ts';

const db = useTestDatabase();
let app: INestApplication;

/** Body limit for JSON and urlencoded requests (decision 2026-09-15-005-payload-too-large). */
const LIMIT_BYTES = 100 * 1024;

beforeAll(async () => {
  app = await createTestApp({ database: db, mailSender: new RecordingMailSender() });
});

afterAll(() => app.close());

describe('security headers (T124)', () => {
  it('sends CSP, HSTS, nosniff and Referrer-Policy, and hides x-powered-by', async () => {
    const response = await api(app).get('/api/v1/auth/session');

    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBeTruthy();
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('sends the same headers on error responses', async () => {
    const response = await api(app).get('/api/v1/org/members');
    expect(response.status).toBe(401);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});

describe('request body limit (T124, decision 2026-09-15-005-payload-too-large)', () => {
  const oversizedJson = () => JSON.stringify({ email: 'a@acme.test', password: 'x'.repeat(LIMIT_BYTES) });

  it('refuses an oversized JSON body with 413 PAYLOAD_TOO_LARGE on an anonymous route', async () => {
    const response = await api(app)
      .post('/api/v1/auth/login')
      .set('Origin', TEST_APP_BASE_URL)
      .set('Content-Type', 'application/json')
      .send(oversizedJson());

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: { code: 'PAYLOAD_TOO_LARGE', params: {} } });
  });

  it('refuses an oversized urlencoded body with 413 PAYLOAD_TOO_LARGE', async () => {
    const response = await api(app)
      .post('/api/v1/auth/login')
      .set('Origin', TEST_APP_BASE_URL)
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(`email=a%40acme.test&password=${'x'.repeat(LIMIT_BYTES)}`);

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: { code: 'PAYLOAD_TOO_LARGE', params: {} } });
  });

  it('refuses an oversized body on a signed-in route before it reaches the handler', async () => {
    const organizationId = await seedOrganization(db, 'Acme');
    const member = await signedInMember(app, db, organizationId, ['member']);
    const response = await member.browser.patch('/me', { timeZone: 'A'.repeat(LIMIT_BYTES) });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: { code: 'PAYLOAD_TOO_LARGE', params: {} } });
  });

  it.each([
    ['text/plain', 'text/plain'],
    ['application/octet-stream', 'application/octet-stream'],
  ])(
    'refuses an oversized %s body with 413 before anything else runs (security review: every content type)',
    async (_label, contentType) => {
      const response = await api(app)
        .post('/api/v1/auth/login')
        .set('Origin', TEST_APP_BASE_URL)
        .set('Content-Type', contentType)
        .send('x'.repeat(LIMIT_BYTES + 1));

      expect(response.status).toBe(413);
      expect(response.body).toEqual({ error: { code: 'PAYLOAD_TOO_LARGE', params: {} } });
    },
  );

  it('still accepts a body just under the limit (the request fails for its own reason, not its size)', async () => {
    const response = await api(app)
      .post('/api/v1/auth/login')
      .set('Origin', TEST_APP_BASE_URL)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@acme.test', password: 'x'.repeat(LIMIT_BYTES - 1024) }));

    expect(response.status).not.toBe(413);
    expect(response.body.error.code).not.toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('other client-side body errors (code review Phase 11)', () => {
  it('answers 400 VALIDATION_FAILED, not 500, when the body parser refuses the charset', async () => {
    const response = await api(app)
      .post('/api/v1/auth/login')
      .set('Origin', TEST_APP_BASE_URL)
      .set('Content-Type', 'application/json; charset=latin1')
      .send(JSON.stringify({ email: 'a@acme.test', password: 'x' }));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: 'VALIDATION_FAILED', params: {} } });
  });

  it('answers 400 VALIDATION_FAILED for malformed JSON', async () => {
    const response = await api(app)
      .post('/api/v1/auth/login')
      .set('Origin', TEST_APP_BASE_URL)
      .set('Content-Type', 'application/json')
      .send('{"email": ');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: 'VALIDATION_FAILED', params: {} } });
  });
});
