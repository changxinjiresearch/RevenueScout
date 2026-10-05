-- M3 — Opportunity Intelligence
--
-- Persist explainable opportunity snapshots, explicit human overrides and an
-- append-only audit trail. Snapshots are immutable historical decisions; a new
-- input hash creates a new snapshot instead of rewriting the previous one.

CREATE TABLE IF NOT EXISTS opportunity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  config_version INTEGER NOT NULL,
  input_hash TEXT NOT NULL,
  model_version TEXT NOT NULL DEFAULT 'RS_OPPORTUNITY_V1',

  matched_icp_id UUID REFERENCES icps(id) ON DELETE SET NULL,
  matched_icp_name TEXT,
  offering_id UUID REFERENCES offerings(id) ON DELETE SET NULL,
  offering_name TEXT,
  offering_reason TEXT NOT NULL DEFAULT '',

  opportunity_score INTEGER NOT NULL CHECK (opportunity_score BETWEEN 0 AND 100),
  icp_fit INTEGER NOT NULL CHECK (icp_fit BETWEEN 0 AND 100),
  buying_intent INTEGER NOT NULL CHECK (buying_intent BETWEEN 0 AND 100),
  timing_score INTEGER NOT NULL CHECK (timing_score BETWEEN 0 AND 100),
  deal_potential INTEGER NOT NULL CHECK (deal_potential BETWEEN 0 AND 100),
  contactability INTEGER NOT NULL CHECK (contactability BETWEEN 0 AND 100),
  evidence_confidence INTEGER NOT NULL CHECK (evidence_confidence BETWEEN 0 AND 100),

  deal_value_low NUMERIC(14,2) NOT NULL DEFAULT 0,
  deal_value_expected NUMERIC(14,2) NOT NULL DEFAULT 0,
  deal_value_high NUMERIC(14,2) NOT NULL DEFAULT 0,
  deal_value_basis TEXT NOT NULL DEFAULT 'none'
    CHECK (deal_value_basis IN ('minimum','average','ideal','none')),

  conversion_probability NUMERIC(6,5) NOT NULL DEFAULT 0
    CHECK (conversion_probability >= 0 AND conversion_probability <= 1),
  conversion_confidence TEXT NOT NULL DEFAULT 'LOW'
    CHECK (conversion_confidence IN ('LOW','MEDIUM','HIGH')),
  calibration_state TEXT NOT NULL DEFAULT 'PRE_CALIBRATION'
    CHECK (calibration_state IN ('PRE_CALIBRATION','CALIBRATING','CALIBRATED')),

  expected_revenue_low NUMERIC(14,2) NOT NULL DEFAULT 0,
  expected_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  expected_revenue_high NUMERIC(14,2) NOT NULL DEFAULT 0,
  sales_effort TEXT NOT NULL DEFAULT 'MEDIUM'
    CHECK (sales_effort IN ('LOW','MEDIUM','HIGH')),
  revenue_efficiency NUMERIC(14,2) NOT NULL DEFAULT 0,
  rank_score NUMERIC(14,4) NOT NULL DEFAULT 0,

  recommended_contact TEXT NOT NULL DEFAULT '',
  next_best_action TEXT NOT NULL DEFAULT '',
  why_this_company TEXT NOT NULL DEFAULT '',
  why_now TEXT NOT NULL DEFAULT '',
  problem_hypothesis TEXT NOT NULL DEFAULT '',
  conversion_factors JSONB NOT NULL DEFAULT '[]'::JSONB,
  score_explanation JSONB NOT NULL DEFAULT '{}'::JSONB,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (organization_id, company_id, input_hash)
);

CREATE INDEX IF NOT EXISTS opportunity_snapshots_org_rank_idx
  ON opportunity_snapshots(organization_id, rank_score DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS opportunity_snapshots_company_time_idx
  ON opportunity_snapshots(company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS opportunity_overrides (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  priority_override TEXT NOT NULL DEFAULT 'AUTO'
    CHECK (priority_override IN ('AUTO','HIGH','MEDIUM','LOW','HOLD')),
  conversion_probability_override NUMERIC(6,5)
    CHECK (
      conversion_probability_override IS NULL OR
      (conversion_probability_override >= 0 AND conversion_probability_override <= 1)
    ),
  expected_deal_value_override NUMERIC(14,2)
    CHECK (
      expected_deal_value_override IS NULL OR expected_deal_value_override >= 0
    ),
  offering_id_override UUID REFERENCES offerings(id) ON DELETE SET NULL,
  next_best_action_override TEXT,
  note TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, company_id)
);

CREATE INDEX IF NOT EXISTS opportunity_overrides_company_idx
  ON opportunity_overrides(company_id);

CREATE TABLE IF NOT EXISTS opportunity_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  snapshot_id UUID REFERENCES opportunity_snapshots(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'SNAPSHOT_CREATED',
    'OVERRIDE_UPDATED',
    'OVERRIDE_CLEARED'
  )),
  before_json JSONB,
  after_json JSONB,
  note TEXT NOT NULL DEFAULT '',
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS opportunity_audit_events_company_time_idx
  ON opportunity_audit_events(company_id, created_at DESC);

-- Discovery source families added during M2 source expansion must also be
-- persistable after import. Replace the original M2 source-type constraint with
-- the current audited source universe.
ALTER TABLE company_evidence
  DROP CONSTRAINT IF EXISTS company_evidence_source_type_check;

ALTER TABLE company_evidence
  ADD CONSTRAINT company_evidence_source_type_check CHECK (source_type IN (
    'GLEIF',
    'WIKIDATA',
    'OFFICIAL_WEBSITE',
    'FTA_APSA',
    'ATA',
    'AFRA',
    'ALC',
    'COMPANY_WEBSITE',
    'NEWS',
    'JOB_BOARD',
    'TENDER',
    'REGISTRY',
    'MANUAL',
    'OTHER'
  ));
