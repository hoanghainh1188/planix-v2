import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.ts';

export function assertUtcTimeZone(tz: string | undefined): void {
  if (tz !== 'UTC') {
    throw new Error(`Server must run with TZ=UTC (got ${tz ?? 'unset'})`);
  }
}

async function bootstrap(): Promise<void> {
  assertUtcTimeZone(process.env.TZ);
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  await app.listen(3000);
}

await bootstrap();
