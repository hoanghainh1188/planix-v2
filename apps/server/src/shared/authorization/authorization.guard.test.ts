import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Controller, Get, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureApp } from '../../configure-app.ts';
import { api } from '../../test/http.ts';
import { useTestDatabase } from '../../test/postgres.ts';
import {
  seedMembership,
  seedOperator,
  seedOrganization,
  seedProject,
  seedProjectMember,
  seedUser,
} from '../../test/seed.ts';
import { InfrastructureModule } from '../infrastructure.module.ts';
import { RecordingMailSender } from '../../test/recording-mail-sender.ts';
import { AuthCoreModule } from '../auth/auth-core.module.ts';
import { Public } from '../auth/route-scope.decorators.ts';
import { SESSION_COOKIE } from '../auth/session-cookie.ts';
import { SessionStore } from '../auth/session-store.ts';
import { systemClock } from '../clock/clock.ts';
import { AppLogger } from '../logging/app-logger.ts';
import { AuthorizationModule } from './authorization.module.ts';
import { toHttpError } from './authorization.guard.ts';
import { PlatformAction } from './platform-action.decorator.ts';
import { RequireAction } from './require-action.decorator.ts';

@Controller('probe')
class ProbeController {
  @Get('invite')
  @RequireAction('org.member.invite')
  invite() {
    return { ok: true };
  }

  @Get('projects/:projectId')
  @RequireAction('project.read')
  read() {
    return { ok: true };
  }

  @Get('projects/:projectId/members')
  @RequireAction('project.member.manage')
  manage() {
    return { ok: true };
  }

  @Get('platform')
  @PlatformAction('platform.organization.list')
  platform() {
    return { ok: true };
  }

  @Get('public')
  @Public()
  open() {
    return { ok: true };
  }
}

@Controller('bad')
class UndeclaredController {
  @Get()
  undeclared() {
    return { ok: true };
  }
}

const APP_BASE_URL = 'https://app.planix.test';
const db = useTestDatabase();
const sessions = new SessionStore(db, systemClock);
const logger = new AppLogger(() => {});

async function buildApp(controllers: Array<new () => unknown>): Promise<INestApplication> {
  @Module({ controllers })
  class ProbeModule {}
  const moduleRef = await Test.createTestingModule({
    imports: [
      InfrastructureModule.forRoot({
        database: db,
        config: { appBaseUrl: APP_BASE_URL },
        mailSender: new RecordingMailSender(),
      }),
      AuthCoreModule,
      AuthorizationModule,
      ProbeModule,
    ],
  }).compile();
  const app = configureApp(moduleRef.createNestApplication({ logger }), logger);
  await app.init();
  return app;
}

let app: INestApplication;
let orgA: string;
let orgB: string;
let projectA: string;
let projectB: string;

async function login(userId: string, organizationId: string | null) {
  const { sessionToken } = await sessions.create(userId, organizationId);
  return `${SESSION_COOKIE}=${sessionToken}`;
}

async function member(organizationId: string, roles: string[]) {
  const userId = await seedUser(db);
  const membershipId = await seedMembership(db, organizationId, userId, roles);
  return { userId, membershipId };
}

beforeAll(async () => {
  app = await buildApp([ProbeController]);
  [orgA, orgB] = await Promise.all([seedOrganization(db), seedOrganization(db)]);
  const creatorA = await member(orgA, ['projectManager']);
  const creatorB = await member(orgB, ['projectManager']);
  projectA = await seedProject(db, orgA, creatorA.membershipId);
  projectB = await seedProject(db, orgB, creatorB.membershipId);
});

afterAll(() => app.close());

describe('database connections per request (code review finding 2, SC-006)', () => {
  function countCheckouts() {
    const original = db.appPool.connect.bind(db.appPool);
    let count = 0;
    db.appPool.connect = ((...args: unknown[]) => {
      count++;
      return (original as (...a: unknown[]) => unknown)(...args);
    }) as typeof db.appPool.connect;
    return { count: () => count, restore: () => (db.appPool.connect = original) };
  }

  it('uses one session lookup and a single tenant transaction for a project request', async () => {
    const user = await member(orgA, ['member']);
    await seedProjectMember(db, orgA, projectA, user.membershipId);
    const cookie = await login(user.userId, orgA);
    const probe = countCheckouts();
    try {
      expect((await api(app).get(`/api/v1/probe/projects/${projectA}`).set('Cookie', cookie)).status).toBe(200);
      expect(probe.count()).toBe(2);
    } finally {
      probe.restore();
    }
  });

  it('releases the request transaction when authorization denies the request', async () => {
    const outsider = await member(orgA, ['member']);
    const cookie = await login(outsider.userId, orgA);
    for (let i = 0; i < 15; i++) {
      expect((await api(app).get(`/api/v1/probe/projects/${projectA}`).set('Cookie', cookie)).status).toBe(403);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(db.appPool.totalCount - db.appPool.idleCount).toBe(0);
    expect(db.appPool.waitingCount).toBe(0);
  });
});

describe('route action coverage (FR-024)', () => {
  it('refuses to start when a route declares no action and is not public', async () => {
    await expect(buildApp([ProbeController, UndeclaredController])).rejects.toThrow(/GET \/bad/);
  });

  it('starts when every route is declared', async () => {
    expect((await api(app).get('/api/v1/probe/public')).status).toBe(200);
  });
});

describe('AuthorizationGuard (FR-022, contracts/authorization.md §3)', () => {
  it('allows an organization action for a permitted role and forbids others', async () => {
    const admin = await member(orgA, ['admin']);
    const plain = await member(orgA, ['member']);
    expect(
      (
        await api(app)
          .get('/api/v1/probe/invite')
          .set('Cookie', await login(admin.userId, orgA))
      ).status,
    ).toBe(200);
    const denied = await api(app)
      .get('/api/v1/probe/invite')
      .set('Cookie', await login(plain.userId, orgA));
    expect(denied.status).toBe(403);
    expect(denied.body).toEqual({ error: { code: 'FORBIDDEN', params: {} } });
  });

  it('requires project membership for project actions', async () => {
    const inside = await member(orgA, ['member']);
    await seedProjectMember(db, orgA, projectA, inside.membershipId);
    const outside = await member(orgA, ['member']);
    expect(
      (
        await api(app)
          .get(`/api/v1/probe/projects/${projectA}`)
          .set('Cookie', await login(inside.userId, orgA))
      ).status,
    ).toBe(200);
    const denied = await api(app)
      .get(`/api/v1/probe/projects/${projectA}`)
      .set('Cookie', await login(outside.userId, orgA));
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
  });

  it('passes the project member role combination to decide()', async () => {
    const lead = await member(orgA, ['portfolioLead']);
    await seedProjectMember(db, orgA, projectA, lead.membershipId, ['accountable']);
    const plain = await member(orgA, ['member']);
    await seedProjectMember(db, orgA, projectA, plain.membershipId, ['responsible']);
    expect(
      (
        await api(app)
          .get(`/api/v1/probe/projects/${projectA}/members`)
          .set('Cookie', await login(lead.userId, orgA))
      ).status,
    ).toBe(200);
    expect(
      (
        await api(app)
          .get(`/api/v1/probe/projects/${projectA}/members`)
          .set('Cookie', await login(plain.userId, orgA))
      ).status,
    ).toBe(403);
  });

  it('answers 404 for projects of another organization, unknown ids and malformed ids alike (FR-003)', async () => {
    const pm = await member(orgA, ['projectManager', 'admin']);
    const cookie = await login(pm.userId, orgA);
    const bodies = [];
    for (const id of [projectB, randomUUID(), 'not-a-uuid']) {
      const response = await api(app).get(`/api/v1/probe/projects/${id}`).set('Cookie', cookie);
      expect(response.status, id).toBe(404);
      bodies.push(response.body);
    }
    expect(new Set(bodies.map((b) => JSON.stringify(b))).size).toBe(1);
  });

  it('restricts platform actions to platform operators', async () => {
    const operatorId = await seedOperator(db);
    const plain = await member(orgA, ['admin']);
    expect(
      (
        await api(app)
          .get('/api/v1/probe/platform')
          .set('Cookie', await login(operatorId, null))
      ).status,
    ).toBe(200);
    const denied = await api(app)
      .get('/api/v1/probe/platform')
      .set('Cookie', await login(plain.userId, orgA));
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
  });

  it.each([
    ['MEMBERSHIP_INACTIVE', 'MEMBERSHIP_INACTIVE'],
    ['ROLE_NOT_PERMITTED', 'FORBIDDEN'],
    ['ACTION_NOT_DECLARED', 'FORBIDDEN'],
    ['RACI_ROLE_REQUIRED', 'FORBIDDEN'],
    ['NOT_PROJECT_MEMBER', 'FORBIDDEN'],
  ] as const)('maps deny reason %s to %s', (reason, code) => {
    expect(toHttpError(reason).code).toBe(code);
  });
});
