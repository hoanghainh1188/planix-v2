import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, DiscoveryModule } from '@nestjs/core';
import { AuthorizationModule } from '../authorization/authorization.module.ts';
import { SensitiveFieldInterceptor } from './sensitive-field.interceptor.ts';
import { SensitiveSchemaCoverage } from './sensitive-schema-coverage.ts';

/** Import after AuthCoreModule so this interceptor runs inside the tenant transaction. */
@Module({
  imports: [AuthorizationModule, DiscoveryModule],
  providers: [{ provide: APP_INTERCEPTOR, useClass: SensitiveFieldInterceptor }, SensitiveSchemaCoverage],
})
export class SensitiveFieldModule {}
