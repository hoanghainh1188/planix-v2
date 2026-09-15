import 'reflect-metadata';
import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module.ts';
import { configureApp } from '../configure-app.ts';
import type { RateLimitOptions } from '../shared/auth/rate-limit.middleware.ts';
import type { ClockPort } from '../shared/clock/clock.ts';
import type { Database } from '../shared/db/client.ts';
import { AppLogger, type LogSink } from '../shared/logging/app-logger.ts';
import type { MailSender } from '../shared/mail/mail-sender.ts';

export const TEST_APP_BASE_URL = 'https://app.planix.test';

/** Full application (all feature modules, guards, interceptors) on the test database. */
export async function createTestApp(options: {
  database: Database;
  mailSender: MailSender;
  clock?: ClockPort;
  logSink?: LogSink;
  invitationRateLimit?: RateLimitOptions;
  /** IP rate limit on credential routes; tests default to a limit no suite reaches. */
  rateLimit?: RateLimitOptions;
  trustProxyHops?: number;
  /** Test-only modules (e.g. SampleFinancialModule) mounted next to the production AppModule. */
  extraModules?: readonly Type[];
}): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      AppModule.forRoot({
        database: options.database,
        mailSender: options.mailSender,
        config: { appBaseUrl: TEST_APP_BASE_URL },
        ...(options.clock === undefined ? {} : { clock: options.clock }),
        // Integration suites invite many people as one admin; the limit itself is covered by its own test.
        invitationRateLimit: options.invitationRateLimit ?? { windowMs: 60_000, limit: 100_000 },
      }),
      ...(options.extraModules ?? []),
    ],
  }).compile();
  const logger = new AppLogger(options.logSink ?? (() => {}));
  // Integration suites sign in many times from one IP; the limiter itself is covered by its own test.
  const app = configureApp(moduleRef.createNestApplication({ logger }), logger, {
    rateLimit: options.rateLimit ?? { windowMs: 60_000, limit: 100_000 },
    ...(options.trustProxyHops === undefined ? {} : { trustProxyHops: options.trustProxyHops }),
  });
  await app.listen(0, '127.0.0.1');
  return app;
}
