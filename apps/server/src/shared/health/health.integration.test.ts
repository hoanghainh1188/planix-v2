import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api } from '../../test/http.ts';
import { useTestDatabase } from '../../test/postgres.ts';
import { RecordingMailSender } from '../../test/recording-mail-sender.ts';
import { createTestApp } from '../../test/test-app.ts';

const db = useTestDatabase();
let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp({ database: db, mailSender: new RecordingMailSender() });
});

afterAll(() => app.close());

describe('health check for the hosting platform (decision 2026-09-15-018-demo-deploy)', () => {
  it('answers 200 without a session, sets no cookie and reveals nothing else', async () => {
    const response = await api(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('only answers GET', async () => {
    const response = await api(app).post('/api/v1/health').send({});
    expect(response.status).not.toBe(200);
  });
});
