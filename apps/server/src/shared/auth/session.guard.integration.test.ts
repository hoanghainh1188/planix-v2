import 'reflect-metadata';
import { Controller, Get, HttpCode, Post, Req, Res, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { configureApp } from '../../configure-app.ts';
import { FakeClock, HOUR, MINUTE } from '../../test/fake-clock.ts';
import { api } from '../../test/http.ts';
import { useTestDatabase } from '../../test/postgres.ts';
import { seedMembership, seedOrganization, seedUser } from '../../test/seed.ts';
import { InfrastructureModule } from '../infrastructure.module.ts';
import { RecordingMailSender } from '../../test/recording-mail-sender.ts';
import type { Tx } from '../db/client.ts';
import { AppLogger } from '../logging/app-logger.ts';
import { AuthCoreModule } from './auth-core.module.ts';
import { PrincipalLoader } from './principal.loader.ts';
import { OrganizationScoped, Public, PublicWithOriginCheck } from './route-scope.decorators.ts';
import { CSRF_COOKIE, SESSION_COOKIE, ensureCsrfCookie, sessionCookie } from './session-cookie.ts';
import { SessionStore } from './session-store.ts';
import type { AuthenticatedRequest } from './session.guard.ts';

const APP_BASE_URL = 'https://app.planix.test';

@Controller('probe')
class ProbeController {
  @Get('me')
  me(@Req() req: AuthenticatedRequest) {
    return { userId: req.auth?.userId };
  }

  @Get('org')
  @OrganizationScoped()
  async org(@Req() req: AuthenticatedRequest & { tx?: Tx }) {
    const { rows } = await req.tx!.client.query<{ org: string }>(
      "SELECT current_setting('app.organization_id') AS org",
    );
    return { organizationId: rows[0]?.org, roles: [...(req.principal?.roles ?? [])].sort() };
  }

  @Post('org-write')
  @HttpCode(200)
  @OrganizationScoped()
  write() {
    return { ok: true };
  }
}

@Controller('auth')
class AuthProbeController {
  @Get('session')
  @Public()
  session(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    ensureCsrfCookie(req, res);
    res.status(401);
    return { error: { code: 'AUTH_REQUIRED', params: {} } };
  }

  @Post('login')
  @HttpCode(200)
  @PublicWithOriginCheck()
  login() {
    return { ok: true };
  }
}

const db = useTestDatabase();
const clock = new FakeClock();
const sessions = new SessionStore(db, clock);
let app: INestApplication;
let organizationId: string;
let userId: string;
let membershipId: string;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [
      InfrastructureModule.forRoot({
        database: db,
        config: { appBaseUrl: APP_BASE_URL },
        mailSender: new RecordingMailSender(),
        clock,
      }),
      AuthCoreModule,
    ],
    controllers: [ProbeController, AuthProbeController],
  }).compile();
  const logger = new AppLogger(() => {});
  app = configureApp(moduleRef.createNestApplication({ logger }), logger);
  await app.listen(0, '127.0.0.1');
});

afterAll(() => app.close());

beforeEach(async () => {
  organizationId = await seedOrganization(db);
  userId = await seedUser(db);
  membershipId = await seedMembership(db, organizationId, userId, ['member', 'finance']);
});

const cookieHeader = (sessionToken: string, csrfToken?: string) =>
  [`${SESSION_COOKIE}=${sessionToken}`, ...(csrfToken ? [`${CSRF_COOKIE}=${csrfToken}`] : [])].join('; ');

describe('SessionGuard (FR-007, SC-004)', () => {
  it('rejects requests without a session cookie', async () => {
    const response = await api(app).get('/api/v1/probe/me');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: { code: 'AUTH_REQUIRED', params: {} } });
  });

  it('accepts a live session and slides last_seen_at', async () => {
    const { sessionToken } = await sessions.create(userId, organizationId);
    clock.advance(7 * HOUR);
    const response = await api(app).get('/api/v1/probe/me').set('Cookie', cookieHeader(sessionToken));
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId });
    clock.advance(7 * HOUR);
    expect((await api(app).get('/api/v1/probe/me').set('Cookie', cookieHeader(sessionToken))).status).toBe(200);
  });

  it('expires a session after 8 hours without activity and deletes it', async () => {
    const { sessionToken } = await sessions.create(userId, organizationId);
    clock.advance(8 * HOUR + MINUTE);
    const response = await api(app).get('/api/v1/probe/me').set('Cookie', cookieHeader(sessionToken));
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
    const { rowCount } = await db.ownerPool.query('SELECT 1 FROM auth_session WHERE user_id = $1', [userId]);
    expect(rowCount).toBe(0);
  });

  it('requires an active organization on organization routes', async () => {
    const { sessionToken } = await sessions.create(userId, null);
    const response = await api(app).get('/api/v1/probe/org').set('Cookie', cookieHeader(sessionToken));
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('ACTIVE_ORGANIZATION_REQUIRED');
  });

  it('runs organization routes in a tenant transaction with the union of roles', async () => {
    const { sessionToken } = await sessions.create(userId, organizationId);
    const response = await api(app).get('/api/v1/probe/org').set('Cookie', cookieHeader(sessionToken));
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ organizationId, roles: ['finance', 'member'] });
  });

  it('denies a deactivated membership on the next request and clears the active organization', async () => {
    const { sessionToken } = await sessions.create(userId, organizationId);
    await db.ownerPool.query(
      "UPDATE organization_membership SET status = 'deactivated', deactivated_at = now() WHERE id = $1",
      [membershipId],
    );
    const response = await api(app).get('/api/v1/probe/org').set('Cookie', cookieHeader(sessionToken));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('MEMBERSHIP_INACTIVE');
    const { rows } = await db.ownerPool.query<{ active_organization_id: string | null }>(
      'SELECT active_organization_id FROM auth_session WHERE user_id = $1',
      [userId],
    );
    expect(rows[0]?.active_organization_id).toBeNull();
  });
});

describe('PrincipalLoader', () => {
  it('loads membership status and roles with a single query', async () => {
    const loader = new PrincipalLoader();
    const { withTenantTransaction } = await import('../db/client.ts');
    const { tenantFromVerifiedSession } = await import('@planix/core/shared/tenant-context.ts');
    let queries = 0;
    const principal = await withTenantTransaction(db, tenantFromVerifiedSession(organizationId), async (tx) => {
      const original = tx.client.query.bind(tx.client);
      const counting = new Proxy(tx, {
        get: (target, prop) =>
          prop === 'client'
            ? new Proxy(target.client, {
                get: (client, key) =>
                  key === 'query'
                    ? (...args: Parameters<typeof original>) => {
                        queries++;
                        return original(...args);
                      }
                    : Reflect.get(client, key),
              })
            : Reflect.get(target, prop),
      });
      return loader.load(counting, userId, organizationId);
    });
    expect(queries).toBe(1);
    expect(principal).toMatchObject({ userId, organizationId, membershipStatus: 'active' });
    expect([...(principal?.roles ?? [])].sort()).toEqual(['finance', 'member']);
  });
});

describe('CSRF (R4)', () => {
  it('rejects state-changing requests without a matching X-CSRF-Token', async () => {
    const { sessionToken, csrfToken } = await sessions.create(userId, organizationId);
    const cookie = cookieHeader(sessionToken, csrfToken);
    expect((await api(app).post('/api/v1/probe/org-write').set('Cookie', cookie)).body.error.code).toBe('CSRF_INVALID');
    expect(
      (await api(app).post('/api/v1/probe/org-write').set('Cookie', cookie).set('X-CSRF-Token', 'forged')).status,
    ).toBe(403);
    const ok = await api(app).post('/api/v1/probe/org-write').set('Cookie', cookie).set('X-CSRF-Token', csrfToken);
    expect(ok.status).toBe(200);
  });

  it('issues a CSRF cookie on GET /auth/session even without a session', async () => {
    const response = await api(app).get('/api/v1/auth/session');
    expect(response.status).toBe(401);
    const setCookie = ([] as string[]).concat(response.headers['set-cookie'] ?? []);
    expect(
      setCookie.some((c) => c.startsWith(`${CSRF_COOKIE}=`) && c.includes('SameSite=Lax') && c.includes('Secure')),
    ).toBe(true);
  });

  it('checks Origin and the double-submit token on unauthenticated routes', async () => {
    const csrf = 'anonymous-csrf-token-value-1234567890abcd';
    const evil = await api(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Cookie', `${CSRF_COOKIE}=${csrf}`)
      .set('X-CSRF-Token', csrf);
    expect(evil.status).toBe(403);
    expect(evil.body.error.code).toBe('CSRF_INVALID');
    const good = await api(app)
      .post('/api/v1/auth/login')
      .set('Origin', APP_BASE_URL)
      .set('Cookie', `${CSRF_COOKIE}=${csrf}`)
      .set('X-CSRF-Token', csrf);
    expect(good.status).toBe(200);
  });
});

describe('session cookie', () => {
  it('is HttpOnly, Secure and SameSite=Lax', () => {
    const header = sessionCookie('token-value');
    expect(header).toContain(`${SESSION_COOKIE}=token-value`);
    expect(header).toContain('HttpOnly');
    expect(header).toContain('Secure');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Path=/');
  });
});
