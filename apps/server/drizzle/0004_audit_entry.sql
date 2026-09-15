-- 0004 — append-only audit trail (research R8, R3 path 4). Runs as planix_owner.
CREATE TABLE audit_entry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NULL REFERENCES organization (id),
  actor_user_id uuid NULL REFERENCES app_user (id),
  actor_kind text NOT NULL CHECK (actor_kind IN ('user', 'platformOperator', 'system')),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NULL,
  outcome text NOT NULL CHECK (outcome IN ('succeeded', 'denied')),
  before jsonb NULL,
  after jsonb NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_entry_organization_idx ON audit_entry (organization_id, occurred_at);

ALTER TABLE audit_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_entry FORCE ROW LEVEL SECURITY;
-- Account/platform events carry no organization; they are readable only by the owner role (operations).
CREATE POLICY audit_insert ON audit_entry FOR INSERT TO planix_app
  WITH CHECK (organization_id IS NULL OR organization_id = app_current_organization_id());
CREATE POLICY audit_select ON audit_entry FOR SELECT TO planix_app
  USING (organization_id = app_current_organization_id());

GRANT INSERT, SELECT ON audit_entry TO planix_app;
