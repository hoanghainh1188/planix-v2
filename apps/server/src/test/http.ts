import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

/** Typed supertest agent for a Nest application (getHttpServer() is typed as any). */
export function api(app: INestApplication) {
  return request(app.getHttpServer() as Server);
}
