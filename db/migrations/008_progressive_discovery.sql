ALTER TABLE discovery_runs
  ADD COLUMN IF NOT EXISTS progress JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS work_state JSONB NOT NULL DEFAULT '{}'::JSONB;

COMMENT ON COLUMN discovery_runs.progress IS
  'User-visible progressive discovery progress. Safe to expose to the owning workspace.';

COMMENT ON COLUMN discovery_runs.work_state IS
  'Internal resumable discovery state used to advance bounded search/enrichment batches.';
