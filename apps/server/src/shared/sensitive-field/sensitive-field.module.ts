import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthorizationModule } from '../authorization/authorization.module.ts';
import { SensitiveFieldInterceptor } from './sensitive-field.interceptor.ts';

/** Import after AuthCoreModule so this interceptor runs inside the tenant transaction. */
@Module({
  imports: [AuthorizationModule],
  providers: [{ provide: APP_INTERCEPTOR, useClass: SensitiveFieldInterceptor }],
})
export class SensitiveFieldModule {}
