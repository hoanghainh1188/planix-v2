import 'reflect-metadata';
import { Controller, Get, HttpCode, Post, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api } from '../../test/http.ts';
import { applyRateLimits } from './rate-limit.middleware.ts';

@Controller()
class ProbeController {
  @Get('api/v1/auth/session')
  session() {
    return { ok: true };
  }

  @Post('api/v1/auth/login')
  @HttpCode(200)
  login() {
    return { ok: true };
  }

  @Get('api/v1/invitations/abc')
  describeInvitation() {
    return { ok: true };
  }

  @Post('api/v1/invitations/abc/accept')
  @HttpCode(200)
  accept() {
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
    await app.listen(0, '127.0.0.1');
  });

  afterAll(() => app.close());

  it.each(['/api/v1/auth/login', '/api/v1/invitations/abc/accept'])(
    'limits state-changing requests to %s per IP with 429 RATE_LIMITED',
    async (path) => {
      expect((await api(app).post(path)).status).toBe(200);
      expect((await api(app).post(path)).status).toBe(200);
      const limited = await api(app).post(path);
      expect(limited.status).toBe(429);
      expect(limited.body).toEqual({ error: { code: 'RATE_LIMITED', params: {} } });
    },
  );

  it('does not count reads such as loading the session on every page (decision tech-stack, amendment)', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await api(app).get('/api/v1/auth/session')).status).toBe(200);
      expect((await api(app).get('/api/v1/invitations/abc')).status).toBe(200);
    }
  });

  it('does not limit other routes', async () => {
    for (let i = 0; i < 5; i++) expect((await api(app).get('/api/v1/projects')).status).toBe(200);
  });
});
