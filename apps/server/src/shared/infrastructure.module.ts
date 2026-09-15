import { Global, Module, type DynamicModule } from '@nestjs/common';
import { APP_CONFIG, DATABASE, type AppConfig } from './app-tokens.ts';
import { AUDIT_WRITER, AuditWriter } from './audit/audit-writer.ts';
import { PASSWORD_HASHER, PasswordHasher } from './auth/password-hasher.ts';
import type { RateLimitOptions } from './auth/rate-limit.middleware.ts';
import { DEFAULT_INVITATION_RATE_LIMIT, INVITATION_RATE_LIMITER, UserRateLimiter } from './auth/user-rate-limit.ts';
import { CLOCK, systemClock, type ClockPort } from './clock/clock.ts';
import type { ApplicationDatabase } from './db/client.ts';
import { MAIL_SENDER, type MailSender } from './mail/mail-sender.ts';

export interface InfrastructureOptions {
  readonly database: ApplicationDatabase;
  readonly config: AppConfig;
  readonly mailSender: MailSender;
  readonly clock?: ClockPort;
  readonly passwordHasher?: PasswordHasher;
  readonly invitationRateLimit?: RateLimitOptions;
}

/** Process-wide adapters, supplied by main.ts (environment) or by tests (containers, fakes). */
@Global()
@Module({})
export class InfrastructureModule {
  static forRoot(options: InfrastructureOptions): DynamicModule {
    const providers = [
      { provide: DATABASE, useValue: options.database },
      { provide: APP_CONFIG, useValue: options.config },
      { provide: CLOCK, useValue: options.clock ?? systemClock },
      { provide: MAIL_SENDER, useValue: options.mailSender },
      { provide: PASSWORD_HASHER, useValue: options.passwordHasher ?? new PasswordHasher() },
      { provide: AUDIT_WRITER, useValue: new AuditWriter() },
      {
        provide: INVITATION_RATE_LIMITER,
        useValue: new UserRateLimiter(options.invitationRateLimit ?? DEFAULT_INVITATION_RATE_LIMIT),
      },
    ];
    return { module: InfrastructureModule, providers, exports: providers.map((p) => p.provide) };
  }
}
