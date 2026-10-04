ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS config_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

UPDATE users u
SET active_organization_id = chosen.organization_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, organization_id
  FROM memberships
  ORDER BY user_id, created_at ASC
) chosen
WHERE chosen.user_id = u.id
  AND u.active_organization_id IS NULL;

CREATE INDEX IF NOT EXISTS users_active_org_idx ON users(active_organization_id);

ALTER TABLE icps
  ADD COLUMN IF NOT EXISTS excluded_industries TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS exclude_government BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS exclude_nonprofit BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS exclude_existing_customer BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS exclude_rejected BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS exclude_unsubscribed BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS employee_exclude_below INTEGER,
  ADD COLUMN IF NOT EXISTS employee_exclude_above INTEGER;

CREATE TABLE IF NOT EXISTS offering_icps (
  offering_id UUID NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,
  icp_id UUID NOT NULL REFERENCES icps(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (offering_id, icp_id)
);

CREATE INDEX IF NOT EXISTS offering_icps_icp_idx ON offering_icps(icp_id);

CREATE TABLE IF NOT EXISTS workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'REP')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workspace_invitations_org_idx
  ON workspace_invitations(organization_id);

CREATE INDEX IF NOT EXISTS workspace_invitations_email_idx
  ON workspace_invitations(LOWER(email));
