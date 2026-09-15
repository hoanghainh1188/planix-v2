import { spawn, type ChildProcess } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { GenericContainer, Wait } from 'testcontainers';
import { PasswordHasher } from '../../server/src/shared/auth/password-hasher.ts';
import { migrate } from '../../server/src/shared/db/migrate.ts';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const API_PORT = 3101;
const WEB_PORT = 5174;
export const STATE_FILE = fileURLToPath(new URL('./.state.json', import.meta.url));

export interface E2eState {
  readonly mailpitApi: string;
  readonly operator: { readonly email: string; readonly password: string };
  readonly resetUser: { readonly email: string; readonly password: string };
  readonly databaseUrl: string;
}

async function waitFor(url: string, timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function start(command: string, args: string[], env: NodeJS.ProcessEnv, cwd = ROOT): ChildProcess {
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'ignore', 'inherit'] });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) process.stderr.write(`${command} ${args.join(' ')} exited with ${code}\n`);
  });
  return child;
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  const postgres = await new PostgreSqlContainer('postgres:17')
    .withDatabase('planix')
    .withUsername('planix_owner')
    .withPassword('owner_e2e')
    .start();
  const mailpit = await new GenericContainer('axllent/mailpit')
    .withExposedPorts(1025, 8025)
    .withWaitStrategy(Wait.forHttp('/api/v1/messages', 8025))
    .start();

  const owner = postgres.getConnectionUri();
  const ownerPool = new pg.Pool({ connectionString: owner, max: 1 });
  const credentials = { appPassword: 'app_e2e', platformPassword: 'platform_e2e' };
  const hasher = new PasswordHasher();
  const operator = { email: 'operator@planix-e2e.test', password: 'operator-e2e-password' };
  const resetUser = { email: 'reset.user@planix-e2e.test', password: 'original-e2e-password' };
  try {
    await migrate(ownerPool, credentials);
    for (const account of [operator, resetUser]) {
      await ownerPool.query('INSERT INTO app_user (email, password_hash, locale) VALUES ($1, $2, $3)', [
        account.email,
        await hasher.hash(account.password),
        'en',
      ]);
    }
    await ownerPool.query(
      "INSERT INTO platform_operator_grant (user_id, granted_by) SELECT id, 'e2e' FROM app_user WHERE email = $1",
      [operator.email],
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

  const server = start('node', ['--import', 'tsx', 'apps/server/src/main.ts'], {
    TZ: 'UTC',
    // tsx must read the server tsconfig (experimentalDecorators) even though it runs from the repo root.
    TSX_TSCONFIG_PATH: 'apps/server/tsconfig.json',
    PORT: String(API_PORT),
    APP_BASE_URL: `http://localhost:${WEB_PORT}`,
    DATABASE_URL_OWNER: owner,
    DATABASE_URL_APP: withUser('planix_app', credentials.appPassword),
    DATABASE_URL_PLATFORM: withUser('planix_platform', credentials.platformPassword),
    SMTP_URL: `smtp://${mailpit.getHost()}:${mailpit.getMappedPort(1025)}`,
  });
  const web = start(
    'npx',
    ['vite', '--port', String(WEB_PORT), '--strictPort'],
    { PLANIX_API_URL: `http://localhost:${API_PORT}` },
    fileURLToPath(new URL('../', import.meta.url)),
  );
  await waitFor(`http://localhost:${API_PORT}/api/v1/auth/session`);
  await waitFor(`http://localhost:${WEB_PORT}/login`);
  const html = await (await fetch(`http://localhost:${WEB_PORT}/login`)).text();
  if (!html.includes('id="root"')) throw new Error('Vite is not serving apps/web (index.html missing)');

  const state: E2eState = {
    mailpitApi: `http://${mailpit.getHost()}:${mailpit.getMappedPort(8025)}/api/v1`,
    operator,
    resetUser,
    databaseUrl: owner,
  };
  writeFileSync(STATE_FILE, JSON.stringify(state));

  return async () => {
    server.kill('SIGTERM');
    web.kill('SIGTERM');
    await mailpit.stop();
    await postgres.stop();
  };
}
