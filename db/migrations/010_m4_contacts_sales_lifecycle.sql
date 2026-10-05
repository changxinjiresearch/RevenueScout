-- M4 — Contacts and sales lifecycle
--
-- Persist people, ownership, activities, lifecycle stages and real outcomes so
-- M3 predictions can be compared with what actually happened.

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  location TEXT,
  decision_relevance TEXT NOT NULL DEFAULT 'UNKNOWN'
    CHECK (decision_relevance IN (
      'PRIMARY_DECISION_MAKER',
      'DECISION_MAKER',
      'INFLUENCER',
      'CHAMPION',
      'PROCUREMENT',
      'TECHNICAL',
      'GATEKEEPER',
      'UNKNOWN'
    )),
  contact_status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (contact_status IN ('ACTIVE','UNKNOWN','INVALID','LEFT_COMPANY')),
  contactability_status TEXT NOT NULL DEFAULT 'UNCERTAIN'
    CHECK (contactability_status IN (
      'CONTACT_PERMITTED',
      'EXISTING_RELATIONSHIP',
      'USER_CONFIRMED_CONSENT',
      'PUBLIC_BUSINESS_CONTACT',
      'UNCERTAIN',
      'DO_NOT_CONTACT',
      'UNSUBSCRIBED'
    )),
  source_url TEXT,
  source_label TEXT NOT NULL DEFAULT 'Manual',
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.500
    CHECK (confidence >= 0 AND confidence <= 1),
  verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED'
    CHECK (verification_status IN ('CONFIRMED','LIKELY','UNVERIFIED','OUTDATED')),
  notes TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contacts_company_idx
  ON contacts(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS contacts_org_email_idx
  ON contacts(organization_id, LOWER(email))
  WHERE email IS NOT NULL AND email <> '';

CREATE TABLE IF NOT EXISTS company_sales_lifecycle (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'DISCOVERED'
    CHECK (stage IN (
      'DISCOVERED',
      'QUALIFIED',
      'READY_TO_CONTACT',
      'CONTACTED',
      'REPLIED',
      'MEETING',
      'OPPORTUNITY',
      'PROPOSAL',
      'WON',
      'LOST',
      'NOT_FIT',
      'DO_NOT_CONTACT',
      'SUPPRESSED'
    )),
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  primary_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  current_offering_id UUID REFERENCES offerings(id) ON DELETE SET NULL,
  next_action TEXT NOT NULL DEFAULT '',
  next_action_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  qualified_at TIMESTAMPTZ,
  ready_to_contact_at TIMESTAMPTZ,
  first_contact_at TIMESTAMPTZ,
  last_contact_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  meeting_at TIMESTAMPTZ,
  opportunity_at TIMESTAMPTZ,
  proposal_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  stage_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, company_id)
);

CREATE INDEX IF NOT EXISTS company_sales_lifecycle_owner_stage_idx
  ON company_sales_lifecycle(organization_id, owner_user_id, stage);

CREATE INDEX IF NOT EXISTS company_sales_lifecycle_next_action_idx
  ON company_sales_lifecycle(organization_id, next_action_at)
  WHERE next_action_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS sales_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL
    CHECK (activity_type IN (
      'OUTREACH',
      'FOLLOW_UP',
      'REPLY',
      'MEETING',
      'PROPOSAL',
      'NOTE',
      'STAGE_CHANGE'
    )),
  channel TEXT NOT NULL DEFAULT 'OTHER'
    CHECK (channel IN ('EMAIL','PHONE','LINKEDIN','MEETING','OTHER','INTERNAL')),
  direction TEXT NOT NULL DEFAULT 'INTERNAL'
    CHECK (direction IN ('OUTBOUND','INBOUND','INTERNAL')),
  subject TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  activity_status TEXT NOT NULL DEFAULT 'COMPLETED'
    CHECK (activity_status IN (
      'PLANNED',
      'SENT',
      'COMPLETED',
      'REPLIED',
      'NO_RESPONSE',
      'CANCELLED'
    )),
  follow_up_sequence INTEGER NOT NULL DEFAULT 0
    CHECK (follow_up_sequence BETWEEN 0 AND 3),
  next_action_at TIMESTAMPTZ,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sales_activities_company_time_idx
  ON sales_activities(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sales_activities_contact_time_idx
  ON sales_activities(contact_id, created_at DESC)
  WHERE contact_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sales_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('WON','LOST')),
  opportunity_snapshot_id UUID REFERENCES opportunity_snapshots(id) ON DELETE SET NULL,
  predicted_opportunity_score INTEGER
    CHECK (predicted_opportunity_score IS NULL OR predicted_opportunity_score BETWEEN 0 AND 100),
  predicted_conversion_probability NUMERIC(6,5)
    CHECK (
      predicted_conversion_probability IS NULL OR
      (predicted_conversion_probability >= 0 AND predicted_conversion_probability <= 1)
    ),
  predicted_deal_value NUMERIC(14,2),
  predicted_expected_revenue NUMERIC(14,2),
  actual_contract_value NUMERIC(14,2)
    CHECK (actual_contract_value IS NULL OR actual_contract_value >= 0),
  actual_offering_id UUID REFERENCES offerings(id) ON DELETE SET NULL,
  primary_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  lost_reason TEXT
    CHECK (
      lost_reason IS NULL OR lost_reason IN (
        'NO_BUDGET',
        'NO_NEED',
        'TIMING',
        'COMPETITOR',
        'PRICE',
        'WRONG_CONTACT',
        'COMPANY_TOO_SMALL',
        'EXISTING_SUPPLIER',
        'NO_RESPONSE',
        'INTERNAL_SOLUTION',
        'OTHER'
      )
    ),
  lost_reason_note TEXT NOT NULL DEFAULT '',
  recommendation_source TEXT NOT NULL DEFAULT '',
  key_buying_signal_ids JSONB NOT NULL DEFAULT '[]'::JSONB,
  first_contact_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sales_cycle_days INTEGER
    CHECK (sales_cycle_days IS NULL OR sales_cycle_days >= 0),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, company_id)
);

CREATE INDEX IF NOT EXISTS sales_outcomes_org_time_idx
  ON sales_outcomes(organization_id, closed_at DESC);

CREATE INDEX IF NOT EXISTS sales_outcomes_snapshot_idx
  ON sales_outcomes(opportunity_snapshot_id)
  WHERE opportunity_snapshot_id IS NOT NULL;
