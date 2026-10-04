import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/http/public-url";

const SIGNAL_TYPES = new Set([
  "HIRING",
  "EXPANSION",
  "FUNDING",
  "LEADERSHIP",
  "TECHNOLOGY",
  "OPERATIONAL_PAIN",
  "GROWTH",
  "PROCUREMENT",
]);

const VERIFICATION = new Set([
  "CONFIRMED",
  "LIKELY",
  "UNVERIFIED",
  "OUTDATED",
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await context.params;
  const formData = await request.formData();

  const evidenceId = String(formData.get("evidenceId") ?? "");
  const signalType = String(formData.get("signalType") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const rationale = String(formData.get("rationale") ?? "").trim();
  const strength = Number(formData.get("strength") ?? 50);
  const confidence = Number(formData.get("confidence") ?? 0.5);
  const verification = String(
    formData.get("verificationStatus") ?? "UNVERIFIED",
  );

  if (!evidenceId || !SIGNAL_TYPES.has(signalType) || !label || !summary || !rationale) {
    const url = publicUrl(request, `/companies/${id}`);
    url.searchParams.set(
      "error",
      "Signal type, evidence, label, summary and rationale are required.",
    );
    return NextResponse.redirect(url, 303);
  }

  const sql = db();
  const [evidence] = await sql<{ observedAt: Date }[]>`
    SELECT observed_at AS "observedAt"
    FROM company_evidence
    WHERE id = ${evidenceId}
      AND company_id = ${id}
      AND organization_id = ${user.organizationId}
    LIMIT 1
  `;

  if (!evidence) {
    return NextResponse.json(
      { error: "Evidence does not belong to this company." },
      { status: 400 },
    );
  }

  const safeSummary =
    signalType === "OPERATIONAL_PAIN"
      ? `Potential pain signal: ${summary}`
      : summary;

  await sql`
    INSERT INTO buying_signals (
      organization_id,
      company_id,
      evidence_id,
      signal_type,
      label,
      summary,
      rationale,
      strength,
      confidence,
      observed_at,
      verification_status,
      created_by
    )
    VALUES (
      ${user.organizationId},
      ${id},
      ${evidenceId},
      ${signalType},
      ${label},
      ${safeSummary},
      ${rationale},
      ${Math.max(0, Math.min(100, Math.round(strength)))},
      ${Math.max(0, Math.min(1, confidence))},
      ${new Date(evidence.observedAt)},
      ${VERIFICATION.has(verification) ? verification : "UNVERIFIED"},
      ${user.id}
    )
  `;

  return NextResponse.redirect(
    publicUrl(request, `/companies/${id}?saved=signal`),
    303,
  );
}
