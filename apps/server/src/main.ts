import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.ts';
import { configureApp } from './configure-app.ts';
import { AppLogger } from './shared/logging/app-logger.ts';

export function assertUtcTimeZone(tz: string | undefined): void {
  if (tz !== 'UTC') {
    throw new Error(`Server must run with TZ=UTC (got ${tz ?? 'unset'})`);
  }
}

async function bootstrap(): Promise<void> {
  assertUtcTimeZone(process.env.TZ);
  const logger = new AppLogger();
  const app = await NestFactory.create(AppModule, { logger, bufferLogs: true });
  configureApp(app, logger);
  await app.listen(3000);
}

await bootstrap();
