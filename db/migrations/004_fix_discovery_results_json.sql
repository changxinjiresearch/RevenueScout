UPDATE discovery_runs
SET results = (results #>> '{}')::jsonb
WHERE jsonb_typeof(results) = 'string';
