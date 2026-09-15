import 'reflect-metadata';
import { Body, Controller, Get, Module, Put, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureApp } from '../../configure-app.ts';
import { api } from '../../test/http.ts';
import { useTestDatabase } from '../../test/postgres.ts';
import { SampleFinancialDto, SampleFinancialList, SampleFinancialUpdate } from '../../test/sample-financial.dto.ts';
import { seedMembership, seedOrganization, seedProject, seedProjectMember, seedUser } from '../../test/seed.ts';
import { APP_CONFIG, DATABASE } from '../app-tokens.ts';
import { AuthCoreModule } from '../auth/auth-core.module.ts';
import { CSRF_COOKIE, SESSION_COOKIE } from '../auth/session-cookie.ts';
import { SessionStore } from '../auth/session-store.ts';
import { AuthorizationModule } from '../authorization/authorization.module.ts';
import { RequireAction } from '../authorization/require-action.decorator.ts';
import { systemClock } from '../clock/clock.ts';
import { DomainError } from '../errors/domain-error.ts';
import { AppLogger } from '../logging/app-logger.ts';
import { RequestSchema, ResponseSchema } from './sensitive-field.decorators.ts';
import { SensitiveFieldModule } from './sensitive-field.module.ts';

const SAMPLE: SampleFinancialDto = { name: 'Website', budgetAtCompletion: '1000.0000' };
const writes: unknown[] = [];

@Controller('projects/:projectId/sample')
class SampleController {
  @Get()
  @RequireAction('project.read')
  @ResponseSchema(SampleFinancialDto)
  detail() {
    return SAMPLE;
  }

  @Get('list')
  @RequireAction('project.read')
  @ResponseSchema(SampleFinancialList)
  list() {
    return { items: [SAMPLE, { ...SAMPLE, name: 'Mobile' }] };
  }

  @Get('error')
  @RequireAction('project.read')
  @ResponseSchema(SampleFinancialDto)
  failing(): never {
    throw new DomainError('VALIDATION_FAILED', { name: 'Website', budgetAtCompletion: '1000.0000' });
  }

  @Put()
  @RequireAction('project.read')
  @RequestSchema(SampleFinancialUpdate)
  @ResponseSchema(SampleFinancialDto)
  update(@Body() body: unknown) {
    writes.push(body);
    return SAMPLE;
  }
}

@Module({ controllers: [SampleController] })
class SampleModule {}

const db = useTestDatabase();
const sessions = new SessionStore(db, systemClock);
let app: INestApplication;
let organizationId: string;
let projectId: string;

async function projectMember(roles: string[]) {
  const userId = await seedUser(db);
  const membershipId = await seedMembership(db, organizationId, userId, roles);
  await seedProjectMember(db, organizationId, projectId, membershipId);
  const { sessionToken, csrfToken } = await sessions.create(userId, organizationId);
  return { cookie: `${SESSION_COOKIE}=${sessionToken}; ${CSRF_COOKIE}=${csrfToken}`, csrfToken };
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [AuthCoreModule, AuthorizationModule, SensitiveFieldModule, SampleModule],
  })
    .overrideProvider(DATABASE)
    .useValue(db)
    .overrideProvider(APP_CONFIG)
    .useValue({ appBaseUrl: 'https://app.planix.test' })
    .compile();
  const logger = new AppLogger(() => {});
  app = configureApp(moduleRef.createNestApplication({ logger }), logger);
  await app.init();
  organizationId = await seedOrganization(db);
  const creator = await seedMembership(db, organizationId, await seedUser(db), ['projectManager']);
  projectId = await seedProject(db, organizationId, creator);
});

afterAll(() => app.close());

describe('sensitive field interceptor (FR-025, FR-026, SC-005)', () => {
  it('returns sensitive keys to callers with sensitive.financial.read', async () => {
    const finance = await projectMember(['finance']);
    const response = await api(app).get(`/api/v1/projects/${projectId}/sample`).set('Cookie', finance.cookie);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(SAMPLE);
  });

  it('removes the key entirely from detail, list and error bodies for other callers', async () => {
    const plain = await projectMember(['member']);
    const detail = await api(app).get(`/api/v1/projects/${projectId}/sample`).set('Cookie', plain.cookie);
    expect(detail.body).toEqual({ name: 'Website' });
    expect(Object.hasOwn(detail.body, 'budgetAtCompletion')).toBe(false);

    const list = await api(app).get(`/api/v1/projects/${projectId}/sample/list`).set('Cookie', plain.cookie);
    expect(list.body).toEqual({ items: [{ name: 'Website' }, { name: 'Mobile' }] });

    const error = await api(app).get(`/api/v1/projects/${projectId}/sample/error`).set('Cookie', plain.cookie);
    expect(error.status).toBe(400);
    expect(error.body).toEqual({ error: { code: 'VALIDATION_FAILED', params: { name: 'Website' } } });
    expect(error.text).not.toContain('1000.0000');
  });

  it('rejects writes to sensitive fields without sensitive.financial.write and never reaches the handler', async () => {
    const plain = await projectMember(['member']);
    writes.length = 0;
    const response = await api(app)
      .put(`/api/v1/projects/${projectId}/sample`)
      .set('Cookie', plain.cookie)
      .set('X-CSRF-Token', plain.csrfToken)
      .send({ budgetAtCompletion: '5.0000' });
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: { code: 'FORBIDDEN', params: {} } });
    expect(writes).toEqual([]);
  });

  it('accepts writes from callers holding the write permission', async () => {
    const finance = await projectMember(['finance']);
    writes.length = 0;
    const response = await api(app)
      .put(`/api/v1/projects/${projectId}/sample`)
      .set('Cookie', finance.cookie)
      .set('X-CSRF-Token', finance.csrfToken)
      .send({ budgetAtCompletion: '5.0000' });
    expect(response.status).toBe(200);
    expect(writes).toEqual([{ budgetAtCompletion: '5.0000' }]);
  });
});
