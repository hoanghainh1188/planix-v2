import type { INestApplication } from '@nestjs/common';
import { applyRateLimits } from './shared/auth/rate-limit.middleware.ts';
import { DomainErrorFilter } from './shared/errors/domain-error.filter.ts';
import type { AppLogger } from './shared/logging/app-logger.ts';
import { requestLoggingMiddleware } from './shared/logging/redaction.ts';

/** Cross-cutting HTTP setup shared by main.ts and integration tests. */
export function configureApp(app: INestApplication, logger: AppLogger): INestApplication {
  app.setGlobalPrefix('api/v1');
  app.use(requestLoggingMiddleware(logger));
  applyRateLimits(app);
  app.useGlobalFilters(new DomainErrorFilter());
  return app;
}
