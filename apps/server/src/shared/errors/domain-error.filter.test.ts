import 'reflect-metadata';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { api } from '../../test/http.ts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DomainError } from './domain-error.ts';
import { DomainErrorFilter } from './domain-error.filter.ts';

@Controller('probe')
class ProbeController {
  @Get('domain')
  domain(): never {
    throw new DomainError('ALREADY_MEMBER', { email: 'a@test.local' });
  }

  @Get('crash')
  crash(): never {
    throw new Error('database password is hunter2');
  }
}

describe('DomainErrorFilter', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalFilters(new DomainErrorFilter());
    await app.init();
  });

  afterAll(() => app.close());

  it('maps a DomainError to its HTTP status with a code-only body', async () => {
    const response = await api(app).get('/probe/domain');
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: { code: 'ALREADY_MEMBER', params: { email: 'a@test.local' } } });
  });

  it('maps unknown errors to 500 INTERNAL_ERROR without leaking message or stack', async () => {
    const response = await api(app).get('/probe/crash');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: 'INTERNAL_ERROR', params: {} } });
    expect(response.text).not.toContain('hunter2');
  });

  it('maps unknown routes to 404 RESOURCE_NOT_FOUND', async () => {
    const response = await api(app).get('/nope');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'RESOURCE_NOT_FOUND', params: {} } });
  });
});
