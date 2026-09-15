/**
 * Load test for SC-006 / R12 (T123): 500 projects in one organization, 200 concurrent connections on the feature's
 * endpoints, fails when p95 ≥ 1 second or any request errors.
 *
 * Self-contained like the E2E setup: throwaway PostgreSQL 17 + Mailpit containers, the real server (src/main.ts) in
 * a child process, data seeded through the API as the application role. The owner role is used only to migrate and
 * to grant the Platform Operator (as `npm run ops:grant-operator` does) — never for business data, never BYPASSRLS.
 * Not part of `npm run test` or CI: run `npm run perf:org-access`.
 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import autocannon from 'autocannon';
import pg from 'pg';
import { GenericContainer, Wait } from 'testcontainers';
import { PasswordHasher } from '../src/shared/auth/password-hasher.ts';
import { migrate } from '../src/shared/db/migrate.ts';
import { percentile } from './percentile.ts';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const API_PORT = Number(process.env.PERF_API_PORT ?? 3201);
const APP_BASE_URL = 'http://localhost:5199';
const PROJECTS = 500;
const USERS = 20; // Accepting invitations counts against the IP rate limit on /invitations/* (30 per 15 minutes).
const CONNECTIONS = 200;
const DURATION_SECONDS = Number(process.env.PERF_DURATION_SECONDS ?? 30);
const P95_LIMIT_MS = 1000;
const PASSWORD = 'perf-load-password-42';

const api = (path: string) => `http://localhost:${API_PORT}/api/v1${path}`;

/** A signed-in (or anonymous) caller keeping cookies and echoing the CSRF token, like the web app. */
class Caller {
  readonly cookies = new Map<string, string>();

  async request(method: string, path: string, body?: object): Promise<{ status: number; body: unknown }> {
    const response = await fetch(api(path), {
      method,
      headers: {
        'content-type': 'application/json',
        origin: APP_BASE_URL,
        cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        ...(this.cookies.has('planix_csrf') ? { 'x-csrf-token': this.cookies.get('planix_csrf')! } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    for (const header of response.headers.getSetCookie()) {
      const [pair] = header.split(';');
      const [name, ...value] = pair!.split('=');
      this.cookies.set(name!.trim(), value.join('='));
    }
    const text = await response.text();
    return { status: response.status, body: text === '' ? undefined : (JSON.parse(text) as unknown) };
  }

  async expect(status: number, method: string, path: string, body?: object): Promise<unknown> {
    const response = await this.request(method, path, body);
    if (response.status !== status) {
      throw new Error(`${method} ${path} → ${response.status} (expected ${status}): ${JSON.stringify(response.body)}`);
    }
    return response.body;
  }

  get cookieHeader(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

async function waitUntil<T>(what: string, probe: () => Promise<T | undefined>, timeoutMs = 90_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe().catch(() => undefined);
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
    await delay(250); // polling an external process, not a test sleep
  }
}

async function main(): Promise<void> {
  process.stdout.write('Starting PostgreSQL and Mailpit…\n');
  const postgres = await new PostgreSqlContainer('postgres:17')
    .withDatabase('planix')
    .withUsername('planix_owner')
    .withPassword('owner_perf')
    .start();
  const mailpit = await new GenericContainer('axllent/mailpit')
    .withExposedPorts(1025, 8025)
    .withWaitStrategy(Wait.forHttp('/api/v1/messages', 8025))
    .start();
  const mailApi = `http://${mailpit.getHost()}:${mailpit.getMappedPort(8025)}/api/v1`;

  const owner = postgres.getConnectionUri();
  const credentials = { appPassword: 'app_perf', platformPassword: 'platform_perf' };
  const operatorEmail = 'operator@planix-perf.test';
  const ownerPool = new pg.Pool({ connectionString: owner, max: 1 });
  try {
    await migrate(ownerPool, credentials);
    await ownerPool.query("INSERT INTO app_user (email, password_hash, locale) VALUES ($1, $2, 'en')", [
      operatorEmail,
      await new PasswordHasher().hash(PASSWORD),
    ]);
    await ownerPool.query(
      "INSERT INTO platform_operator_grant (user_id, granted_by) SELECT id, 'perf' FROM app_user WHERE email = $1",
      [operatorEmail],
    );
  } finally {
    await ownerPool.end();
  }

  const withUser = (user: string, password: string) => {
    const url = new URL(owner);
    url.username = user;
    url.password = password;
    return url.toString();
  };
  const server = spawn('node', ['--import', 'tsx', 'apps/server/src/main.ts'], {
    cwd: ROOT,
    env: {
      ...process.env,
      TZ: 'UTC',
      TSX_TSCONFIG_PATH: 'apps/server/tsconfig.json',
      PORT: String(API_PORT),
      APP_BASE_URL,
      DATABASE_URL_OWNER: owner,
      DATABASE_URL_APP: withUser('planix_app', credentials.appPassword),
      DATABASE_URL_PLATFORM: withUser('planix_platform', credentials.platformPassword),
      SMTP_URL: `smtp://${mailpit.getHost()}:${mailpit.getMappedPort(1025)}`,
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  let passed: boolean;
  try {
    await waitUntil('the API server', async () =>
      (await fetch(api('/auth/session'))).status < 500 ? true : undefined,
    );

    const acceptInvitationSentTo = async (email: string): Promise<Caller> => {
      const token = await waitUntil(`invitation email to ${email}`, async () => {
        const search = await fetch(`${mailApi}/search?query=${encodeURIComponent(`to:${email}`)}`);
        const [message] = ((await search.json()) as { messages: Array<{ ID: string }> }).messages;
        if (message === undefined) return undefined;
        const detail = (await (await fetch(`${mailApi}/message/${message.ID}`)).json()) as { Text: string };
        return /\/invitations\/([A-Za-z0-9_-]{43})/.exec(detail.Text)?.[1];
      });
      const caller = new Caller();
      await caller.expect(401, 'GET', '/auth/session');
      await caller.expect(200, 'POST', `/invitations/${token}/accept`, { password: PASSWORD });
      return caller;
    };

    process.stdout.write(`Seeding 1 organization, ${USERS} project managers, ${PROJECTS} projects…\n`);
    const operator = new Caller();
    await operator.expect(401, 'GET', '/auth/session');
    await operator.expect(200, 'POST', '/auth/login', { email: operatorEmail, password: PASSWORD });
    await operator.expect(201, 'POST', '/platform/organizations', {
      name: 'Perf Org',
      firstAdminEmail: 'admin@planix-perf.test',
    });
    const admin = await acceptInvitationSentTo('admin@planix-perf.test');

    const users: Array<{ caller: Caller; projectIds: string[] }> = [];
    for (let i = 0; i < USERS; i++) {
      const email = `pm${i}@planix-perf.test`;
      await admin.expect(201, 'POST', '/org/invitations', { email, roles: ['projectManager'] });
      users.push({ caller: await acceptInvitationSentTo(email), projectIds: [] });
    }
    for (let i = 0; i < PROJECTS; i++) {
      const user = users[i % USERS]!;
      const created = (await user.caller.expect(201, 'POST', '/projects', { name: `Project ${i}` })) as {
        project: { id: string };
      };
      user.projectIds.push(created.project.id);
    }

    process.stdout.write(`Load: ${CONNECTIONS} connections for ${DURATION_SECONDS}s…\n`);
    let next = 0;
    const pick = () => users[next++ % USERS]!;
    const signedIn = (path: (user: { projectIds: string[] }) => string) => ({
      setupRequest: (request: { method: string; path: string; headers: Record<string, string> }) => {
        const user = pick();
        request.method = 'GET';
        request.path = `/api/v1${path(user)}`;
        request.headers = { ...request.headers, cookie: user.caller.cookieHeader };
        return request;
      },
    });
    const project = (user: { projectIds: string[] }) => user.projectIds[next % user.projectIds.length]!;
    const instance = autocannon({
      url: `http://localhost:${API_PORT}`,
      connections: CONNECTIONS,
      duration: DURATION_SECONDS,
      timeout: 10,
      requests: [
        signedIn(() => '/auth/session'),
        signedIn(() => '/projects'),
        signedIn((user) => `/projects/${project(user)}`),
        signedIn((user) => `/projects/${project(user)}/members`),
        signedIn(() => '/org/members'),
      ],
    });
    const latencies: number[] = [];
    const statuses = new Map<number, number>();
    instance.on('response', (_client, statusCode, _bytes, responseTime) => {
      latencies.push(responseTime);
      statuses.set(statusCode, (statuses.get(statusCode) ?? 0) + 1);
    });
    const result = await instance;

    const p95 = percentile(latencies, 95);
    const failures = result.errors + result.timeouts + result.non2xx;
    process.stdout.write(
      [
        `Requests: ${result.requests.total} (${result.requests.average}/s) — statuses ${JSON.stringify(Object.fromEntries(statuses))}`,
        `Latency ms: p50 ${result.latency.p50} · p90 ${result.latency.p90} · p95 ${p95} · p99 ${result.latency.p99} · max ${result.latency.max}`,
        `Errors: ${result.errors}, timeouts: ${result.timeouts}, non-2xx: ${result.non2xx}`,
      ].join('\n') + '\n',
    );
    passed = p95 < P95_LIMIT_MS && failures === 0 && latencies.length > 0;
    process.stdout.write(
      passed
        ? `PASS: p95 ${p95} ms < ${P95_LIMIT_MS} ms (SC-006)\n`
        : `FAIL: p95 ${p95} ms (limit < ${P95_LIMIT_MS} ms), failures ${failures}\n`,
    );
  } finally {
    server.kill('SIGTERM');
    await mailpit.stop();
    await postgres.stop();
  }
  process.exitCode = passed ? 0 : 1;
}

await main();
