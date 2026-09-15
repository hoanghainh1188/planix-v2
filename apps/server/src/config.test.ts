import { describe, expect, it } from 'vitest';
import { loadServerConfig } from './config.ts';

const base = {
  APP_BASE_URL: 'https://app.planix.test',
  DATABASE_URL_OWNER: 'postgres://o@localhost/x',
  DATABASE_URL_APP: 'postgres://a@localhost/x',
  DATABASE_URL_PLATFORM: 'postgres://p@localhost/x',
  SMTP_URL: 'smtp://localhost:1025',
};

describe('server configuration from the environment', () => {
  it('leaves optional database settings unset so defaults apply', () => {
    expect(loadServerConfig(base)).toMatchObject({
      appPoolMax: undefined,
      statementTimeoutMs: undefined,
      idleInTransactionTimeoutMs: undefined,
      connectionTimeoutMs: undefined,
    });
  });

  it('reads pool size and database timeouts', () => {
    expect(
      loadServerConfig({
        ...base,
        DATABASE_APP_POOL_MAX: '40',
        DATABASE_STATEMENT_TIMEOUT_MS: '10000',
        DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS: '20000',
        DATABASE_CONNECTION_TIMEOUT_MS: '5000',
      }),
    ).toMatchObject({
      appPoolMax: 40,
      statementTimeoutMs: 10_000,
      idleInTransactionTimeoutMs: 20_000,
      connectionTimeoutMs: 5_000,
    });
  });

  it('fails fast on an invalid number', () => {
    expect(() => loadServerConfig({ ...base, DATABASE_STATEMENT_TIMEOUT_MS: 'soon' })).toThrow(
      'DATABASE_STATEMENT_TIMEOUT_MS must be a positive integer',
    );
  });

  it('fails fast when a required variable is missing', () => {
    expect(() => loadServerConfig({ ...base, SMTP_URL: '' })).toThrow('Missing required environment variable SMTP_URL');
  });
});
