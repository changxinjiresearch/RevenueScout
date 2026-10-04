CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  legal_name TEXT,
  name_key TEXT NOT NULL,
  website TEXT,
  domain TEXT,
  logo_url TEXT,
  description TEXT,
  country TEXT,
  state TEXT,
  city TEXT,
  address TEXT,
  industry TEXT,
  subindustry TEXT,
  employee_count INTEGER,
  employee_range TEXT,
  founded_year INTEGER,
  company_type TEXT,
  service_regions TEXT[] NOT NULL DEFAULT '{}',
  products_services TEXT,
  roles_observed TEXT[] NOT NULL DEFAULT '{}',
  business_models TEXT[] NOT NULL DEFAULT '{}',
  technologies TEXT[] NOT NULL DEFAULT '{}',
  fast_growth BOOLEAN NOT NULL DEFAULT FALSE,
  multi_location BOOLEAN NOT NULL DEFAULT FALSE,
  currently_hiring BOOLEAN NOT NULL DEFAULT FALSE,
  recent_funding BOOLEAN NOT NULL DEFAULT FALSE,
  digital_need BOOLEAN NOT NULL DEFAULT FALSE,
  entity_type TEXT NOT NULL DEFAULT 'UNKNOWN'
    CHECK (entity_type IN ('PRIVATE','GOVERNMENT','NONPROFIT','UNKNOWN')),
  relationship_status TEXT NOT NULL DEFAULT 'NONE'
    CHECK (relationship_status IN (
      'NONE','EXISTING_CUSTOMER','PIPELINE','CONTACTED','REJECTED','UNSUBSCRIBED'
    )),
  source_origin TEXT NOT NULL DEFAULT 'MANUAL'
    CHECK (source_origin IN ('MANUAL','DISCOVERY','IMPORT')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS companies_org_idx
  ON companies(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS companies_name_key_idx
  ON companies(organization_id, name_key);

CREATE UNIQUE INDEX IF NOT EXISTS companies_org_domain_unique
  ON companies(organization_id, LOWER(domain))
  WHERE domain IS NOT NULL AND domain <> '';

CREATE TABLE IF NOT EXISTS company_identifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  identifier_type TEXT NOT NULL,
  identifier_value TEXT NOT NULL,
  provider TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, identifier_type, identifier_value)
);

CREATE INDEX IF NOT EXISTS company_identifiers_company_idx
  ON company_identifiers(company_id);

CREATE TABLE IF NOT EXISTS company_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'GLEIF','COMPANY_WEBSITE','NEWS','JOB_BOARD','TENDER','REGISTRY','MANUAL','OTHER'
  )),
  source_url TEXT,
  source_label TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.500
    CHECK (confidence >= 0 AND confidence <= 1),
  verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED'
    CHECK (verification_status IN ('CONFIRMED','LIKELY','UNVERIFIED','OUTDATED')),
  stale_after_days INTEGER NOT NULL DEFAULT 90 CHECK (stale_after_days > 0),
  content_hash TEXT,
  provider_record_id TEXT,
  raw_payload JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS company_evidence_company_time_idx
  ON company_evidence(company_id, observed_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS company_evidence_hash_unique
  ON company_evidence(company_id, content_hash)
  WHERE content_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS buying_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  evidence_id UUID NOT NULL REFERENCES company_evidence(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'HIRING','EXPANSION','FUNDING','LEADERSHIP',
    'TECHNOLOGY','OPERATIONAL_PAIN','GROWTH','PROCUREMENT'
  )),
  label TEXT NOT NULL,
  summary TEXT NOT NULL,
  rationale TEXT NOT NULL,
  strength INTEGER NOT NULL CHECK (strength >= 0 AND strength <= 100),
  confidence NUMERIC(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  observed_at TIMESTAMPTZ NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED'
    CHECK (verification_status IN ('CONFIRMED','LIKELY','UNVERIFIED','OUTDATED')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS buying_signals_company_time_idx
  ON buying_signals(company_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS discovery_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  offering_id UUID REFERENCES offerings(id) ON DELETE SET NULL,
  icp_id UUID REFERENCES icps(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  country TEXT,
  region TEXT,
  status TEXT NOT NULL CHECK (status IN ('RUNNING','COMPLETED','FAILED')),
  result_count INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  results JSONB NOT NULL DEFAULT '[]'::JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS discovery_runs_org_idx
  ON discovery_runs(organization_id, created_at DESC);
