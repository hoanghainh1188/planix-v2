-- 0002 — standard tenant isolation policy (research R3). Runs as planix_owner.
-- Every table with organization_id calls app_enable_tenant_rls(table) right after CREATE TABLE.
CREATE OR REPLACE FUNCTION app_enable_tenant_rls(target regclass) RETURNS void
  LANGUAGE plpgsql
  AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', target);
  EXECUTE format(
    'CREATE POLICY tenant_isolation ON %s TO planix_app '
    'USING (organization_id = app_current_organization_id()) '
    'WITH CHECK (organization_id = app_current_organization_id())',
    target
  );
END
$$;

REVOKE ALL ON FUNCTION app_enable_tenant_rls(regclass) FROM PUBLIC;
