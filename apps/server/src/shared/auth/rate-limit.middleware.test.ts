import 'reflect-metadata';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api } from '../../test/http.ts';
import { applyRateLimits } from './rate-limit.middleware.ts';

@Controller()
class ProbeController {
  @Get('api/v1/auth/ping')
  auth() {
    return { ok: true };
  }

  @Get('api/v1/invitations/abc')
  invitation() {
    return { ok: true };
  }

  @Get('api/v1/projects')
  projects() {
    return { ok: true };
  }
}

describe('rate limiting (R4)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    applyRateLimits(app, { windowMs: 60_000, limit: 2 });
    await app.init();
  });

  afterAll(() => app.close());

  it.each(['/api/v1/auth/ping', '/api/v1/invitations/abc'])('limits %s per IP with 429 RATE_LIMITED', async (path) => {
    expect((await api(app).get(path)).status).toBe(200);
    expect((await api(app).get(path)).status).toBe(200);
    const limited = await api(app).get(path);
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: { code: 'RATE_LIMITED', params: {} } });
  });

  it('does not limit other routes', async () => {
    for (let i = 0; i < 5; i++) expect((await api(app).get('/api/v1/projects')).status).toBe(200);
  });
});
