-- 0001 — roles and helper functions (research R3). Runs as planix_owner.
-- Roles are created NOLOGIN here; the migrator grants LOGIN with passwords taken from the environment,
-- so no credential is ever committed.
CREATE EXTENSION IF NOT EXISTS citext;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'planix_app') THEN
    CREATE ROLE planix_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'planix_platform') THEN
    CREATE ROLE planix_platform NOLOGIN;
  END IF;
END
$$;

-- Application roles never bypass row-level security and never own tables.
ALTER ROLE planix_app NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
ALTER ROLE planix_platform NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

GRANT USAGE ON SCHEMA public TO planix_app, planix_platform;

CREATE OR REPLACE FUNCTION app_current_organization_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.organization_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

GRANT EXECUTE ON FUNCTION app_current_organization_id(), app_current_user_id() TO planix_app, planix_platform;
