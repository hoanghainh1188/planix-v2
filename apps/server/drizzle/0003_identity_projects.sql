-- 0003 — identity, membership, projects, RACI, sessions (data-model.md). Runs as planix_owner.
-- (T) tables carry organization_id and use app_enable_tenant_rls().

CREATE TABLE app_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  password_hash text NOT NULL,
  locale text NOT NULL DEFAULT 'vi' CHECK (locale IN ('vi', 'en')),
  time_zone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  failed_login_count integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until timestamptz NULL,
  last_active_organization_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON app_user TO planix_app;

CREATE TABLE platform_operator_grant (
  user_id uuid PRIMARY KEY REFERENCES app_user (id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by text NOT NULL
);
GRANT SELECT ON platform_operator_grant TO planix_app, planix_platform;

CREATE TABLE organization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_by_operator_id uuid NOT NULL REFERENCES app_user (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organization TO planix_app
  USING (id = app_current_organization_id());
GRANT SELECT ON organization TO planix_app;

ALTER TABLE app_user
  ADD CONSTRAINT app_user_last_active_organization_fk FOREIGN KEY (last_active_organization_id) REFERENCES organization (id);

CREATE TABLE organization_membership (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization (id),
  user_id uuid NOT NULL REFERENCES app_user (id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactivated')),
  deactivated_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id),
  UNIQUE (organization_id, id),
  CHECK ((status = 'deactivated') = (deactivated_at IS NOT NULL))
);
CREATE INDEX organization_membership_user_idx ON organization_membership (user_id);
SELECT app_enable_tenant_rls('organization_membership');
GRANT SELECT, INSERT, UPDATE ON organization_membership TO planix_app;

CREATE TABLE membership_role (
  organization_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'portfolioLead', 'projectManager', 'functionalManager', 'member', 'finance')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (membership_id, role),
  FOREIGN KEY (organization_id, membership_id) REFERENCES organization_membership (organization_id, id)
);
SELECT app_enable_tenant_rls('membership_role');
GRANT SELECT, INSERT, DELETE ON membership_role TO planix_app;

CREATE TABLE project (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization (id),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description text NULL CHECK (description IS NULL OR char_length(description) <= 5000),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by_membership_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, created_by_membership_id) REFERENCES organization_membership (organization_id, id)
);
SELECT app_enable_tenant_rls('project');
GRANT SELECT, INSERT, UPDATE ON project TO planix_app;

CREATE TABLE project_member (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  added_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz NULL,
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, project_id) REFERENCES project (organization_id, id),
  FOREIGN KEY (organization_id, membership_id) REFERENCES organization_membership (organization_id, id),
  CHECK ((status = 'removed') = (removed_at IS NOT NULL))
);
CREATE UNIQUE INDEX project_member_active_unique ON project_member (project_id, membership_id) WHERE status = 'active';
CREATE INDEX project_member_membership_idx ON project_member (organization_id, membership_id);
SELECT app_enable_tenant_rls('project_member');
GRANT SELECT, INSERT, UPDATE ON project_member TO planix_app;

CREATE TABLE raci_assignment (
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  project_member_id uuid NOT NULL,
  raci_role text NOT NULL CHECK (raci_role IN ('responsible', 'accountable', 'consulted', 'informed')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_member_id, raci_role),
  FOREIGN KEY (organization_id, project_member_id) REFERENCES project_member (organization_id, id),
  FOREIGN KEY (organization_id, project_id) REFERENCES project (organization_id, id)
);
CREATE UNIQUE INDEX raci_assignment_single_accountable ON raci_assignment (project_id) WHERE raci_role = 'accountable';
SELECT app_enable_tenant_rls('raci_assignment');
GRANT SELECT, INSERT, DELETE ON raci_assignment TO planix_app;

-- Sessions are account data, not tenant data: no organization_id RLS. Logout/expiry deletes rows.
CREATE TABLE auth_session (
  id_hash bytea PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_user (id),
  active_organization_id uuid NULL REFERENCES organization (id),
  csrf_token_hash bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_session_user_idx ON auth_session (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_session TO planix_app;
