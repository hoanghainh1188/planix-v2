import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.ts';
import { loadServerConfig } from './config.ts';
import { configureApp } from './configure-app.ts';
import { createDatabase } from './shared/db/client.ts';
import { AppLogger } from './shared/logging/app-logger.ts';
import { SmtpMailSender } from './shared/mail/smtp-mail-sender.ts';

export function assertUtcTimeZone(tz: string | undefined): void {
  if (tz !== 'UTC') {
    throw new Error(`Server must run with TZ=UTC (got ${tz ?? 'unset'})`);
  }
}

async function bootstrap(): Promise<void> {
  assertUtcTimeZone(process.env.TZ);
  const config = loadServerConfig();
  const logger = new AppLogger();
  const database = createDatabase(config.databaseUrls, {
    ...(config.appPoolMax === undefined ? {} : { appPoolMax: config.appPoolMax }),
    ...(config.statementTimeoutMs === undefined ? {} : { statementTimeoutMs: config.statementTimeoutMs }),
    ...(config.idleInTransactionTimeoutMs === undefined
      ? {}
      : { idleInTransactionTimeoutMs: config.idleInTransactionTimeoutMs }),
  });
  const mailSender = new SmtpMailSender({ smtpUrl: config.smtpUrl, from: config.mailFrom });
  const app = await NestFactory.create(AppModule.forRoot({ database, config: config.app, mailSender }), {
    logger,
    bufferLogs: true,
  });
  configureApp(app, logger);
  app.enableShutdownHooks();
  await app.listen(config.port);
}

await bootstrap();
