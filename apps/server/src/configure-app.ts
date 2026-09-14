import type { INestApplication } from '@nestjs/common';
import { DomainErrorFilter } from './shared/errors/domain-error.filter.ts';
import type { AppLogger } from './shared/logging/app-logger.ts';
import { requestLoggingMiddleware } from './shared/logging/redaction.ts';

/** Cross-cutting HTTP setup shared by main.ts and integration tests. */
export function configureApp(app: INestApplication, logger: AppLogger): INestApplication {
  app.setGlobalPrefix('api/v1');
  app.use(requestLoggingMiddleware(logger));
  app.useGlobalFilters(new DomainErrorFilter());
  return app;
}
