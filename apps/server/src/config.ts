import type { AppConfig } from './shared/app-tokens.ts';
import type { ApplicationDatabaseUrls, DatabaseUrls } from './shared/db/client.ts';

export interface ServerConfig {
  readonly app: AppConfig;
  /** No owner URL: the server never holds credentials that can bypass RLS (see loadOpsDatabaseUrls). */
  readonly databaseUrls: ApplicationDatabaseUrls;
  readonly smtpUrl: string;
  readonly mailFrom: string;
  readonly port: number;
  readonly appPoolMax: number | undefined;
  readonly statementTimeoutMs: number | undefined;
  readonly idleInTransactionTimeoutMs: number | undefined;
  readonly connectionTimeoutMs: number | undefined;
  /** Proxies in front of the server (hosting load balancer); undefined = trust none. Never `true`. */
  readonly trustProxyHops: number | undefined;
  /** Built web app served by the server itself, so web and API share one origin (demo deploy). */
  readonly webDistDir: string | undefined;
}

function optionalInteger(env: NodeJS.ProcessEnv, name: string): number | undefined {
  const value = env[name];
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (value === undefined || value.trim() === '') throw new Error(`Missing required environment variable ${name}`);
  return value;
}

/** Fails fast at start-up when configuration is incomplete (secrets come only from the environment). */
export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    app: { appBaseUrl: required(env, 'APP_BASE_URL') },
    databaseUrls: {
      app: required(env, 'DATABASE_URL_APP'),
      platform: required(env, 'DATABASE_URL_PLATFORM'),
    },
    smtpUrl: required(env, 'SMTP_URL'),
    mailFrom: env.MAIL_FROM ?? 'Planix <no-reply@planix.local>',
    port: Number.parseInt(env.PORT ?? '3000', 10),
    appPoolMax: optionalInteger(env, 'DATABASE_APP_POOL_MAX'),
    statementTimeoutMs: optionalInteger(env, 'DATABASE_STATEMENT_TIMEOUT_MS'),
    idleInTransactionTimeoutMs: optionalInteger(env, 'DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS'),
    connectionTimeoutMs: optionalInteger(env, 'DATABASE_CONNECTION_TIMEOUT_MS'),
    trustProxyHops: optionalInteger(env, 'TRUST_PROXY_HOPS'),
    webDistDir: env.WEB_DIST_DIR?.trim() || undefined,
  };
}

/** Database URLs for operations commands (migrate, grant-operator), which alone need the owner. */
export function loadOpsDatabaseUrls(env: NodeJS.ProcessEnv = process.env): DatabaseUrls {
  return {
    owner: required(env, 'DATABASE_URL_OWNER'),
    app: required(env, 'DATABASE_URL_APP'),
    platform: required(env, 'DATABASE_URL_PLATFORM'),
  };
}
