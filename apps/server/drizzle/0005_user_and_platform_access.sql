-- 0005 — narrow access paths outside the active organization (research R3 paths 1 and 3). Runs as planix_owner.

-- Path 1: a signed-in user reads ONLY their own memberships, roles and organization names (SELECT only).
CREATE POLICY own_memberships_read ON organization_membership FOR SELECT TO planix_app
  USING (user_id = app_current_user_id());

CREATE POLICY own_membership_roles_read ON membership_role FOR SELECT TO planix_app
  USING (membership_id IN (SELECT id FROM organization_membership WHERE user_id = app_current_user_id()));

CREATE POLICY own_organizations_read ON organization FOR SELECT TO planix_app
  USING (id IN (SELECT organization_id FROM organization_membership WHERE user_id = app_current_user_id()));

-- Path 3: planix_platform manages organization lifecycle only. No BYPASSRLS; explicit policies instead.
GRANT SELECT, INSERT ON organization TO planix_platform;
GRANT UPDATE (status, updated_at) ON organization TO planix_platform;
CREATE POLICY platform_read ON organization FOR SELECT TO planix_platform USING (true);
CREATE POLICY platform_create ON organization FOR INSERT TO planix_platform WITH CHECK (true);
CREATE POLICY platform_update_status ON organization FOR UPDATE TO planix_platform USING (true) WITH CHECK (true);

GRANT INSERT ON audit_entry TO planix_platform;
CREATE POLICY platform_audit_insert ON audit_entry FOR INSERT TO planix_platform
  WITH CHECK (actor_kind = 'platformOperator');

-- Admin count for the platform list without granting access to memberships.
CREATE OR REPLACE FUNCTION app_count_active_admins(target_organization_id uuid) RETURNS integer
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public
  AS $$
    SELECT count(*)::integer
    FROM organization_membership m
    JOIN membership_role r ON r.membership_id = m.id
    WHERE m.organization_id = target_organization_id AND m.status = 'active' AND r.role = 'admin'
  $$;
REVOKE ALL ON FUNCTION app_count_active_admins(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_count_active_admins(uuid) TO planix_platform;
