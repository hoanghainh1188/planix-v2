import { Global, Module, type DynamicModule } from '@nestjs/common';
import { APP_CONFIG, DATABASE, type AppConfig } from './app-tokens.ts';
import { AUDIT_WRITER, AuditWriter } from './audit/audit-writer.ts';
import { PASSWORD_HASHER, PasswordHasher } from './auth/password-hasher.ts';
import { CLOCK, systemClock, type ClockPort } from './clock/clock.ts';
import type { Database } from './db/client.ts';
import { MAIL_SENDER, type MailSender } from './mail/mail-sender.ts';

export interface InfrastructureOptions {
  readonly database: Database;
  readonly config: AppConfig;
  readonly mailSender: MailSender;
  readonly clock?: ClockPort;
  readonly passwordHasher?: PasswordHasher;
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
    ];
    return { module: InfrastructureModule, providers, exports: providers.map((p) => p.provide) };
  }
}
