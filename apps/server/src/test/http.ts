import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

/**
 * Typed supertest agent for a Nest application (getHttpServer() is typed as any). The app must already listen:
 * otherwise supertest binds and frees an ephemeral port for every request, and under parallel test files a request
 * can reach a port just reused by another listener (flaky "socket hang up" / foreign "421" answers).
 */
export function api(app: INestApplication) {
  const server = app.getHttpServer() as Server;
  if (!server.listening) throw new Error("Test app is not listening: use `await app.listen(0, '127.0.0.1')`");
  return request(server);
}
