import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { importDiscoveryCandidate } from "@/lib/companies/import-discovery";
import { db } from "@/lib/db";
import { jsonArrayValue } from "@/lib/db/json-value";
import type { DiscoveryCandidate } from "@/lib/discovery/types";
import { getGleifCandidateByLei } from "@/lib/discovery/gleif";
import { publicUrl } from "@/lib/http/public-url";

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const formData = await request.formData();
  const runId = String(formData.get("runId") ?? "");
  const requestedIndex = Number.parseInt(
    String(formData.get("candidateIndex") ?? "-1"),
    10,
  );
  const candidateKey =
    String(formData.get("candidateKey") ?? "").trim() || null;

  if (
    !runId ||
    (!candidateKey &&
      (!Number.isInteger(requestedIndex) || requestedIndex < 0))
  ) {
    return NextResponse.json(
      { error: "Invalid discovery import." },
      { status: 400 },
    );
  }

  const sql = db();
  const [run] = await sql<{ results: unknown }[]>`
    SELECT results
    FROM discovery_runs
    WHERE id = ${runId}
      AND organization_id = ${user.organizationId}
      AND status IN ('RUNNING', 'COMPLETED')
    LIMIT 1
  `;

  if (!run) {
    return NextResponse.json({ error: "Discovery run not found." }, { status: 404 });
  }

  const results = jsonArrayValue<DiscoveryCandidate>(run.results);
  const candidateIndex = candidateKey
    ? results.findIndex(
        (item) => item.providerRecordId === candidateKey,
      )
    : requestedIndex;
  const candidate = results[candidateIndex];
  if (!candidate) {
    return NextResponse.json({ error: "Discovery candidate not found." }, { status: 404 });
  }

  const refreshedCandidate =
    candidate.provider === "GLEIF"
      ? (await getGleifCandidateByLei(candidate.providerRecordId)) ?? candidate
      : candidate;

  const result = await importDiscoveryCandidate({
    organizationId: user.organizationId,
    userId: user.id,
    candidate: refreshedCandidate,
  });

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO discovery_imports (
        discovery_run_id,
        company_id,
        candidate_index,
        duplicate_detected,
        duplicate_reason
      )
      VALUES (
        ${runId},
        ${result.companyId},
        ${candidateIndex},
        ${result.duplicate},
        ${result.duplicateReason ?? null}
      )
      ON CONFLICT (discovery_run_id, candidate_index)
      DO NOTHING
    `;

    await tx`
      UPDATE discovery_runs
      SET imported_count = (
        SELECT COUNT(*)::int
        FROM discovery_imports
        WHERE discovery_run_id = ${runId}
      )
      WHERE id = ${runId}
    `;
  });

  const url = publicUrl(request, `/companies/${result.companyId}`);
  url.searchParams.set(result.duplicate ? "duplicate" : "imported", "1");
  return NextResponse.redirect(url, 303);
}
