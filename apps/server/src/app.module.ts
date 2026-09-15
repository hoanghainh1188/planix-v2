import { Module, type DynamicModule } from '@nestjs/common';
import { OrganizationAccessModule } from './features/organization-access/organization-access.module.ts';
import { AuthCoreModule } from './shared/auth/auth-core.module.ts';
import { AuthorizationModule } from './shared/authorization/authorization.module.ts';
import { InfrastructureModule, type InfrastructureOptions } from './shared/infrastructure.module.ts';
import { SensitiveFieldModule } from './shared/sensitive-field/sensitive-field.module.ts';

/** Import order matters: guards and interceptors run in registration order (session → CSRF → authorization). */
@Module({})
export class AppModule {
  static forRoot(infrastructure: InfrastructureOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [
        InfrastructureModule.forRoot(infrastructure),
        AuthCoreModule,
        AuthorizationModule,
        SensitiveFieldModule,
        OrganizationAccessModule,
      ],
    };
  }
}
