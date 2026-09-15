import { Global, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { DATABASE } from '../app-tokens.ts';
import { CLOCK, type ClockPort } from '../clock/clock.ts';
import type { ApplicationDatabase } from '../db/client.ts';
import { CsrfGuard } from './csrf.guard.ts';
import { PRINCIPAL_LOADER, PrincipalLoader } from './principal.loader.ts';
import { SESSION_STORE, SessionStore } from './session-store.ts';
import { SessionGuard } from './session.guard.ts';
import { TenantTransactionInterceptor } from './tenant-transaction.interceptor.ts';

/** Session, CSRF and tenant-transaction plumbing. Requires InfrastructureModule.forRoot(). */
@Global()
@Module({
  providers: [
    { provide: PRINCIPAL_LOADER, useValue: new PrincipalLoader() },
    {
      provide: SESSION_STORE,
      inject: [DATABASE, CLOCK],
      useFactory: (db: ApplicationDatabase, clock: ClockPort) => new SessionStore(db, clock),
    },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantTransactionInterceptor },
  ],
  exports: [PRINCIPAL_LOADER, SESSION_STORE],
})
export class AuthCoreModule {}
