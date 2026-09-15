import { SetMetadata, applyDecorators } from '@nestjs/common';

export const PUBLIC_ROUTE = 'planix:public-route';
export const ORGANIZATION_SCOPED = 'planix:organization-scoped';

/** Route reachable without a session (a valid session is still attached when present). */
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);

/** Public state-changing route (login, reset, accept invitation): CSRF double-submit + Origin check apply. */
export const PublicWithOriginCheck = () => applyDecorators(SetMetadata(PUBLIC_ROUTE, true));

/** Route that needs the verified active organization; runs inside a tenant transaction. */
export const OrganizationScoped = () => SetMetadata(ORGANIZATION_SCOPED, true);
