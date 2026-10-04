CREATE TABLE IF NOT EXISTS company_research_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('RUNNING','COMPLETED','FAILED')),
  provider TEXT NOT NULL DEFAULT 'OPENAI',
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  request_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_urls TEXT[] NOT NULL DEFAULT '{}',
  source_count INTEGER NOT NULL DEFAULT 0,
  official_website TEXT,
  business_summary TEXT,
  researched_industry TEXT,
  researched_subindustry TEXT,
  employee_low INTEGER,
  employee_high INTEGER,
  employee_confidence NUMERIC(4,3),
  researched_service_regions TEXT[] NOT NULL DEFAULT '{}',
  researched_business_models TEXT[] NOT NULL DEFAULT '{}',
  researched_technologies TEXT[] NOT NULL DEFAULT '{}',
  researched_roles TEXT[] NOT NULL DEFAULT '{}',
  commercial_fit_score INTEGER CHECK (commercial_fit_score BETWEEN 0 AND 100),
  buying_intent_score INTEGER CHECK (buying_intent_score BETWEEN 0 AND 100),
  budget_fit_score INTEGER CHECK (budget_fit_score BETWEEN 0 AND 100),
  timing_score INTEGER CHECK (timing_score BETWEEN 0 AND 100),
  need_score INTEGER CHECK (need_score BETWEEN 0 AND 100),
  evidence_confidence INTEGER CHECK (evidence_confidence BETWEEN 0 AND 100),
  potential_score INTEGER CHECK (potential_score BETWEEN 0 AND 100),
  conversion_likelihood NUMERIC(5,4)
    CHECK (conversion_likelihood >= 0 AND conversion_likelihood <= 1),
  recommendation TEXT CHECK (recommendation IN (
    'HIGH_POTENTIAL','MEDIUM_POTENTIAL','LOW_POTENTIAL','NEEDS_MORE_DATA'
  )),
  assessment_summary TEXT,
  why_fit TEXT[] NOT NULL DEFAULT '{}',
  why_now TEXT[] NOT NULL DEFAULT '{}',
  risks TEXT[] NOT NULL DEFAULT '{}',
  recommended_contact_role TEXT,
  next_action TEXT,
  raw_response JSONB,
  error_message TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS company_research_runs_company_idx
  ON company_research_runs(company_id, created_at DESC);

ALTER TABLE company_evidence
  ADD COLUMN IF NOT EXISTS research_run_id UUID
    REFERENCES company_research_runs(id) ON DELETE SET NULL;

ALTER TABLE buying_signals
  ADD COLUMN IF NOT EXISTS research_run_id UUID
    REFERENCES company_research_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS company_evidence_research_run_idx
  ON company_evidence(research_run_id)
  WHERE research_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS buying_signals_research_run_idx
  ON buying_signals(research_run_id)
  WHERE research_run_id IS NOT NULL;
