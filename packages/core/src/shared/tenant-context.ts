declare const tenantBrand: unique symbol;

/**
 * Organization scope of a request. Branded so it cannot be built from client input:
 * the only constructor is used by the server after verifying the session's active membership.
 */
export interface TenantContext {
  readonly organizationId: string;
  readonly [tenantBrand]: true;
}

export function tenantFromVerifiedSession(organizationId: string): TenantContext {
  return { organizationId } as TenantContext;
}
