import type { INestApplication } from '@nestjs/common';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api } from './test/http.ts';
import { useTestDatabase } from './test/postgres.ts';
import { RecordingMailSender } from './test/recording-mail-sender.ts';
import { createTestApp } from './test/test-app.ts';

const db = useTestDatabase();
let app: INestApplication;
let withoutWeb: INestApplication;
let webDistDir: string;

beforeAll(async () => {
  webDistDir = mkdtempSync(join(tmpdir(), 'planix-web-'));
  writeFileSync(join(webDistDir, 'index.html'), '<!doctype html><div id="root">PLANIX-INDEX</div>');
  mkdirSync(join(webDistDir, 'assets'));
  writeFileSync(join(webDistDir, 'assets', 'index-abc123.js'), 'console.log("planix bundle");');
  app = await createTestApp({ database: db, mailSender: new RecordingMailSender(), webDistDir });
  withoutWeb = await createTestApp({ database: db, mailSender: new RecordingMailSender() });
});

afterAll(async () => {
  await app.close();
  await withoutWeb.close();
  rmSync(webDistDir, { recursive: true, force: true });
});

describe('the server serves the built web app on the same origin (decision 2026-09-15-018-demo-deploy)', () => {
  it.each(['/', '/login', '/projects/0b8e4f0a-1c1d-4d5e-9f00-000000000001/members', '/password-reset/abc'])(
    'answers %s with index.html (client-side routing), never cached, with security headers',
    async (path) => {
      const response = await api(app).get(path);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/html/);
      expect(response.text).toContain('PLANIX-INDEX');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    },
  );

  it('serves hashed assets with a long cache', async () => {
    const response = await api(app).get('/assets/index-abc123.js');
    expect(response.status).toBe(200);
    expect(response.text).toContain('planix bundle');
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('answers a missing asset with 404, not index.html', async () => {
    const response = await api(app).get('/assets/missing-999.js');
    expect(response.status).toBe(404);
    expect(response.text).not.toContain('PLANIX-INDEX');
  });

  it('keeps the API in JSON: known routes work and unknown ones are JSON 404s', async () => {
    expect((await api(app).get('/api/v1/health')).body).toEqual({ status: 'ok' });
    const unknown = await api(app).get('/api/v1/does-not-exist');
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual({ error: { code: 'RESOURCE_NOT_FOUND', params: {} } });
  });

  it('does not answer other methods with index.html', async () => {
    const response = await api(app).post('/login').send({});
    expect(response.text).not.toContain('PLANIX-INDEX');
  });

  it('does not leave the web directory', async () => {
    const response = await api(app).get('/..%2f..%2f..%2fetc%2fpasswd');
    expect(response.text).not.toMatch(/root:.*:0:0:/);
  });

  it('serves no web page when WEB_DIST_DIR is not set', async () => {
    expect((await api(withoutWeb).get('/login')).status).toBe(404);
  });
});
