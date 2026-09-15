import { Module } from '@nestjs/common';
import { APP_GUARD, DiscoveryModule } from '@nestjs/core';
import { AuthorizationGuard } from './authorization.guard.ts';
import { PROJECT_TARGET_RESOLVER, ProjectTargetResolver } from './project-target.resolver.ts';
import { RouteActionCoverage } from './route-action-coverage.ts';

/** Must be imported after AuthCoreModule so AuthorizationGuard runs after SessionGuard and CsrfGuard. */
@Module({
  imports: [DiscoveryModule],
  providers: [
    { provide: PROJECT_TARGET_RESOLVER, useValue: new ProjectTargetResolver() },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
    RouteActionCoverage,
  ],
  exports: [PROJECT_TARGET_RESOLVER],
})
export class AuthorizationModule {}
