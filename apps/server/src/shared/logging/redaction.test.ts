import 'reflect-metadata';
import { Body, Controller, HttpCode, Param, Post, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { api } from '../../test/http.ts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { sensitive } from '@planix/core/shared/sensitive-field/sensitive-field.ts';
import { DomainErrorFilter } from '../errors/domain-error.filter.ts';
import { AppLogger } from './app-logger.ts';
import { REDACTED, redactHeaders, redactPath, redactValue, requestLoggingMiddleware } from './redaction.ts';

const PASSWORD = 'CorrectHorseBattery9';
const TOKEN = 'tok_4f9c2e7a1b3d5f6a8c0e2d4b6a8f0c1e';
const COOKIE = 'planix_session=sess_abcdef0123456789';
const CSRF = 'csrf_9876543210fedcba';

@Controller()
class ProbeController {
  @Post('api/v1/auth/login')
  @HttpCode(200)
  login(@Body() _body: unknown) {
    return { ok: true };
  }

  @Post('api/v1/auth/password-reset/confirm')
  @HttpCode(204)
  confirm(@Body() _body: unknown) {}

  @Post('api/v1/invitations/:token/accept')
  @HttpCode(200)
  accept(@Param('token') _token: string, @Body() _body: unknown) {
    return { ok: true };
  }

  @Post('api/v1/crash')
  crash(@Body() _body: unknown): never {
    throw new Error('boom');
  }
}

describe('redaction helpers (R14)', () => {
  it('redacts invitation and reset tokens in paths', () => {
    expect(redactPath(`/api/v1/invitations/${TOKEN}/accept`)).toBe(`/api/v1/invitations/${REDACTED}/accept`);
    expect(redactPath(`/api/v1/invitations/${TOKEN}`)).toBe(`/api/v1/invitations/${REDACTED}`);
    expect(redactPath('/api/v1/projects/123?x=1')).toBe('/api/v1/projects/123');
  });

  it('redacts credential headers', () => {
    expect(
      redactHeaders({ cookie: COOKIE, 'x-csrf-token': CSRF, authorization: 'Bearer x', 'user-agent': 'vitest' }),
    ).toEqual({
      cookie: REDACTED,
      'x-csrf-token': REDACTED,
      authorization: REDACTED,
      'user-agent': 'vitest',
    });
  });

  it('redacts secret keys and sensitive fields at any depth', () => {
    const schema = z.object({
      budgetAtCompletion: sensitive('sensitive.financial.read')(z.string()),
      name: z.string(),
    });
    expect(
      redactValue(
        { password: PASSWORD, nested: [{ token: TOKEN, keep: 'x' }], budgetAtCompletion: '1.0000', name: 'P' },
        schema,
      ),
    ).toEqual({
      password: REDACTED,
      nested: [{ token: REDACTED, keep: 'x' }],
      budgetAtCompletion: REDACTED,
      name: 'P',
    });
  });
});

describe('request logging never leaks credentials (constitution III, FR-028)', () => {
  let app: INestApplication;
  const lines: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
    const logger = new AppLogger((line) => lines.push(line));
    app = moduleRef.createNestApplication({ logger });
    app.use(requestLoggingMiddleware(logger));
    app.useGlobalFilters(new DomainErrorFilter());
    await app.listen(0, '127.0.0.1');
  });

  afterAll(() => app.close());

  const send = (path: string, body: object) =>
    api(app).post(path).set('Cookie', COOKIE).set('X-CSRF-Token', CSRF).send(body);

  it('logs method, redacted path and status without body or secrets', async () => {
    await send('/api/v1/auth/login', { email: 'a@test.local', password: PASSWORD });
    await send('/api/v1/auth/password-reset/confirm', { token: TOKEN, newPassword: PASSWORD });
    await send(`/api/v1/invitations/${TOKEN}/accept`, { password: PASSWORD });

    const output = lines.join('\n');
    for (const secret of [PASSWORD, TOKEN, 'sess_abcdef0123456789', CSRF]) {
      expect(output).not.toContain(secret);
    }
    const requestLogs = lines
      .map((l) => JSON.parse(l) as Record<string, unknown>)
      .filter((l) => l.event === 'http_request');
    expect(requestLogs).toHaveLength(3);
    expect(requestLogs[2]).toMatchObject({
      method: 'POST',
      path: `/api/v1/invitations/${REDACTED}/accept`,
      status: 200,
    });
    for (const log of requestLogs) expect(log).not.toHaveProperty('body');
  });

  it('logs the stack of a 500 without body or params', async () => {
    lines.length = 0;
    await send('/api/v1/crash', { password: PASSWORD, token: TOKEN });
    const output = lines.join('\n');
    expect(output).toContain('boom');
    expect(output).not.toContain(PASSWORD);
    expect(output).not.toContain(TOKEN);
  });
});
