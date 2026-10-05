-- M5 — Today, search, watchlist and compliance
--
-- Adds the daily-work controls around the M4 execution layer: watchlists,
-- organisation-wide suppression, explicit consent records, outreach-frequency
-- policy and recommendation feedback.

CREATE TABLE IF NOT EXISTS watchlist_entries (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, company_id)
);

CREATE INDEX IF NOT EXISTS watchlist_entries_org_time_idx
  ON watchlist_entries(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS suppression_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('COMPANY','CONTACT')),
  reason TEXT NOT NULL CHECK (reason IN (
    'DO_NOT_CONTACT',
    'UNSUBSCRIBED',
    'REQUESTED_STOP',
    'LEGAL_OR_POLICY',
    'DUPLICATE_OR_CONFLICT',
    'OTHER'
  )),
  source TEXT NOT NULL DEFAULT 'USER',
  note TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cleared_by UUID REFERENCES users(id) ON DELETE SET NULL,
  cleared_at TIMESTAMPTZ,
  CHECK (
    (scope = 'COMPANY' AND company_id IS NOT NULL AND contact_id IS NULL) OR
    (scope = 'CONTACT' AND contact_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS suppression_entries_active_company_uq
  ON suppression_entries(organization_id, company_id)
  WHERE active = TRUE AND scope = 'COMPANY';

CREATE UNIQUE INDEX IF NOT EXISTS suppression_entries_active_contact_uq
  ON suppression_entries(organization_id, contact_id)
  WHERE active = TRUE AND scope = 'CONTACT';

CREATE INDEX IF NOT EXISTS suppression_entries_org_active_idx
  ON suppression_entries(organization_id, active, created_at DESC);

CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN (
    'CONTACT_PERMITTED',
    'EXISTING_RELATIONSHIP',
    'USER_CONFIRMED_CONSENT',
    'WITHDRAWN'
  )),
  source TEXT NOT NULL DEFAULT 'USER',
  note TEXT NOT NULL DEFAULT '',
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS consent_records_contact_time_idx
  ON consent_records(contact_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS contact_frequency_policies (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  contact_window_days INTEGER NOT NULL DEFAULT 7
    CHECK (contact_window_days BETWEEN 1 AND 365),
  max_contact_outbound INTEGER NOT NULL DEFAULT 2
    CHECK (max_contact_outbound BETWEEN 1 AND 100),
  company_window_days INTEGER NOT NULL DEFAULT 14
    CHECK (company_window_days BETWEEN 1 AND 365),
  max_company_outbound INTEGER NOT NULL DEFAULT 4
    CHECK (max_company_outbound BETWEEN 1 AND 200),
  duplicate_warning_hours INTEGER NOT NULL DEFAULT 48
    CHECK (duplicate_warning_hours BETWEEN 1 AND 720),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO contact_frequency_policies (organization_id)
SELECT id FROM organizations
ON CONFLICT (organization_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  opportunity_snapshot_id UUID REFERENCES opportunity_snapshots(id) ON DELETE SET NULL,
  useful BOOLEAN NOT NULL,
  reason TEXT CHECK (
    reason IS NULL OR reason IN (
      'WRONG_COMPANY',
      'WRONG_TIMING',
      'WRONG_SIGNAL',
      'WRONG_OFFERING',
      'TOO_SMALL',
      'TOO_LARGE',
      'ALREADY_CONTACTED',
      'OTHER'
    )
  ),
  note TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recommendation_feedback_org_time_idx
  ON recommendation_feedback(organization_id, created_at DESC);
