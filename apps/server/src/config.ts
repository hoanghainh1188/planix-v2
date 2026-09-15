import type { AppConfig } from './shared/app-tokens.ts';
import type { DatabaseUrls } from './shared/db/client.ts';

export interface ServerConfig {
  readonly app: AppConfig;
  readonly databaseUrls: DatabaseUrls;
  readonly smtpUrl: string;
  readonly mailFrom: string;
  readonly port: number;
  readonly appPoolMax: number | undefined;
  readonly statementTimeoutMs: number | undefined;
  readonly idleInTransactionTimeoutMs: number | undefined;
  readonly connectionTimeoutMs: number | undefined;
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
      owner: required(env, 'DATABASE_URL_OWNER'),
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
  };
}
