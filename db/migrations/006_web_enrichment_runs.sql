CREATE TABLE IF NOT EXISTS web_enrichment_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('RUNNING','COMPLETED','FAILED')),
  engine TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  request_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_urls TEXT[] NOT NULL DEFAULT '{}',
  source_count INTEGER NOT NULL DEFAULT 0,
  structured_result JSONB,
  raw_response JSONB,
  error_message TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS web_enrichment_runs_company_idx
  ON web_enrichment_runs(company_id, created_at DESC);
