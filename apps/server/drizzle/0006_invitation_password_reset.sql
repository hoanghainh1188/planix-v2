-- 0006 — organization invitations and password reset tokens (data-model.md, research R3 paths 2 and 3).

CREATE TABLE organization_invitation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization (id),
  email citext NOT NULL,
  roles text[] NOT NULL DEFAULT '{member}'
    CHECK (cardinality(roles) >= 1
      AND roles <@ ARRAY['admin', 'portfolioLead', 'projectManager', 'functionalManager', 'member', 'finance']::text[]),
  token_hash bytea NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz NOT NULL,
  invited_by_user_id uuid NOT NULL REFERENCES app_user (id),
  invited_by_kind text NOT NULL CHECK (invited_by_kind IN ('organizationAdmin', 'platformOperator')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz NULL,
  CHECK ((status = 'accepted') = (accepted_at IS NOT NULL))
);
CREATE UNIQUE INDEX organization_invitation_pending_unique ON organization_invitation (organization_id, email)
  WHERE status = 'pending';
SELECT app_enable_tenant_rls('organization_invitation');
GRANT SELECT, INSERT, UPDATE ON organization_invitation TO planix_app;

-- Path 2: anonymous token lookup returning only what the acceptance screen needs.
CREATE OR REPLACE FUNCTION app_find_invitation_by_token_hash(candidate bytea)
  RETURNS TABLE (
    id uuid, organization_id uuid, email citext, roles text[], status text, expires_at timestamptz, organization_name text
  )
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public
  AS $$
    SELECT i.id, i.organization_id, i.email, i.roles, i.status, i.expires_at, o.name
      FROM organization_invitation i
      JOIN organization o ON o.id = i.organization_id
     WHERE i.token_hash = candidate
  $$;
REVOKE ALL ON FUNCTION app_find_invitation_by_token_hash(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_find_invitation_by_token_hash(bytea) TO planix_app;

-- Path 3: planix_platform creates and revokes first-admin invitations only.
GRANT INSERT ON organization_invitation TO planix_platform;
GRANT SELECT (id, organization_id, email, roles, status, invited_by_kind, expires_at, created_at) ON organization_invitation TO planix_platform;
GRANT UPDATE (status) ON organization_invitation TO planix_platform;
CREATE POLICY platform_admin_invitation_insert ON organization_invitation FOR INSERT TO planix_platform
  WITH CHECK (invited_by_kind = 'platformOperator' AND roles = '{admin}' AND status = 'pending');
CREATE POLICY platform_admin_invitation_select ON organization_invitation FOR SELECT TO planix_platform
  USING (invited_by_kind = 'platformOperator' AND roles = '{admin}');
CREATE POLICY platform_admin_invitation_revoke ON organization_invitation FOR UPDATE TO planix_platform
  USING (invited_by_kind = 'platformOperator' AND roles = '{admin}' AND status = 'pending')
  WITH CHECK (status = 'revoked');

-- Account data (no organization): read/written by planix_app outside tenant context.
CREATE TABLE password_reset_token (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user (id),
  token_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  superseded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_token_user_idx ON password_reset_token (user_id);
GRANT SELECT, INSERT, UPDATE ON password_reset_token TO planix_app;
