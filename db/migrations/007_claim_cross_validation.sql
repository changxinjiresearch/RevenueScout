ALTER TABLE company_evidence
  ADD COLUMN IF NOT EXISTS source_domain TEXT,
  ADD COLUMN IF NOT EXISTS source_family TEXT,
  ADD COLUMN IF NOT EXISTS independence_key TEXT,
  ADD COLUMN IF NOT EXISTS source_quality NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS extraction_confidence NUMERIC(4,3);

CREATE TABLE IF NOT EXISTS company_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  research_run_id UUID REFERENCES web_enrichment_runs(id) ON DELETE SET NULL,
  claim_type TEXT NOT NULL,
  claim_key TEXT NOT NULL,
  value_json JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'CONFIRMED',
    'CORROBORATED',
    'SINGLE_SOURCE',
    'CONFLICTED',
    'STALE',
    'UNKNOWN'
  )),
  confidence NUMERIC(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  supporting_family_count INTEGER NOT NULL DEFAULT 0,
  conflicting_family_count INTEGER NOT NULL DEFAULT 0,
  source_count INTEGER NOT NULL DEFAULT 0,
  freshness_score NUMERIC(4,3) NOT NULL DEFAULT 0,
  source_quality_score NUMERIC(4,3) NOT NULL DEFAULT 0,
  independence_score NUMERIC(4,3) NOT NULL DEFAULT 0,
  agreement_score NUMERIC(4,3) NOT NULL DEFAULT 0,
  extraction_score NUMERIC(4,3) NOT NULL DEFAULT 0,
  first_observed_at TIMESTAMPTZ,
  last_observed_at TIMESTAMPTZ,
  explanation TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, claim_type, claim_key)
);

CREATE INDEX IF NOT EXISTS company_claims_company_idx
  ON company_claims(company_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS company_claims_status_idx
  ON company_claims(company_id, status, claim_type);

CREATE TABLE IF NOT EXISTS company_claim_evidence (
  claim_id UUID NOT NULL REFERENCES company_claims(id) ON DELETE CASCADE,
  evidence_id UUID NOT NULL REFERENCES company_evidence(id) ON DELETE CASCADE,
  stance TEXT NOT NULL CHECK (stance IN ('SUPPORTS','CONTRADICTS')),
  source_family TEXT NOT NULL,
  independence_key TEXT NOT NULL,
  source_quality NUMERIC(4,3) NOT NULL CHECK (source_quality >= 0 AND source_quality <= 1),
  freshness_score NUMERIC(4,3) NOT NULL CHECK (freshness_score >= 0 AND freshness_score <= 1),
  extraction_confidence NUMERIC(4,3) NOT NULL CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (claim_id, evidence_id)
);

CREATE INDEX IF NOT EXISTS company_claim_evidence_evidence_idx
  ON company_claim_evidence(evidence_id);
