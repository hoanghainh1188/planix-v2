import { describe, expect, it } from 'vitest';
import { createDatabase, DEFAULT_APP_POOL_MAX } from './client.ts';

const urls = {
  owner: 'postgres://o@localhost/x',
  app: 'postgres://a@localhost/x',
  platform: 'postgres://p@localhost/x',
};

describe('createDatabase pool sizing (SC-006)', () => {
  it('sizes the application pool explicitly', async () => {
    const db = createDatabase(urls);
    expect(DEFAULT_APP_POOL_MAX).toBe(20);
    expect((db.appPool as unknown as { options: { max: number } }).options.max).toBe(20);
    await db.close();
  });

  it('accepts a configured application pool size', async () => {
    const db = createDatabase(urls, { appPoolMax: 40 });
    expect((db.appPool as unknown as { options: { max: number } }).options.max).toBe(40);
    await db.close();
  });
});
