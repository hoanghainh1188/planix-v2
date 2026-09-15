import type { INestApplication } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { api } from './test/http.ts';
import { useTestDatabase } from './test/postgres.ts';
import { RecordingMailSender } from './test/recording-mail-sender.ts';
import { createTestApp, TEST_APP_BASE_URL } from './test/test-app.ts';

const db = useTestDatabase();
let app: INestApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

const LIMIT = 3;
const loginFrom = (forwardedFor?: string) => {
  const request = api(app!).post('/api/v1/auth/login').set('Origin', TEST_APP_BASE_URL);
  return (forwardedFor === undefined ? request : request.set('X-Forwarded-For', forwardedFor)).send({
    email: 'nobody@acme.test',
    password: 'not-a-real-password',
  });
};

describe('client IP behind the hosting proxy (decision 2026-09-15-018-demo-deploy, #14)', () => {
  it('with one trusted hop, a spoofed leftmost X-Forwarded-For entry does not open a new rate-limit bucket', async () => {
    app = await createTestApp({
      database: db,
      mailSender: new RecordingMailSender(),
      rateLimit: { windowMs: 60_000, limit: LIMIT },
      trustProxyHops: 1,
    });
    // The proxy appends the real client (203.0.113.7); everything left of it is whatever the client sent.
    for (let i = 0; i < LIMIT; i++) {
      expect((await loginFrom(`10.0.0.${i + 1}, 203.0.113.7`)).status).not.toBe(429);
    }
    expect((await loginFrom('10.9.9.9, 203.0.113.7')).status).toBe(429);
    // A different real client still has its own bucket.
    expect((await loginFrom('198.51.100.20')).status).not.toBe(429);
  });

  it('Render (two hops): rotating internal proxy addresses and spoofed entries still map to the real client', async () => {
    app = await createTestApp({
      database: db,
      mailSender: new RecordingMailSender(),
      rateLimit: { windowMs: 60_000, limit: LIMIT },
      trustProxyHops: 2,
    });
    // Observed on the demo (2026-09-16): with one hop the key rotated over ~3 internal proxy addresses, whatever the
    // client sent. Chain here: <spoofed by client>, <real client>, <internal proxy, rotating>.
    for (let i = 0; i < LIMIT; i++) {
      expect((await loginFrom(`10.0.0.${i + 1}, 203.0.113.7, 172.16.0.${i % 3}`)).status).not.toBe(429);
    }
    expect((await loginFrom('10.9.9.9, 203.0.113.7, 172.16.0.2')).status).toBe(429);
    expect((await loginFrom('198.51.100.20, 172.16.0.1')).status).not.toBe(429);
  });

  it('without TRUST_PROXY_HOPS, X-Forwarded-For is ignored entirely', async () => {
    app = await createTestApp({
      database: db,
      mailSender: new RecordingMailSender(),
      rateLimit: { windowMs: 60_000, limit: LIMIT },
    });
    for (let i = 0; i < LIMIT; i++) {
      expect((await loginFrom(`198.51.100.${i + 1}`)).status).not.toBe(429);
    }
    expect((await loginFrom('198.51.100.99')).status).toBe(429);
  });
});
