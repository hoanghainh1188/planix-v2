import { Global, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { APP_CONFIG, DATABASE } from '../app-tokens.ts';
import { CLOCK, systemClock, type ClockPort } from '../clock/clock.ts';
import type { Database } from '../db/client.ts';
import { CsrfGuard } from './csrf.guard.ts';
import { PRINCIPAL_LOADER, PrincipalLoader } from './principal.loader.ts';
import { SESSION_STORE, SessionStore } from './session-store.ts';
import { SessionGuard } from './session.guard.ts';
import { TenantTransactionInterceptor } from './tenant-transaction.interceptor.ts';

/** Session, CSRF and tenant-transaction plumbing. DATABASE and APP_CONFIG are supplied by the root module. */
@Global()
@Module({
  providers: [
    { provide: DATABASE, useValue: undefined },
    { provide: APP_CONFIG, useValue: undefined },
    { provide: CLOCK, useValue: systemClock },
    { provide: PRINCIPAL_LOADER, useValue: new PrincipalLoader() },
    {
      provide: SESSION_STORE,
      inject: [DATABASE, CLOCK],
      useFactory: (db: Database, clock: ClockPort) => new SessionStore(db, clock),
    },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantTransactionInterceptor },
  ],
  exports: [DATABASE, APP_CONFIG, CLOCK, PRINCIPAL_LOADER, SESSION_STORE],
})
export class AuthCoreModule {}
