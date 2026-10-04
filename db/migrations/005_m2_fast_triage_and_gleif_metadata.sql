ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS legal_entity_category TEXT,
  ADD COLUMN IF NOT EXISTS legal_entity_subcategory TEXT,
  ADD COLUMN IF NOT EXISTS entity_status TEXT,
  ADD COLUMN IF NOT EXISTS registration_status TEXT,
  ADD COLUMN IF NOT EXISTS jurisdiction TEXT,
  ADD COLUMN IF NOT EXISTS legal_form_code TEXT,
  ADD COLUMN IF NOT EXISTS registration_authority TEXT,
  ADD COLUMN IF NOT EXISTS registered_as TEXT,
  ADD COLUMN IF NOT EXISTS provider_last_updated_at TIMESTAMPTZ;

UPDATE company_evidence
SET source_url = 'https://search.gleif.org/#/record/' || provider_record_id
WHERE source_type = 'GLEIF'
  AND provider_record_id IS NOT NULL
  AND (
    source_url IS NULL
    OR source_url LIKE 'https://api.gleif.org/%'
  );
