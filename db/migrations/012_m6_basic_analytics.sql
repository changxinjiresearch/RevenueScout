-- M6 — Basic analytics and revenue learning
--
-- The M6 analytics layer is computed from authoritative M2-M5 facts rather
-- than copied into a second warehouse. These indexes make the core cohort,
-- funnel, attribution and calibration queries predictable as the workspace
-- grows.

CREATE INDEX IF NOT EXISTS companies_org_created_idx
  ON companies(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS company_sales_lifecycle_org_qualified_idx
  ON company_sales_lifecycle(organization_id, qualified_at)
  WHERE qualified_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS company_sales_lifecycle_org_first_contact_idx
  ON company_sales_lifecycle(organization_id, first_contact_at)
  WHERE first_contact_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS company_sales_lifecycle_org_replied_idx
  ON company_sales_lifecycle(organization_id, replied_at)
  WHERE replied_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS company_sales_lifecycle_org_meeting_idx
  ON company_sales_lifecycle(organization_id, meeting_at)
  WHERE meeting_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS company_sales_lifecycle_org_opportunity_idx
  ON company_sales_lifecycle(organization_id, opportunity_at)
  WHERE opportunity_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS company_sales_lifecycle_org_proposal_idx
  ON company_sales_lifecycle(organization_id, proposal_at)
  WHERE proposal_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS sales_outcomes_org_outcome_closed_idx
  ON sales_outcomes(organization_id, outcome, closed_at DESC);

CREATE INDEX IF NOT EXISTS sales_outcomes_org_snapshot_idx
  ON sales_outcomes(organization_id, opportunity_snapshot_id)
  WHERE opportunity_snapshot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS buying_signals_org_type_company_idx
  ON buying_signals(organization_id, signal_type, company_id);

CREATE INDEX IF NOT EXISTS opportunity_snapshots_org_company_created_idx
  ON opportunity_snapshots(organization_id, company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS recommendation_feedback_org_useful_created_idx
  ON recommendation_feedback(organization_id, useful, created_at DESC);
