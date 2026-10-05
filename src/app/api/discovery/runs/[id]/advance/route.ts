import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { jsonArrayValue } from "@/lib/db/json-value";
import { searchGleif } from "@/lib/discovery/gleif";
import {
  addOfficialWebsiteEvidence,
  candidateWithEvidence,
  dedupeDiscoveryCandidates,
  finalizeValidatedCandidate,
} from "@/lib/discovery/multi-source";
import {
  discoveryProgress,
  parseProgressiveDiscoveryState,
  type ProgressiveDiscoveryWorkState,
} from "@/lib/discovery/progressive";
import {
  rankDiscoveryCandidates,
  type DiscoveryIcpContext,
} from "@/lib/discovery/priority";
import type { DiscoveryCandidate } from "@/lib/discovery/types";
import { searchWikidata } from "@/lib/discovery/wikidata";

type RunRow = {
  id: string;
  query: string;
  country: string | null;
  region: string | null;
  status: string;
  results: unknown;
  workState: unknown;
  icpId: string | null;
};

type IcpRow = {
  countries: string[];
  states: string[];
  cities: string[];
  industries: string[];
  subindustries: string[];
  employeeMin: number | null;
  employeeMax: number | null;
  companyAgeMin: number | null;
  companyAgeMax: number | null;
  companyTypes: string[];
};

function hasIndustrySeed(candidate: DiscoveryCandidate): boolean {
  return (candidate.sourceEvidence ?? []).some(
    (item) => item.supportsIndustry,
  );
}

function hasTrustedWebsite(candidate: DiscoveryCandidate): boolean {
  return Boolean(candidate.website || candidate.domain);
}

function validationOrder(a: DiscoveryCandidate, b: DiscoveryCandidate): number {
  const aScore =
    (hasIndustrySeed(a) ? 4 : 0) +
    (hasTrustedWebsite(a) ? 3 : 0) +
    ((a.sourceEvidence ?? []).length > 1 ? 1 : 0);
  const bScore =
    (hasIndustrySeed(b) ? 4 : 0) +
    (hasTrustedWebsite(b) ? 3 : 0) +
    ((b.sourceEvidence ?? []).length > 1 ? 1 : 0);
  return bScore - aScore;
}

async function loadIcpContext(
  organizationId: string,
  icpId: string | null,
): Promise<DiscoveryIcpContext | null> {
  if (!icpId) return null;
  const sql = db();
  const [row] = await sql<IcpRow[]>\`
    SELECT
      countries,
      states,
      cities,
      industries,
      subindustries,
      employee_min AS "employeeMin",
      employee_max AS "employeeMax",
      company_age_min AS "companyAgeMin",
      company_age_max AS "companyAgeMax",
      company_types AS "companyTypes"
    FROM icps
    WHERE id = \${icpId}
      AND organization_id = \${organizationId}
    LIMIT 1
  \`;

  return row ?? null;
}

async function advanceDiscovery(
  state: ProgressiveDiscoveryWorkState,
  run: RunRow,
): Promise<ProgressiveDiscoveryWorkState> {
  if (state.semanticIndex >= state.semantics.length) {
    return {
      ...state,
      stage: "VALIDATION",
      candidates: state.candidates
        .filter((candidate) => hasIndustrySeed(candidate) && hasTrustedWebsite(candidate))
        .sort(validationOrder),
      validationIndex: 0,
    };
  }

  const term = state.semantics[state.semanticIndex];
  const query = {
    query: term,
    country: run.country,
    region: run.region,
  };

  const [gleif, wikidata] = await Promise.allSettled([
    searchGleif(query),
    searchWikidata({ ...query, semantics: [term] }),
  ]);

  const additions: DiscoveryCandidate[] = [];
  if (gleif.status === "fulfilled") additions.push(...gleif.value);
  if (wikidata.status === "fulfilled") additions.push(...wikidata.value);

  const prepared = additions.map((candidate) =>
    candidateWithEvidence(candidate, state.semantics),
  );

  const nextIndex = state.semanticIndex + 1;
  const merged = dedupeDiscoveryCandidates([
    ...state.candidates,
    ...prepared,
  ]);

  if (nextIndex >= state.semantics.length) {
    return {
      ...state,
      stage: "VALIDATION",
      semanticIndex: nextIndex,
      candidates: merged
        .filter((candidate) => hasIndustrySeed(candidate) && hasTrustedWebsite(candidate))
        .sort(validationOrder),
      validationIndex: 0,
    };
  }

  return {
    ...state,
    semanticIndex: nextIndex,
    candidates: merged,
  };
}

async function advanceValidation(
  state: ProgressiveDiscoveryWorkState,
  run: RunRow,
  currentResults: DiscoveryCandidate[],
  icp: DiscoveryIcpContext | null,
): Promise<{
  state: ProgressiveDiscoveryWorkState;
  results: DiscoveryCandidate[];
}> {
  const batchSize = 6;
  const batch = state.candidates.slice(
    state.validationIndex,
    state.validationIndex + batchSize,
  );

  if (batch.length === 0) {
    return {
      state: { ...state, stage: "COMPLETE" },
      results: rankDiscoveryCandidates(currentResults, icp),
    };
  }

  const enriched = await Promise.all(
    batch.map((candidate) =>
      addOfficialWebsiteEvidence(candidate, state.semantics),
    ),
  );

  const validated = enriched
    .map((candidate) => finalizeValidatedCandidate(candidate, run.query))
    .filter(
      (candidate): candidate is DiscoveryCandidate => candidate !== null,
    );

  const mergedResults = dedupeDiscoveryCandidates([
    ...currentResults,
    ...validated,
  ]);
  const ranked = rankDiscoveryCandidates(mergedResults, icp);
  const nextIndex = state.validationIndex + batch.length;
  const complete = nextIndex >= state.candidates.length;

  return {
    state: {
      ...state,
      stage: complete ? "COMPLETE" : "VALIDATION",
      validationIndex: nextIndex,
    },
    results: ranked,
  };
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await params;
  const sql = db();

  const [run] = await sql<RunRow[]>\`
    SELECT
      id,
      query,
      country,
      region,
      status,
      results,
      work_state AS "workState",
      icp_id AS "icpId"
    FROM discovery_runs
    WHERE id = \${id}
      AND organization_id = \${user.organizationId}
    LIMIT 1
  \`;

  if (!run) {
    return NextResponse.json({ error: "Discovery run not found." }, { status: 404 });
  }

  const currentResults = jsonArrayValue<DiscoveryCandidate>(run.results);
  if (run.status === "COMPLETED") {
    return NextResponse.json({
      status: run.status,
      results: currentResults,
      progress: discoveryProgress(
        {
          ...parseProgressiveDiscoveryState(run.workState, run.query),
          stage: "COMPLETE",
        },
        currentResults.length,
      ),
    });
  }

  if (run.status === "FAILED") {
    return NextResponse.json(
      { error: "Discovery run has failed." },
      { status: 409 },
    );
  }

  try {
    const icp = await loadIcpContext(user.organizationId, run.icpId);
    let state = parseProgressiveDiscoveryState(run.workState, run.query);
    let results = currentResults;

    if (state.stage === "DISCOVERY") {
      state = await advanceDiscovery(state, run);
    } else if (state.stage === "VALIDATION") {
      const advanced = await advanceValidation(
        state,
        run,
        currentResults,
        icp,
      );
      state = advanced.state;
      results = advanced.results;
    }

    const completed = state.stage === "COMPLETE";
    const progress = discoveryProgress(state, results.length);

    await sql\`
      UPDATE discovery_runs
      SET
        status = \${completed ? "COMPLETED" : "RUNNING"},
        result_count = \${results.length},
        results = \${JSON.stringify(results)}::text::jsonb,
        work_state = \${JSON.stringify(state)}::text::jsonb,
        progress = \${JSON.stringify(progress)}::text::jsonb,
        completed_at = \${completed ? new Date() : null}
      WHERE id = \${run.id}
        AND organization_id = \${user.organizationId}
    \`;

    return NextResponse.json({
      status: completed ? "COMPLETED" : "RUNNING",
      resultCount: results.length,
      progress,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Discovery advance failed.";

    await sql\`
      UPDATE discovery_runs
      SET
        status = 'FAILED',
        error_message = \${message},
        completed_at = NOW()
      WHERE id = \${run.id}
        AND organization_id = \${user.organizationId}
    \`;

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
